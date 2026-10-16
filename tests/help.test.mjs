import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createBrowserMcp } from "../bridge/mcp-server.mjs";
import { startBroker } from "../bridge/daemon.mjs";
import { getHelp, recoveryHint } from "../bridge/help.mjs";
import {
  HELP_TOPICS,
  FACADE_APIS,
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
    assert.match(text(r), /agent\.browsers\.list/);
    assert.match(text(r), /getAXState/);
    assert.match(text(r), /remote|custom/i);
    assert.equal(s.mcp.executor.worker, null);
    for (const topic of HELP_TOPICS) {
      const r = await help(s.client, { topic });
      assert.equal(r.isError, false, topic);
      assert.ok(r.structuredContent.versions.server);
      assert.ok(r.structuredContent.versions.bundledSdk);
      assert.ok(text(r).includes(r.structuredContent.versions.bundledSdk));
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
  ]) {
    const r = getHelp(args);
    assert.equal(r.isError, true);
    assert.match(text(r), /browser_help/);
    assert.ok(r.structuredContent.related.length);
  }
  const r = getHelp({ api: "tab.getAXState" });
  assert.equal(r.isError, false);
  assert.equal(r.structuredContent.topic, "api");
  assert.match(text(r), /disableDiffing/);
  assert.match(text(r), /emit/);
  assert.match(text(r), /Promise<string>/);
  assert.match(text(r), /getAXState\(/);
});

test("API 색인은 namespace별이며 manifest의 실제 인자·참조형을 반환한다", () => {
  const r = getHelp({ topic: "api" });
  assert.equal(r.isError, false);
  assert.ok(r.structuredContent.groups.includes("tab.playwright"));
  const group = getHelp({ api: "tab.playwright" });
  assert.ok(group.structuredContent.apis.includes("tab.playwright.getByRole"));
  const method = getHelp({ api: "tab.playwright.getByRole" });
  assert.match(text(method), /role: string/);
  assert.match(text(method), /exact\?: boolean/);
  assert.match(text(method), /TextMatcher/);
  assert.match(text(getHelp({ api: "tab.click" })), /AXMouseButton =/);
  assert.match(
    text(getHelp({ api: "tab.markDeliverable" })),
    /stores a mark only/,
  );
  assert.equal(getHelp({ api: "browser.capabilities.list" }).isError, false);
  assert.equal(getHelp({ api: "browser.tabs.content" }).isError, true);
  assert.equal(getHelp({ api: "browser.user.getTabContext" }).isError, true);
  assert.equal(getHelp({ api: "tab.playwright.elementInfo" }).isError, true);
  const source = fs.readFile(
    new URL("../sdk/browser.mjs", import.meta.url),
    "utf8",
  );
  return source.then((s) => {
    const tabMethods = [
      ...s
        .slice(
          s.indexOf("function decorateTab"),
          s.indexOf("const agent = createOriginalAgent"),
        )
        .matchAll(/(?:async\s+)?(\w+)(?:\(options = \{\}\)|:\s*\(\.\.\.a\))/g),
    ].map((x) => "tab." + x[1]);
    const cuaMethods = [
      ...s
        .slice(s.indexOf("const cua = {"), s.indexOf("return {\n    agent,"))
        .matchAll(/async\s+(\w+)\(/g),
    ].map((x) => "cua." + x[1]);
    assert.ok(tabMethods.length >= 12);
    assert.equal(cuaMethods.length, 6);
    for (const api of [...tabMethods, ...cuaMethods]) {
      assert.ok(Object.hasOwn(FACADE_APIS, api), api);
      assert.equal(getHelp({ api }).isError, false, api);
    }
  });
});

test("help는 기존 출력·변수·세션을 유지하고 SDK 실패 시에도 복구 안내를 제공한다", async () => {
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
    assert.match(err.content[2].text, /browser_help.*ax/);
    const unknown = await js(s.client, 'throw Error("unclassified-test")');
    assert.equal(unknown.isError, true);
    assert.equal(unknown.content.length, 1);
    const timeout = await js(s.client, "while(true) {}", { timeout_ms: 100 });
    assert.equal(timeout.isError, true);
    assert.match(timeout.content[0].text, /timed out/);
    assert.match(timeout.content[1].text, /browser_help.*session/);
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

test("원본 오류를 바꾸지 않고 알려진 오류만 관련 help로 연결한다", () => {
  assert.match(recoveryHint("ReferenceError: tab is not defined"), /session/);
  assert.match(
    recoveryHint("Browser is not available: chrome"),
    /troubleshooting/,
  );
  assert.match(
    recoveryHint("Tab 1 is leased by another agent session"),
    /session/,
  );
  assert.match(recoveryHint("Uploads are disabled"), /troubleshooting/);
  assert.equal(recoveryHint("arbitrary application error"), null);
});

test("README 안내는 공통 가이드 원본과 일치한다", async () => {
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
