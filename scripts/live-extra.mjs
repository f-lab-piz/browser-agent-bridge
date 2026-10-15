import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import fs from "node:fs/promises";
const clients = [],
  results = [];
async function connect() {
  const client = new Client({ name: "bridge-extra-audit", version: "1" });
  const transport = new StreamableHTTPClientTransport(
    new URL("http://127.0.0.1:29651/mcp"),
    {
      requestInit: {
        headers: { authorization: "Bearer integration-test-only" },
      },
    },
  );
  await client.connect(transport);
  clients.push({ client, transport });
  return client;
}
const a = await connect(),
  b = await connect();
async function run(name, code, client = a, expectedError = false) {
  let r;
  try {
    r = await client.callTool(
      { name: "browser_js", arguments: { code, timeout_ms: 10000 } },
      undefined,
      { timeout: 15000 },
    );
  } catch (e) {
    r = { isError: true, content: [{ type: "text", text: e.message }] };
  }
  const row = {
    name,
    code,
    status: !!r.isError === expectedError ? "SUCCESS" : "ERROR",
    expectedError,
    output: r.content,
  };
  results.push(row);
  await fs.writeFile(
    "docs/validation/extra-live-results.json",
    JSON.stringify(results, null, 2),
  );
  console.log(
    row.status,
    name,
    row.status === "ERROR" ? JSON.stringify(r.content).slice(0, 160) : "",
  );
  return row;
}
try {
  await run(
    "setup",
    'const browser=await agent.browsers.get("chrome"); const tab=await browser.tabs.new(); await tab.goto("http://127.0.0.1:29653/"); await tab.playwright.waitForLoadState({state:"load"});',
  );
  await run(
    "browser.history",
    'nodeRepl.write(await browser.history({queries:["127.0.0.1:29653"],limit:3}));',
  );
  await run(
    "browser.nameSession",
    'await browser.nameSession("Bridge extra audit");',
  );
  await run(
    "browser.tabs.get",
    "nodeRepl.write((await browser.tabs.get(tab.id)).id);",
  );
  await run(
    "browser.tabs.selected",
    "nodeRepl.write((await browser.tabs.selected())?.id);",
  );
  await run(
    "browser.user.claimTab",
    "nodeRepl.write((await browser.user.claimTab(tab.id)).id);",
  );
  await run(
    "agent.documentation.get",
    'nodeRepl.write((await agent.documentation.get("accessibility")).slice(0,120));',
  );
  for (const [name, code] of Object.entries({
    "cua.listBrowsers": "nodeRepl.write(await cua.listBrowsers());",
    "cua.getBrowser":
      'nodeRepl.write((await cua.getBrowser({url:"http://127.0.0.1:29653/"})).browserId);',
    "cua.listTabs": "nodeRepl.write(await cua.listTabs());",
    "cua.getState": "nodeRepl.write(await cua.getState());",
    "cua.getTab":
      'nodeRepl.write((await cua.getTab(tab.id,{browser:"chrome"})).id);',
    "cua.createBrowserTab":
      'const facadeTab=await cua.createBrowserTab("chrome","http://127.0.0.1:29653/next.html",{visible:true}); await facadeTab.close();',
  }))
    await run(name, code);
  await run(
    "AX full before actions",
    "var ax=await tab.getAXState({emit:false,disableDiffing:true}); nodeRepl.write(ax);",
  );
  await run(
    "tab.setValue",
    'var nameId=Number(ax.match(/(\\d+) text field[^\\n]*Description: Name,/)[1]); await tab.setValue(nameId,"original typed");',
  );
  await run(
    "tab.selectText",
    'await tab.getAXState({emit:false}); await tab.selectText(nameId,"typed");',
  );
  await run(
    "tab.paste",
    'await tab.getAXState({emit:false}); await tab.paste(nameId,"pasted",{format:"text"});',
  );
  await run(
    "tab.pressKey",
    'await tab.getAXState({emit:false}); await tab.pressKey(nameId,"End");',
  );
  await run(
    "tab.typeText",
    'await tab.getAXState({emit:false}); await tab.typeText(nameId," added"); nodeRepl.write(await tab.playwright.evaluate(()=>document.querySelector("#name").value));',
  );
  await run(
    "tab.click",
    'ax=await tab.getAXState({emit:false,disableDiffing:true}); var incrementId=Number(ax.match(/(\\d+) button[^\\n]*Increment/)[1]); await tab.click(incrementId); nodeRepl.write(await tab.playwright.locator("#count").innerText());',
  );
  await run(
    "tab.performSecondaryAction",
    'ax=await tab.getAXState({emit:false,disableDiffing:true}); nodeRepl.write(ax.match(/[^\\n]*Details[^\\n]*/g)); var detailsId=Number(ax.match(/(\\d+)[^\\n]*Details[^\\n]*Actions: Expand/)[1]); await tab.performSecondaryAction(detailsId,"Expand");',
  );
  await run(
    "tab.scroll",
    'await tab.scroll([300,300],"down",0.2); await tab.scroll([300,300],"up",0.2);',
  );
  await run(
    "tab.drag",
    'await tab.playwright.getByText("Drag me",{exact:true}).click(); var rects=await tab.playwright.evaluate(()=>["drag","drop"].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})); await tab.drag(rects[0],rects[1]);',
  );
  await run(
    "locator.downloadMedia",
    'nodeRepl.write(await tab.playwright.getByRole("link",{name:"Download image",exact:true}).downloadMedia({timeoutMs:4000}));',
  );
  await run(
    "confirmDialog.dismiss",
    'await tab.playwright.getByRole("button",{name:"Confirm",exact:true}).click(); await tab.playwright.waitForTimeout(600); await (await tab.getJsDialog()).dismiss();',
  );
  await run(
    "promptDialog.dismiss",
    'await tab.playwright.getByRole("button",{name:"Prompt",exact:true}).click(); await tab.playwright.waitForTimeout(600); await (await tab.getJsDialog()).dismiss();',
  );
  await run(
    "webmcp.tools.call",
    'const wm=await tab.capabilities.get("webmcp"); const tools=await wm.fetchTools(); var toolName=tools.description().match(/"name": "([^"]+)"/)[1]; nodeRepl.write(await tools.call(toolName,{text:"bridge-native-WebMCP-verified"}));',
  );
  await run(
    "exportGsuite invalid URL rejects",
    'await tab.content.exportGsuite("pdf");',
    a,
    true,
  );
  await run(
    "exportYouTubeTranscript invalid URL rejects",
    "await tab.content.exportYouTubeTranscript();",
    a,
    true,
  );
  await run(
    "multi-agent conflicting tab rejects",
    'const browser=await agent.browsers.get("chrome"); const tab=await browser.tabs.get(' +
      JSON.stringify(
        (
          await a.callTool({
            name: "browser_js",
            arguments: { code: "tab.id" },
          })
        ).content[0].text,
      ) +
      "); await tab.getAXState();",
    b,
    true,
  );
  await run(
    "second agent independent tab",
    'const isolated=await browser.tabs.new(); await isolated.goto("http://127.0.0.1:29653/next.html"); await isolated.playwright.waitForLoadState({state:"load"}); nodeRepl.write(await isolated.title()); await isolated.close();',
    b,
  );
  await run("cleanup", "await tab.close();");
} finally {
  for (const { client, transport } of clients) {
    await transport.terminateSession();
    await client.close();
  }
}
console.log(
  "Totals",
  Object.fromEntries(
    Object.entries(Object.groupBy(results, (r) => r.status)).map(([k, v]) => [
      k,
      v.length,
    ]),
  ),
);
