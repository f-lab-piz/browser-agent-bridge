import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { startBroker } from "../bridge/daemon.mjs";
import { fileURLToPath } from "node:url";
async function stdio() {
  const client = new Client({ name: "stdio-test", version: "1" });
  let log = "";
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [
      fileURLToPath(new URL("../bridge/cli.mjs", import.meta.url)),
      "--transport",
      "stdio",
    ],
    env: { BROWSER_BRIDGE_TOKEN: "stdio-test-only" },
    stderr: "pipe",
  });
  transport.stderr.on("data", (b) => (log += b));
  await client.connect(transport);
  return {
    client,
    transport,
    get log() {
      return log;
    },
    get port() {
      return Number(
        log.match(/Extension endpoint: ws:\/\/127.0.0.1:(\d+)/)?.[1],
      );
    },
  };
}
const call = (client, code) =>
  client.callTool({ name: "browser_js", arguments: { code } });
test("실제 stdio 자식 프로세스: bundled SDK·상태 유지·HTTP와 도구 동일·복수 포트·EOF 정리", async () => {
  const http = await startBroker({ port: 0, secret: "http-test" }),
    httpClient = new Client({ name: "http-test", version: "1" });
  let a, b;
  try {
    await httpClient.connect(
      new StreamableHTTPClientTransport(
        new URL(`http://127.0.0.1:${http.port}/mcp`),
        { requestInit: { headers: { authorization: "Bearer http-test" } } },
      ),
    );
    a = await stdio();
    b = await stdio();
    assert.notEqual(a.port, b.port);
    assert.equal(
      (
        await fetch(`http://127.0.0.1:${a.port}/mcp`, {
          headers: { authorization: "Bearer stdio-test-only" },
        })
      ).status,
      404,
    );
    assert.ok(a.port >= 29652 && a.port <= 29660);
    assert.deepEqual(
      (await a.client.listTools()).tools,
      (await httpClient.listTools()).tools,
    );
    assert.equal(a.client.getInstructions(), httpClient.getInstructions());
    assert.deepEqual(
      await a.client.callTool({
        name: "browser_help",
        arguments: { api: "tab.getAXState" },
      }),
      await httpClient.callTool({
        name: "browser_help",
        arguments: { api: "tab.getAXState" },
      }),
    );
    let r = await call(
      a.client,
      "const number=await Promise.resolve(7);number*6",
    );
    assert.equal(r.isError, false, JSON.stringify(r));
    assert.equal(r.content[0].text, "42");
    r = await call(a.client, 'process.stdout.write("worker-output\\n"); 42');
    assert.equal(r.isError, false);
    assert.equal(r.content[0].text, "42");
    r = await call(a.client, "number+1");
    assert.equal(r.content[0].text, "8");
    r = await call(b.client, "typeof number");
    assert.equal(r.content[0].text, "undefined");
    r = await call(a.client, "await agent.browsers.list()");
    assert.equal(r.isError, false, JSON.stringify(r));
    assert.match(a.log, /SDK: bundled/);
    await a.client.callTool({ name: "browser_js_reset", arguments: {} });
    r = await call(a.client, "typeof number");
    assert.equal(r.content[0].text, "undefined");
    const pid = a.transport.pid;
    await a.client.close();
    for (let i = 0; i < 100; i++) {
      try {
        process.kill(pid, 0);
      } catch {
        break;
      }
      await new Promise((r) => setTimeout(r, 20));
    }
    assert.throws(() => process.kill(pid, 0));
    const socket = net.connect({ host: "127.0.0.1", port: a.port });
    await new Promise((resolve, reject) => {
      socket.once("error", resolve);
      socket.once("connect", () => {
        socket.destroy();
        reject(Error("stdio endpoint survived EOF"));
      });
    });
  } finally {
    await a?.client.close();
    await b?.client.close();
    await httpClient.close();
    await http.close();
  }
});
