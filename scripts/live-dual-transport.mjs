// 별도 Chrome for Testing과 연결하는 실제 HTTP·stdio 혼용 시험. Python은 실행하지 않는다.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { startBroker } from "../bridge/daemon.mjs";
import fs from "node:fs/promises";
import http from "node:http";
import { fileURLToPath } from "node:url";
const clients = [],
  results = [],
  token = "integration-test-only";
const broker = await startBroker({ port: 29651, secret: token });
const fixture = http.createServer(async (req, res) => {
  try {
    const name = new URL(req.url, "http://localhost").pathname;
    const file = new URL(
      "../tests/fixture/" + (name === "/" ? "index.html" : name.slice(1)),
      import.meta.url,
    );
    if (!file.pathname.includes("/tests/fixture/")) throw Error("bad path");
    res.setHeader(
      "content-type",
      name.endsWith(".png")
        ? "image/png"
        : name.endsWith(".txt")
          ? "text/plain"
          : "text/html",
    );
    res.end(await fs.readFile(file));
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => fixture.listen(29661, "127.0.0.1", r));
async function connect(kind) {
  const client = new Client({ name: "live-" + kind, version: "1" });
  let log = "";
  const transport =
    kind === "http"
      ? new StreamableHTTPClientTransport(
          new URL("http://127.0.0.1:29651/mcp"),
          { requestInit: { headers: { authorization: "Bearer " + token } } },
        )
      : new StdioClientTransport({
          command: process.execPath,
          args: [
            fileURLToPath(new URL("../bridge/cli.mjs", import.meta.url)),
            "--transport",
            "stdio",
          ],
          env: { BROWSER_BRIDGE_TOKEN: token },
          stderr: "pipe",
        });
  transport.stderr?.on("data", (b) => (log += b));
  await client.connect(transport);
  const entry = {
    client,
    transport,
    kind,
    get port() {
      return Number(
        log.match(/Extension endpoint: ws:\/\/127.0.0.1:(\d+)/)?.[1],
      );
    },
  };
  clients.push(entry);
  return entry;
}
async function run(client, name, code, expectedError = false) {
  const r = await client.callTool(
    { name: "browser_js", arguments: { code, timeout_ms: 15000 } },
    undefined,
    { timeout: 20000 },
  );
  const row = {
    name,
    code,
    expectedError,
    status: !!r.isError === expectedError ? "SUCCESS" : "ERROR",
    output: r.content.map((x) =>
      x.type === "image"
        ? { type: "image", mimeType: x.mimeType, base64Length: x.data.length }
        : x,
    ),
  };
  results.push(row);
  await fs.mkdir("docs/validation", { recursive: true });
  await fs.writeFile(
    "docs/validation/dual-transport-live.json",
    JSON.stringify({ pythonHost: false, results }, null, 2),
  );
  console.log(row.status, name);
  if (row.status === "ERROR")
    throw Error(JSON.stringify(r.content).slice(0, 600));
  if (expectedError && !JSON.stringify(r).includes("leased"))
    throw Error("Expected a lease rejection");
  return r;
}
async function paired(entry) {
  for (let i = 0; i < 150; i++) {
    const r = await entry.client.callTool({
      name: "browser_js",
      arguments: { code: "(await agent.browsers.list()).length" },
    });
    if (r.content[0]?.text === "1") return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw Error("Chrome extension did not connect");
}
try {
  const h = await connect("http"),
    a = await connect("stdio-a"),
    b = await connect("stdio-b");
  console.log(
    "READY: open isolated Chrome extension; HTTP " +
      broker.port +
      ", stdio " +
      a.port +
      "," +
      b.port,
  );
  await Promise.all([h, a, b].map(paired));
  await run(
    h.client,
    "HTTP bundled SDK AX",
    'const browser=await agent.browsers.get("chrome");const tab=await browser.tabs.new();await tab.goto("http://127.0.0.1:29661/");await tab.playwright.waitForLoadState({state:"load"});nodeRepl.write((await tab.getAXState({emit:false})).includes("Browser Tool Audit"));',
  );
  const setup = await run(
    a.client,
    "stdio A navigation and AX",
    'const browser=await agent.browsers.get("chrome");const tab=await browser.tabs.new();await tab.goto("http://127.0.0.1:29661/");await tab.playwright.waitForLoadState({state:"load"});nodeRepl.write({id:tab.id,axLength:(await tab.getAXState({emit:false})).length});',
  );
  const aid = JSON.parse(setup.content[0].text).id;
  await run(
    a.client,
    "stdio persistent locator",
    'await tab.playwright.getByLabel("Name",{exact:true}).fill("stdio-native");nodeRepl.write(await tab.playwright.evaluate(()=>document.querySelector("#name").value));',
  );
  await run(
    a.client,
    "stdio screenshot",
    "await nodeRepl.emitImage(await tab.screenshot({fullPage:false}));",
  );
  await run(
    a.client,
    "stdio WebMCP",
    'const webmcp=await tab.capabilities.get("webmcp");const tools=await webmcp.fetchTools();const toolName=tools.description().match(/"name": "([^"]+)"/)[1];nodeRepl.write(await tools.call(toolName,{text:"stdio-WebMCP"}));',
  );
  await run(
    b.client,
    "stdio B cross-process lease",
    'const browser=await agent.browsers.get("chrome");const foreign=await browser.tabs.get(' +
      JSON.stringify(aid) +
      ");await foreign.getAXState();",
    true,
  );
  await run(
    h.client,
    "HTTP versus stdio lease",
    "const foreign=await browser.tabs.get(" +
      JSON.stringify(aid) +
      ");await foreign.getAXState();",
    true,
  );
  const isolated = await run(
    b.client,
    "stdio B independent tab",
    'const tab=await browser.tabs.new();await tab.goto("http://127.0.0.1:29661/next.html");await tab.playwright.waitForLoadState({state:"load"});nodeRepl.write({id:tab.id,title:await tab.title()});',
  );
  const bid = JSON.parse(isolated.content[0].text).id;
  await a.client.callTool({ name: "browser_js_reset", arguments: {} });
  await run(
    b.client,
    "reset releases cross-process lease",
    'await foreign.getAXState({emit:false});nodeRepl.write("acquired after reset");',
  );
  const oldPort = b.port;
  await b.client.close();
  await run(
    h.client,
    "EOF releases tab for HTTP",
    'await foreign.getAXState({emit:false});nodeRepl.write("acquired after EOF");',
  );
  const c = await connect("stdio-c");
  await paired(c);
  if (c.port !== oldPort) throw Error("Released stdio port was not reused");
  await run(
    c.client,
    "stdio port reuse and isolated variables",
    "nodeRepl.write({oldTabType:typeof tab,browserCount:(await agent.browsers.list()).length});",
  );
  await run(
    h.client,
    "cleanup",
    "await foreign.close();await (await browser.tabs.get(" +
      JSON.stringify(bid) +
      ")).close();await tab.close();",
  );
  console.log(
    "PASS",
    results.length,
    "cases; HTTP + two stdio processes; no Python host",
  );
} finally {
  for (const entry of clients) {
    if (entry.kind === "http")
      await entry.transport.terminateSession().catch(() => {});
    await entry.client.close().catch(() => {});
  }
  await broker.close();
  await new Promise((r) => {
    fixture.close(r);
    fixture.closeAllConnections();
  });
}
