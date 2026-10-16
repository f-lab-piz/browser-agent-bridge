import packageInfo from "../package.json" with { type: "json" };
import sdkManifest from "../sdk/manifest.json" with { type: "json" };
import manifest from "../sdk/api.json" with { type: "json" };
import {
  API_ROOTS,
  API_NOTES,
  FACADE_APIS,
  HELP_TOPICS,
  TOPICS,
} from "./help-content.mjs";

// manifest의 선언을 읽을 뿐 SDK를 import하거나 Worker/브라우저를 실행하지 않는다.
const catalog = new Map();
for (const [root, type] of Object.entries(API_ROOTS)) {
  for (const [name, member] of Object.entries(manifest.interfaces[type])) {
    if (
      member.documented === false ||
      member.unsupportedByDefaultIn?.includes("extension")
    )
      continue;
    catalog.set(`${root}.${name}`, { declarations: member.declarations });
  }
}
for (const [name, entry] of Object.entries(FACADE_APIS)) {
  const [type, member] = entry.sourceMember?.split(".") ?? [];
  catalog.set(name, {
    ...entry,
    declarations: entry.sourceMember
      ? manifest.interfaces[type][member].declarations
      : [{ text: entry.signature, references: [] }],
  });
}
// 이 두 collection은 manifest에서 interface가 아니라 type alias로 정의된다.
for (const [root, type] of [
  ["browser.capabilities", "BrowserCapabilityCollection"],
  ["tab.capabilities", "TabCapabilityCollection"],
]) {
  for (const line of manifest.types[type].text.split("\n")) {
    const match = line.trim().match(/^(get|list)\(/);
    if (match)
      catalog.set(`${root}.${match[1]}`, {
        declarations: [{ text: line.trim(), references: [] }],
      });
  }
}
const groups = [
  ...new Set([
    ...Object.keys(API_ROOTS),
    "browser.capabilities",
    "tab.capabilities",
    "cua",
    "nodeRepl",
  ]),
].sort();
const related = (topic) => ({ tool: "browser_help", arguments: { topic } });
const versions = {
  server: packageInfo.version,
  bundledSdk: sdkManifest.version,
};
const scope = `Server ${versions.server}; bundled SDK ${versions.bundledSdk}. API help describes the installed bundled SDK. A custom/remote --sdk-url may differ; help does not load it.`;

function response(topic, body, data = {}, isError = false) {
  const metadata = {
    versions,
    topic,
    related: [
      related("quickstart"),
      related("api"),
      related("troubleshooting"),
    ],
    ...data,
  };
  return {
    content: [{ type: "text", text: `${scope}\n\n${body}` }],
    structuredContent: metadata,
    isError,
  };
}
function apiHelp(name) {
  if (groups.includes(name)) {
    const children = [...new Set([...catalog.keys(), ...groups])]
      .filter(
        (x) =>
          x.startsWith(name + ".") && !x.slice(name.length + 1).includes("."),
      )
      .sort();
    return response(
      "api",
      `# ${name} API index\n\n${children.map((x) => `- ${x}`).join("\n")}\n\nRead one entry with browser_help({api:"${children[0]}"}).`,
      { api: name, apis: children },
    );
  }
  const entry = catalog.get(name);
  if (!entry) {
    return response(
      "api",
      `Unknown or unsupported API: ${name}. Call browser_help({topic:"api"}) for namespaces, then browser_help({api:"tab.getAXState"}) for a detail.`,
      { api: name },
      true,
    );
  }
  const references = new Set(entry.declarations.flatMap((x) => x.references));
  const definitions = [];
  // 매개변수의 구조는 설명하되 반환 객체 전체를 재귀적으로 출력하지 않는다.
  for (const ref of references) {
    const type = manifest.types[ref];
    if (!type) continue;
    definitions.push(type.text);
    for (const child of type.references) references.add(child);
  }
  const parts = [
    `# ${name}`,
    "Run this JavaScript API inside browser_js; it is not a separate MCP tool.",
    "```typescript\n" +
      entry.declarations.map((x) => x.text).join("\n") +
      "\n```",
  ];
  if (definitions.length)
    parts.push(
      "Referenced types:\n```typescript\n" + definitions.join("\n\n") + "\n```",
    );
  if (entry.description) parts.push(entry.description);
  if (API_NOTES[name]) parts.push(API_NOTES[name]);
  if (entry.example)
    parts.push(
      "Example (reuse existing bindings; replace observed-ID placeholders first):\n```javascript\n" +
        entry.example +
        "\n```",
    );
  parts.push(
    'For observation/action order, call browser_help({topic:"ax"}); for output behavior, use topic:"output". Optional capabilities must first be discovered and their documentation read. Original SDK declarations are references, not a guarantee that every upstream option works on every site.',
  );
  return response("api", parts.join("\n\n"), { api: name });
}

export function getHelp({ topic, api } = {}) {
  if (
    api !== undefined &&
    (typeof api !== "string" || !api.length || api.length > 160)
  )
    return response(
      "api",
      'api must be a nonempty name of at most 160 characters. Try browser_help({topic:"api"}).',
      {},
      true,
    );
  if (api !== undefined && topic !== undefined && topic !== "api")
    return response(
      topic,
      'Use either browser_help({topic:"ax"}) or browser_help({api:"tab.getAXState"}); api can only be combined with topic:"api".',
      {},
      true,
    );
  topic ??= api !== undefined ? "api" : "quickstart";
  if (!HELP_TOPICS.includes(topic))
    return response(
      "quickstart",
      `Unknown topic. Supported topics: ${HELP_TOPICS.join(", ")}. Start with browser_help({}).`,
      {},
      true,
    );
  if (api !== undefined) return apiHelp(api);
  if (topic === "api")
    return response(
      "api",
      `# API namespaces\n\n${groups.map((x) => `- ${x}`).join("\n")}\n\nUse browser_help({api:"tab.playwright"}) for a namespace, or browser_help({api:"tab.getAXState"}) for an exact API. Capability methods are described by documentation() on the capability returned at runtime.`,
      { groups },
    );
  return response(topic, TOPICS[topic].join("\n\n"));
}

export function recoveryHint(message) {
  const text = String(message);
  let topic;
  if (
    /stale|accessibility element.*missing|does not have a layout object/i.test(
      text,
    )
  )
    topic = "ax";
  else if (
    /is not defined|session reset|session was reset|timed out|leased by another agent|connection closed during operation/i.test(
      text,
    )
  )
    topic = "session";
  else if (
    /browser is not available|extension is not connected|expected (?:exactly )?one (?:browser|tab)|uploads? (?:are )?disabled|history is disabled|SDK |checksum|fetch failed|native (?:API|command) not mapped/i.test(
      text,
    )
  )
    topic = "troubleshooting";
  return topic
    ? `Recovery guide: browser_help({topic:"${topic}"}). Help does not retry the action or reset the session.`
    : null;
}
