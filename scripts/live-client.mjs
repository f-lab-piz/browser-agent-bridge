import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import fs from "node:fs/promises";
const client = new Client({ name: "browser-bridge-qa", version: "1" });
const transport = new StreamableHTTPClientTransport(
  new URL("http://127.0.0.1:29651/mcp"),
  {
    requestInit: { headers: { authorization: "Bearer integration-test-only" } },
  },
);
await client.connect(transport);
const code = process.argv[2] ?? "await agent.browsers.list()";
const r = await client.callTool({
  name: "browser_js",
  arguments: { code, timeout_ms: 30000 },
});
console.log(JSON.stringify(r, null, 2));
await transport.terminateSession();
await client.close();
