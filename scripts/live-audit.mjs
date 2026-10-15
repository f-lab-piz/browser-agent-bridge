import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import fs from "node:fs/promises";
const client = new Client({ name: "browser-bridge-full-audit", version: "1" }),
  transport = new StreamableHTTPClientTransport(
    new URL("http://127.0.0.1:29651/mcp"),
    {
      requestInit: {
        headers: { authorization: "Bearer integration-test-only" },
      },
    },
  );
await client.connect(transport);
await fs.mkdir("docs/validation", { recursive: true });
const results = [];
async function run(name, code) {
  let result;
  try {
    result = await client.callTool(
      { name: "browser_js", arguments: { code, timeout_ms: 8000 } },
      undefined,
      { timeout: 15000 },
    );
  } catch (e) {
    result = { isError: true, content: [{ type: "text", text: e.message }] };
  }
  const row = {
    name,
    code,
    status: result.isError ? "ERROR" : "SUCCESS",
    output: result.content.map((x) =>
      x.type === "image"
        ? {
            type: x.type,
            mimeType: x.mimeType,
            bytes: Math.floor((x.data.length * 3) / 4),
          }
        : x,
    ),
  };
  results.push(row);
  await fs.writeFile(
    "docs/validation/current-live-results.json",
    JSON.stringify(results, null, 2),
  );
  console.log(
    row.status,
    name,
    row.status === "ERROR" ? JSON.stringify(row.output).slice(0, 180) : "",
  );
  return row;
}
try {
  const setupResult = await run(
    "setup",
    'const browser = await agent.browsers.get("chrome"); const tab = await browser.tabs.new(); await tab.goto("http://127.0.0.1:29653/");',
  );
  if (setupResult.status === "ERROR")
    throw Error("Fixture setup failed; audit stopped.");
  const catalog = JSON.parse(
    await fs.readFile("docs/audit-catalog.json", "utf8"),
  );
  const examples = JSON.parse(
    await fs.readFile("tests/audit-examples.json", "utf8"),
  );
  const simple = new Set([
    "agent.browsers.list",
    "browser.documentation",
    "browser.tabs.list",
    "browser.user.openTabs",
    "tab.title",
    "tab.url",
    "tab.playwright.domSnapshot",
    "tab.playwright.evaluate",
    "tab.clipboard.read",
    "tab.clipboard.readText",
    "tab.clipboard.write",
    "tab.clipboard.writeText",
    "tab.dev.logs",
    "browser.capabilities.list",
    "browser.capabilities.get",
    "tab.capabilities.list",
    "tab.capabilities.get",
    "viewport.documentation",
    "viewport.set",
    "viewport.reset",
    "visibility.documentation",
    "visibility.get",
    "visibility.set",
    "pageAssets.documentation",
    "pageAssets.list",
    "pageAssets.bundle",
    "webmcp.documentation",
    "webmcp.fetchTools",
    "webmcp.tools.description",
    "tab.getAXState",
    "tab.getAXStateAndScreenshot",
    "tab.getScreenshot",
    "tab.screenshot",
  ]);
  for (const row of catalog) {
    if (
      !simple.has(row.name) &&
      !row.name.startsWith("locator.") &&
      !row.name.startsWith("frame.") &&
      ![
        "tab.playwright.frameLocator",
        "tab.playwright.getByLabel",
        "tab.playwright.getByPlaceholder",
        "tab.playwright.getByRole",
        "tab.playwright.getByTestId",
        "tab.playwright.getByText",
        "tab.playwright.locator",
      ].includes(row.name)
    )
      continue;
    if (row.name === "locator.downloadMedia") continue;
    const old = examples[row.name];
    let code = old.replace(
      /nodeRepl\.write\(result\);/g,
      'nodeRepl.write({kind: result === undefined ? "undefined" : typeof result, value: result === null || ["string","boolean","number"].includes(typeof result) ? result : undefined, length: Array.isArray(result) || result instanceof Uint8Array ? result.length : undefined});',
    );
    if (
      row.name === "tab.screenshot" ||
      row.name === "tab.getScreenshot" ||
      row.name === "tab.getAXStateAndScreenshot"
    )
      code = code
        .replace(
          "const result = await tab.getScreenshot();",
          "const result = await tab.getScreenshot({emit:false});",
        )
        .replace(
          "tab.getAXStateAndScreenshot()",
          "tab.getAXStateAndScreenshot({emit:false})",
        );
    await run(row.name, code);
  }
  await run(
    "tab.playwright.waitForTimeout",
    "await tab.playwright.waitForTimeout(1);",
  );
  await run(
    "tab.playwright.waitForLoadState",
    'await tab.playwright.waitForLoadState({state:"load",timeoutMs:1000});',
  );
  await run(
    "tab.playwright.waitForURL",
    'await tab.playwright.waitForURL("http://127.0.0.1:29653/",{timeoutMs:1000});',
  );
  await run(
    "AX actions",
    'const state=await tab.getAXState({emit:false,disableDiffing:true}); const nameIndex=Number(state.match(/(\\d+) text field[^\\n]*Description: Name,/)[1]); await tab.setValue(nameIndex,"AX value"); await tab.getAXState({emit:false}); await tab.typeText(nameIndex," typed"); await tab.pressKey(nameIndex,"End"); await tab.getAXState({emit:false});',
  );
  await run(
    "file chooser",
    'const chooserPromise=tab.playwright.waitForEvent("filechooser",{timeoutMs:3000}); await tab.playwright.getByRole("button",{name:"Upload single",exact:true}).click(); const chooser=await chooserPromise; nodeRepl.write(chooser.isMultiple()); await chooser.setFiles(["' +
      process.cwd() +
      '/tests/fixture/sample.txt"]);',
  );
  await run(
    "download",
    'const downloadPromise=tab.playwright.waitForEvent("download",{timeoutMs:4000}); await tab.playwright.getByRole("link",{name:"Download sample",exact:true}).click(); const download=await downloadPromise; nodeRepl.write(await download.path());',
  );
  await run(
    "confirm dialog",
    'await tab.playwright.getByRole("button",{name:"Confirm",exact:true}).click(); await tab.playwright.waitForTimeout(600); const confirmDialog=await tab.getJsDialog(); nodeRepl.write(confirmDialog?.type); await confirmDialog.accept();',
  );
  await run(
    "prompt dialog",
    'await tab.playwright.getByRole("button",{name:"Prompt",exact:true}).click(); await tab.playwright.waitForTimeout(600); const promptDialog=await tab.getJsDialog(); await promptDialog.accept("Bridge prompt");',
  );
  await run(
    "alert dialog",
    'await tab.playwright.getByRole("button",{name:"Alert",exact:true}).click(); await tab.playwright.waitForTimeout(600); const alertDialog=await tab.getJsDialog(); await alertDialog.dismiss();',
  );
  await run(
    "navigation",
    'await tab.playwright.expectNavigation(()=>tab.playwright.getByRole("button",{name:"Next page",exact:true}).click(),{url:"http://127.0.0.1:29653/next.html",timeoutMs:2500}); await tab.back(); await tab.forward(); await tab.reload(); await tab.back();',
  );
  await run(
    "mark lifecycle",
    "await tab.markHandoff(); await tab.markDeliverable();",
  );
  await run(
    "screenshot artifact",
    "await nodeRepl.emitImage(await tab.screenshot({fullPage:false}));",
  );
  await run("cleanup", "await tab.close();");
} finally {
  await transport.terminateSession();
  await client.close();
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
