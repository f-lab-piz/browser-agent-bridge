import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createBrowserMcp } from "../bridge/mcp-server.mjs";
import { startBroker } from "../bridge/daemon.mjs";
import { getHelp } from "../bridge/help.mjs";
import {
  HELP_TOPICS,
  DOCUMENT_NAMES,
  TOPIC_DOCUMENTS,
  renderReadmeHelp,
} from "../bridge/help-content.mjs";

async function connect(options = {}) {
  const mcp = createBrowserMcp({
    broker: "http://127.0.0.1:1",
    secret: "help-test",
    ...options,
  });
  const client = new Client({ name: "help-test", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await mcp.server.connect(b);
  await client.connect(a);
  return {
    mcp,
    client,
    async close() {
      await client.close();
      await mcp.close();
    },
  };
}
const help = (client, args = {}) =>
  client.callTool({ name: "browser_help", arguments: args });
const js = (client, code, extra = {}) =>
  client.callTool({ name: "browser_js", arguments: { code, ...extra } });
const text = (result) =>
  result.content
    .filter((x) => x.type === "text")
    .map((x) => x.text)
    .join("\n");

test("help는 SDK·Chrome 없이 실행되고 Worker를 시작하지 않는다", async () => {
  const s = await connect({ sdkUrl: "http://127.0.0.1:1/unavailable/" });
  try {
    assert.match(s.client.getInstructions(), /browser_help/);
    const tools = (await s.client.listTools()).tools;
    assert.deepEqual(
      tools.map((x) => x.name),
      ["browser_js", "browser_js_reset", "browser_help"],
    );
    assert.match(tools[0].description, /browser_help/);
    assert.equal(tools[0].annotations?.readOnlyHint, undefined);
    assert.equal(tools[2].annotations.readOnlyHint, true);
    assert.equal(tools[2].annotations.idempotentHint, true);
    assert.equal(tools[2].annotations.openWorldHint, false);
    const r = await help(s.client);
    assert.equal(r.isError, false);
    assert.equal(r.structuredContent.topic, "quickstart");
    assert.ok([...text(r)].length <= 5000);
    assert.equal(r.structuredContent.document, "accessibility");
    assert.equal(r.structuredContent.verbatim, true);
    assert.match(text(r), /tab\.ax\.write/);
    assert.equal(s.mcp.executor.worker, null);
    for (const topic of HELP_TOPICS) {
      const r = await help(s.client, { topic });
      assert.equal(r.isError, false, topic);
      assert.ok(r.structuredContent.versions.server);
      assert.ok(r.structuredContent.versions.bundledSdk);
      if (Object.hasOwn(TOPIC_DOCUMENTS, topic)) {
        const original = await fs.readFile(
          new URL(
            `../vendor/openai/26.928.21956/docs/${TOPIC_DOCUMENTS[topic]}.md`,
            import.meta.url,
          ),
          "utf8",
        );
        assert.equal(text(r), original);
      }
    }
    assert.equal(s.mcp.executor.worker, null);
  } finally {
    await s.close();
  }
});

test("help 입력 오류에는 유효한 다음 호출을 안내한다", async () => {
  for (const args of [
    { topic: "ax", api: "tab.goto" },
    { topic: "unknown" },
    { api: "../../private" },
    { api: "tab.doesNotExist" },
    { topic: "../../package" },
    { topic: "__proto__" },
    { topic: "constructor" },
  ]) {
    const r = getHelp(args);
    assert.equal(r.isError, true);
    assert.match(text(r), /browser_help/);
    assert.ok(r.structuredContent.related.length);
  }
  const r = getHelp({ api: "tab.ax.write" });
  assert.equal(r.isError, false);
  assert.equal(r.structuredContent.topic, "api");
  assert.match(text(r), /disableDiffing/);
  assert.match(text(r), /write\(/);
  assert.match(text(r), /Promise<void>/);
  assert.equal(getHelp({ api: "tab.getAXState" }).isError, true);
});

test("API 색인은 원본 manifest의 인자·참조형만 반환한다", () => {
  const r = getHelp({ topic: "api" });
  assert.equal(r.isError, false);
  assert.ok(r.structuredContent.groups.includes("tab.playwright"));
  const group = getHelp({ api: "tab.playwright" });
  assert.ok(group.structuredContent.apis.includes("tab.playwright.getByRole"));
  const method = getHelp({ api: "tab.playwright.getByRole" });
  assert.match(text(method), /role: string/);
  assert.match(text(method), /exact\?: boolean/);
  assert.match(text(method), /TextMatcher/);
  assert.match(text(getHelp({ api: "tab.ax.click" })), /AXMouseButton =/);
  assert.equal(getHelp({ api: "tab.click" }).isError, true);
  assert.equal(getHelp({ api: "browser.capabilities.list" }).isError, false);
  assert.equal(getHelp({ api: "browser.tabs.content" }).isError, true);
  assert.equal(getHelp({ api: "browser.user.getTabContext" }).isError, true);
  assert.equal(getHelp({ api: "tab.playwright.elementInfo" }).isError, true);
  assert.equal(method.structuredContent.source, "sdk/api.json");
  assert.doesNotMatch(
    text(method),
    /For observation\/action order|Example \(reuse/,
  );
});

test("help는 기존 출력·변수·세션을 유지하고 오류에 자체 가이드를 추가하지 않는다", async () => {
  const broker = await startBroker({ port: 0, secret: "help-session" });
  const s = await connect({
    broker: `http://127.0.0.1:${broker.port}`,
    secret: broker.secret,
  });
  try {
    assert.equal(
      text(await js(s.client, "var helpValue=41; helpValue+1")),
      "42",
    );
    const worker = s.mcp.executor.worker;
    await help(s.client, { topic: "session" });
    assert.equal(s.mcp.executor.worker, worker);
    assert.equal(text(await js(s.client, "helpValue+1")), "42");
    const r = await js(s.client, 'nodeRepl.write("explicit"); 42');
    assert.deepEqual(r.content, [{ type: "text", text: "explicit" }]);
    // JPEG 캡처를 PNG로 잘못 표시하던 기존 응답의 회귀를 검증한다.
    const image = await js(
      s.client,
      "await nodeRepl.emitImage(new Uint8Array([255,216,255,224]));",
    );
    assert.equal(image.content[0].type, "image");
    assert.equal(image.content[0].mimeType, "image/jpeg");
    const png = await js(
      s.client,
      "await nodeRepl.emitImage(new Uint8Array([137,80,78,71,13,10,26,10]));",
    );
    assert.equal(png.content[0].mimeType, "image/png");
    const err = await js(
      s.client,
      'nodeRepl.write("before");throw Error("Accessibility element 42 is stale or missing")',
    );
    assert.equal(err.isError, true);
    assert.equal(err.content[0].text, "before");
    assert.match(err.content[1].text, /Accessibility element 42/);
    assert.equal(err.content.length, 2);
    const unknown = await js(s.client, 'throw Error("unclassified-test")');
    assert.equal(unknown.isError, true);
    assert.equal(unknown.content.length, 1);
    const timeout = await js(s.client, "while(true) {}", { timeout_ms: 100 });
    assert.equal(timeout.isError, true);
    assert.match(timeout.content[0].text, /timed out/);
    assert.equal(timeout.content.length, 1);
    await help(s.client);
    assert.equal(text(await js(s.client, "typeof helpValue")), "undefined");
    await s.client.callTool({ name: "browser_js_reset", arguments: {} });
    await help(s.client);
    assert.equal(s.mcp.executor.worker, null);
  } finally {
    await s.close();
    await broker.close();
  }
  const broken = await connect({ sdkUrl: "http://127.0.0.1:1/unavailable/" });
  try {
    const failure = await js(broken.client, "42");
    assert.equal(failure.isError, true);
    assert.equal((await help(broken.client)).isError, false);
  } finally {
    await broken.close();
  }
});

test("모든 원본 문서 응답은 보관된 원문과 같고 출처 해시를 보존한다", async () => {
  const origin = JSON.parse(
    await fs.readFile(
      new URL("../vendor/openai/26.928.21956/ORIGIN.json", import.meta.url),
      "utf8",
    ),
  );
  const listed = getHelp({ topic: "documents" });
  assert.deepEqual(listed.structuredContent.documents, DOCUMENT_NAMES);
  for (const name of DOCUMENT_NAMES) {
    const r = getHelp({ topic: name });
    const original = await fs.readFile(
      new URL(`../vendor/openai/26.928.21956/docs/${name}.md`, import.meta.url),
    );
    assert.equal(r.isError, false, name);
    assert.deepEqual(
      r.content,
      [{ type: "text", text: original.toString("utf8") }],
      name,
    );
    assert.equal(r.structuredContent.verbatim, true);
    assert.equal(
      r.structuredContent.source,
      `vendor/openai/26.928.21956/docs/${name}.md`,
    );
    const recorded = origin.files.find(
      (file) => file.file === `docs/${name}.md`,
    );
    assert.equal(
      createHash("sha256").update(original).digest("hex"),
      recorded.sha256,
      name,
    );
  }
});

test("README의 문서 조회 경로는 metadata와 일치한다", async () => {
  const readme = await fs.readFile(
    new URL("../README.md", import.meta.url),
    "utf8",
  );
  const block = readme.match(
    /<!-- browser-help:start -->\n([\s\S]*?)\n<!-- browser-help:end -->/,
  );
  assert.ok(block, "generated help section missing");
  assert.equal(block[1], renderReadmeHelp());
});
