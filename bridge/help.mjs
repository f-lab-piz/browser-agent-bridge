import { readFileSync } from "node:fs";
import packageInfo from "../package.json" with { type: "json" };
import sdkManifest from "../sdk/manifest.json" with { type: "json" };
import manifest from "../sdk/api.json" with { type: "json" };
import {
  API_ROOTS,
  DOCUMENT_NAMES,
  HELP_TOPICS,
  TOPIC_DOCUMENTS,
} from "./help-content.mjs";

// 원본 파일을 그대로 보관한다. SDK 실행·문서 재작성·브라우저 접속은 하지 않는다.
const documents = new Map(
  DOCUMENT_NAMES.map((name) => [
    name,
    readFileSync(
      new URL(`../vendor/openai/26.928.21956/docs/${name}.md`, import.meta.url),
      "utf8",
    ),
  ]),
);
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
  ]),
].sort();
const versions = {
  server: packageInfo.version,
  bundledSdk: sdkManifest.version,
  originalDocuments: "26.928.21956",
};
function response(topic, body, data = {}, isError = false) {
  return {
    content: [{ type: "text", text: body }],
    structuredContent: {
      versions,
      topic,
      related: [
        { tool: "browser_help", arguments: {} },
        { tool: "browser_help", arguments: { topic: "documents" } },
        { tool: "browser_help", arguments: { topic: "api" } },
      ],
      ...data,
    },
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
    return response("api", children.map((x) => `- ${x}`).join("\n"), {
      api: name,
      apis: children,
      source: "sdk/api.json",
    });
  }
  const entry = catalog.get(name);
  if (!entry)
    return response(
      "api",
      `API not in the original extension documentation: ${name}. Use browser_help({topic:"api"}) for the index.`,
      { api: name },
      true,
    );
  const references = new Set(entry.declarations.flatMap((x) => x.references));
  const definitions = [];
  for (const ref of references) {
    const type = manifest.types[ref];
    if (!type) continue;
    definitions.push(type.text);
    for (const child of type.references) references.add(child);
  }
  return response(
    "api",
    [...entry.declarations.map((x) => x.text), ...definitions].join("\n\n"),
    { api: name, source: "sdk/api.json" },
  );
}
export function getHelp({ topic, api } = {}) {
  if (
    api !== undefined &&
    (typeof api !== "string" || !api.length || api.length > 160)
  )
    return response(
      "api",
      'api must be a nonempty name of at most 160 characters. Use browser_help({topic:"api"}).',
      {},
      true,
    );
  if (api !== undefined && topic !== undefined && topic !== "api")
    return response(
      "api",
      'api can only be combined with topic:"api". Use browser_help({api:"tab.ax.click"}).',
      {},
      true,
    );
  topic ??= api !== undefined ? "api" : "quickstart";
  if (api !== undefined) return apiHelp(api);
  if (topic === "api")
    return response(topic, groups.map((x) => `- ${x}`).join("\n"), {
      groups,
      source: "sdk/api.json",
    });
  if (topic === "documents")
    return response(topic, DOCUMENT_NAMES.map((x) => `- ${x}`).join("\n"), {
      documents: DOCUMENT_NAMES,
    });
  const name = Object.hasOwn(TOPIC_DOCUMENTS, topic)
    ? TOPIC_DOCUMENTS[topic]
    : topic;
  if (!documents.has(name))
    return response(
      "documents",
      `Unknown topic. Use browser_help({topic:"documents"}) for original documents. Aliases: ${HELP_TOPICS.join(", ")}.`,
      {},
      true,
    );
  return response(topic, documents.get(name), {
    document: name,
    source: `vendor/openai/26.928.21956/docs/${name}.md`,
    verbatim: true,
  });
}
