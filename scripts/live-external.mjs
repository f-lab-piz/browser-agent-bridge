// 외부 서비스 결과는 계정/문서/자막 상태에 의존한다. 실행은 선택 사항이다.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import fs from "node:fs/promises";
const client = new Client({ name: "bridge-external-audit", version: "1" }),
  transport = new StreamableHTTPClientTransport(
    new URL("http://127.0.0.1:29651/mcp"),
    {
      requestInit: {
        headers: { authorization: "Bearer integration-test-only" },
      },
    },
  );
await client.connect(transport);
const results = [];
async function run(name, code) {
  const result = await client.callTool(
    { name: "browser_js", arguments: { code, timeout_ms: 45000 } },
    undefined,
    { timeout: 55000 },
  );
  results.push({
    name,
    code,
    status: result.isError ? "ERROR" : "SUCCESS",
    output: result.content,
  });
  await fs.writeFile(
    "docs/validation/external-live-results.json",
    JSON.stringify(results, null, 2),
  );
  console.log(
    name,
    result.isError ? "ERROR" : "SUCCESS",
    JSON.stringify(result.content).slice(0, 200),
  );
}
try {
  await run(
    "setup",
    'const browser=await agent.browsers.get("chrome"); const tab=await browser.tabs.new();',
  );
  await run(
    "tab.content.exportGsuite",
    'await tab.goto("https://docs.google.com/document/d/13AqyUalAwMxgwdANpVom4fHqEvm1T9soHVrp7DO2-Do/edit"); await tab.playwright.waitForLoadState({state:"load",timeoutMs:15000}); nodeRepl.write(await tab.content.exportGsuite("pdf"));',
  );
  await run(
    "tab.content.exportYouTubeTranscript",
    'await tab.goto("https://www.youtube.com/watch?v=iG9CE55wbtY"); await tab.playwright.waitForLoadState({state:"load",timeoutMs:15000}); nodeRepl.write(await tab.content.exportYouTubeTranscript());',
  );
  await run(
    "beforeUnloadDialog.dismiss observation",
    'await tab.goto("http://127.0.0.1:29653/unload.html"); await tab.playwright.getByRole("button",{name:"Arm",exact:true}).click(); await tab.playwright.getByRole("button",{name:"Leave delayed",exact:true}).click(); await tab.playwright.waitForTimeout(900); nodeRepl.write({url:await tab.url(),dialog:await tab.getJsDialog()});',
  );
  await run("cleanup", "await tab.close();");
} finally {
  await transport.terminateSession();
  await client.close();
}
