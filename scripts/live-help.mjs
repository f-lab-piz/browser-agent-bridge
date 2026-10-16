// 격리된 테스트 확장에서 원본 문서 조회와 브라우저 회귀를 확인한다. 모델 평가는 별도다.
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { startBroker } from "../bridge/daemon.mjs";
// 자동 시험 전용 입력이며 에이전트 help에는 포함하지 않는다.
const QUICKSTART_EXAMPLES = {
  discover: "nodeRepl.write(await agent.browsers.list());",
  open: 'var browser = await agent.browsers.get("BROWSER_ID_FROM_LIST");\nvar tab = await browser.tabs.new();\nawait tab.goto("https://www.naver.com/");\nawait tab.getAXState();',
  full: "await tab.getAXState({ disableDiffing: true });",
  screenshot: "await tab.getScreenshot();",
};

const secret = process.env.BROWSER_BRIDGE_LIVE_TOKEN ?? "integration-test-only";
const broker = await startBroker({ port: 29651, secret });
const fixtureRoot = fileURLToPath(
  new URL("../tests/fixture/", import.meta.url),
);
const fixture = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const file = path.resolve(
    fixtureRoot,
    "." + (url.pathname === "/" ? "/index.html" : url.pathname),
  );
  if (!file.startsWith(fixtureRoot)) {
    res.writeHead(404);
    res.end();
    return;
  }
  try {
    res.setHeader(
      "content-type",
      file.endsWith(".png")
        ? "image/png"
        : file.endsWith(".txt")
          ? "text/plain"
          : "text/html",
    );
    res.end(await fs.readFile(file));
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((resolve) => fixture.listen(0, "127.0.0.1", resolve));
const fixtureUrl = `http://127.0.0.1:${fixture.address().port}/`;
const client = new Client({ name: "live-help-examples", version: "1" });
const transport = new StreamableHTTPClientTransport(
  new URL("http://127.0.0.1:29651/mcp"),
  { requestInit: { headers: { authorization: "Bearer " + secret } } },
);
const report = {
  date: new Date().toISOString(),
  purpose:
    "Original documentation lookup and browser regression through real MCP and isolated Chrome; not an external-model evaluation",
  results: [],
};
const created = [];
let browserId;
const output = new URL(
  "../docs/validation/original-help-live.json",
  import.meta.url,
);
async function record(name, tool, args, check = () => {}) {
  const result = await client.callTool(
    { name: tool, arguments: args },
    undefined,
    { timeout: 60000 },
  );
  const row = {
    name,
    tool,
    input: args,
    isError: !!result.isError,
    output: result.content.map((x) =>
      x.type === "image"
        ? {
            type: "image",
            mimeType: x.mimeType,
            bytes: Buffer.from(x.data, "base64").length,
            signature: Buffer.from(x.data, "base64")
              .subarray(0, 12)
              .toString("hex"),
          }
        : x,
    ),
  };
  report.results.push(row);
  await fs.writeFile(output, JSON.stringify(report, null, 2));
  assert.equal(
    result.isError,
    false,
    JSON.stringify(result.content).slice(0, 800),
  );
  check(result);
  row.verified = true;
  console.log("PASS", name);
  return result;
}
const run = (name, code, check) =>
  record(name, "browser_js", { code, timeout_ms: 45000 }, check);
const texts = (r) =>
  r.content.filter((x) => x.type === "text").map((x) => x.text);
const lastJson = (r) => JSON.parse(texts(r).at(-1));
const inputId = (state, label) => {
  const line = state
    .split("\n")
    .find(
      (x) =>
        x.includes("Description: " + label) &&
        /\b(?:text field|combo box)\b/.test(x),
    );
  assert.ok(line, `No observed editable control for ${label}`);
  return Number(line.match(/^\s*(\d+) /)[1]);
};
try {
  await fs.mkdir(new URL("../docs/validation/", import.meta.url), {
    recursive: true,
  });
  await client.connect(transport);
  assert.match(client.getInstructions(), /browser_help/);
  await record("help before browser discovery", "browser_help", {});
  console.log(
    "READY: waiting for the isolated Chrome extension (up to 60 seconds)",
  );
  for (let i = 0; i < 120; i++) {
    const r = await client.callTool({
      name: "browser_js",
      arguments: { code: QUICKSTART_EXAMPLES.discover },
    });
    assert.equal(r.isError, false);
    const all = lastJson(r);
    if (all.length) {
      assert.equal(all.length, 1, "Use exactly one isolated test extension");
      browserId = all[0].id;
      report.browser = all[0];
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.ok(browserId, "Extension did not connect");
  await run("quickstart discovery", QUICKSTART_EXAMPLES.discover, (r) =>
    assert.ok(lastJson(r).some((x) => x.id === browserId)),
  );
  const fixtureSetup = await run(
    "quickstart opens local fixture",
    QUICKSTART_EXAMPLES.open
      .replace("BROWSER_ID_FROM_LIST", browserId)
      .replace("https://www.naver.com/", fixtureUrl) +
      "\nnodeRepl.write({id:tab.id});",
    (r) => assert.match(texts(r)[0], /Browser Tool Audit/),
  );
  const fixtureId = lastJson(fixtureSetup).id;
  created.push(fixtureId);
  await record("original AX API declaration", "browser_help", {
    api: "tab.ax.setValue",
  });
  const observed = await run("fresh full AX", QUICKSTART_EXAMPLES.full);
  const nameId = inputId(texts(observed)[0], "Name");
  await run(
    "observed AX input then verification",
    `await tab.setValue(${nameId},"Help verified");await tab.getAXState();`,
    (r) => assert.match(texts(r).join("\n"), /Help verified/),
  );
  await run(
    "default diff or unchanged observation",
    "await tab.getAXState();",
    (r) => assert.match(texts(r)[0], /diff|no change/i),
  );
  await run(
    "complete observation after diff",
    QUICKSTART_EXAMPLES.full,
    (r) => {
      assert.match(texts(r)[0], /Help verified/);
      assert.match(texts(r)[0], /AXWebArea/);
    },
  );
  await run(
    "screenshot emitted as image",
    QUICKSTART_EXAMPLES.screenshot,
    (r) =>
      assert.ok(
        r.content.some(
          (x) =>
            x.type === "image" &&
            ((x.mimeType === "image/png" &&
              Buffer.from(x.data, "base64").subarray(1, 4).toString() ===
                "PNG") ||
              (x.mimeType === "image/jpeg" &&
                Buffer.from(x.data, "base64").subarray(0, 3).toString("hex") ===
                  "ffd8ff")),
        ),
        JSON.stringify(
          r.content
            .filter((x) => x.type === "image")
            .map((x) => ({
              mimeType: x.mimeType,
              signature: Buffer.from(x.data, "base64")
                .subarray(0, 12)
                .toString("hex"),
            })),
        ),
      ),
  );
  await run(
    "facade inventory assignment does not emit",
    "var inventory=await cua.getState();",
    (r) => assert.deepEqual(r.content, [{ type: "text", text: "undefined" }]),
  );
  await run(
    "explicit facade inventory output",
    "nodeRepl.write(inventory.browsers.length);",
    (r) => assert.ok(Number(texts(r)[0]) >= 1),
  );
  await run(
    "retain a session variable",
    "var helpLiveValue=41;helpLiveValue+1;",
    (r) => assert.equal(texts(r)[0], "42"),
  );
  await record("session guide preserves live tab", "browser_help", {
    topic: "session",
  });
  await run(
    "binding survives help",
    "nodeRepl.write({value:helpLiveValue,id:tab.id});",
    (r) => assert.equal(lastJson(r).id, fixtureId),
  );
  await client.callTool({ name: "browser_js_reset", arguments: {} });
  await record("help after reset", "browser_help", {});
  await run("reset clears binding", "typeof tab;", (r) =>
    assert.equal(texts(r)[0], "undefined"),
  );
  await run(
    "rebind existing tab after reset",
    `var browser=await agent.browsers.get(${JSON.stringify(browserId)});var tab=await browser.tabs.get(${JSON.stringify(fixtureId)});await tab.getAXState();`,
    (r) => assert.match(texts(r)[0], /Help verified/),
  );
  const naver = await run(
    "quickstart opens Naver",
    QUICKSTART_EXAMPLES.open.replace("BROWSER_ID_FROM_LIST", browserId) +
      "\nnodeRepl.write({id:tab.id});",
    (r) => assert.match(texts(r)[0], /NAVER/),
  );
  created.push(lastJson(naver).id);
  const naverState = await run(
    "observe Naver search control",
    QUICKSTART_EXAMPLES.full,
  );
  const searchId = inputId(texts(naverState)[0], "검색어를 입력해 주세요.");
  await run(
    "fill observed Naver search",
    `await tab.setValue(${searchId},"브라우저 MCP");await tab.getAXState();`,
  );
  const updated = await run(
    "fresh full state before submit",
    QUICKSTART_EXAMPLES.full,
  );
  const currentSearchId = inputId(texts(updated)[0], "검색어를 입력해 주세요.");
  await run(
    "submit and verify Naver results",
    `await tab.pressKey(${currentSearchId},"Return");await tab.getAXState();`,
    (r) => {
      assert.match(texts(r)[0], /search\.naver\.com/);
      assert.match(texts(r)[0], /브라우저 MCP/);
    },
  );
  report.completedAt = new Date().toISOString();
  console.log("PASS", report.results.length, "guide cases");
} finally {
  if (browserId)
    for (const id of created)
      await client
        .callTool({
          name: "browser_js",
          arguments: {
            code: `await (await (await agent.browsers.get(${JSON.stringify(browserId)})).tabs.get(${JSON.stringify(id)})).close();`,
          },
        })
        .catch(() => {});
  await fs.writeFile(output, JSON.stringify(report, null, 2));
  await transport.terminateSession().catch(() => {});
  await client.close().catch(() => {});
  await broker.close();
  await new Promise((resolve) => {
    fixture.close(resolve);
    fixture.closeAllConnections();
  });
}
