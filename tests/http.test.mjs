import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { startBroker } from "../bridge/daemon.mjs";
test("HTTP MCP의 JavaScript 변수 유지와 에이전트 세션 격리", async () => {
  const broker = await startBroker({ port: 0, secret: "test-token" });
  let a, b;
  try {
    async function client() {
      const c = new Client({ name: "test", version: "1" });
      await c.connect(
        new StreamableHTTPClientTransport(
          new URL(`http://127.0.0.1:${broker.port}/mcp`),
          { requestInit: { headers: { authorization: "Bearer test-token" } } },
        ),
      );
      return c;
    }
    a = await client();
    b = await client();
    const tools = await a.listTools();
    assert.deepEqual(
      tools.tools.map((t) => t.name),
      ["browser_js", "browser_js_reset"],
    );
    let r = await a.callTool({
      name: "browser_js",
      arguments: {
        code: "const value = await Promise.resolve(41); value + 1;",
      },
    });
    assert.equal(r.isError, false, JSON.stringify(r));
    assert.match(JSON.stringify(r), /42/);
    r = await a.callTool({
      name: "browser_js",
      arguments: { code: "value + 2" },
    });
    assert.match(JSON.stringify(r), /43/);
    r = await b.callTool({
      name: "browser_js",
      arguments: { code: "typeof value" },
    });
    assert.match(JSON.stringify(r), /undefined/);
    r = await a.callTool({
      name: "browser_js",
      arguments: {
        code: 'nodeRepl.write("출력"); await agent.browsers.list();',
      },
    });
    assert.equal(r.isError, false, JSON.stringify(r));
    assert.match(JSON.stringify(r), /출력/);
    r = await a.callTool({
      name: "browser_js",
      arguments: { code: "while(true) {}", timeout_ms: 100 },
    });
    assert.equal(r.isError, true);
    assert.match(JSON.stringify(r), /timed out/);
    r = await a.callTool({
      name: "browser_js",
      arguments: { code: "typeof value" },
    });
    assert.equal(r.isError, false);
    assert.match(JSON.stringify(r), /undefined/);
    r = await a.callTool({ name: "browser_js_reset", arguments: {} });
    assert.match(JSON.stringify(r), /reset/);
    r = await a.callTool({
      name: "browser_js",
      arguments: { code: "typeof value" },
    });
    assert.match(JSON.stringify(r), /undefined/);
  } finally {
    await a?.close();
    await b?.close();
    await broker.close();
  }
});
