#!/usr/bin/env node
// 하나의 실행 파일에서 MCP transport만 선택한다. stdout은 stdio 프로토콜 전용이다.
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { startBroker } from "./daemon.mjs";
import { createBrowserMcp } from "./mcp-server.mjs";
import { token } from "./config.mjs";
import { DISCOVERY_PORTS } from "../extension/connections.mjs";
export async function main(args = process.argv.slice(2)) {
  const { values } = parseArgs({
    args,
    options: {
      transport: { type: "string", default: "http" },
      port: { type: "string" },
      "sdk-url": { type: "string" },
      "allow-uploads": { type: "boolean" },
      "allow-history": { type: "boolean" },
      help: { type: "boolean" },
      pair: { type: "boolean" },
    },
  });
  if (values.help) {
    console.error(
      "browser-agent-bridge --transport http|stdio [--port auto|PORT] [--sdk-url URL] [--allow-uploads] [--allow-history] [--pair]",
    );
    return;
  }
  if (values.pair) {
    console.error(
      `Extension token: ${process.env.BROWSER_BRIDGE_TOKEN || (await token())}\nExtension URL: ws://127.0.0.1:29651 (enable local auto-discovery)`,
    );
    return;
  }
  if (!["http", "stdio"].includes(values.transport))
    throw Error("transport must be http or stdio");
  const stdio = values.transport === "stdio",
    requested = values.port ?? (stdio ? "auto" : "29651");
  if (
    requested !== "auto" &&
    (!/^\d+$/.test(requested) ||
      Number(requested) < 1 ||
      Number(requested) > 65535)
  )
    throw Error("port must be auto or an integer 1..65535");
  const ports =
    requested === "auto"
      ? stdio
        ? DISCOVERY_PORTS.slice(1)
        : DISCOVERY_PORTS
      : [Number(requested)];
  let broker;
  for (const port of ports) {
    try {
      broker = await startBroker({
        port,
        enableHttpMcp: !stdio,
        sdkUrl: values["sdk-url"],
        secret: process.env.BROWSER_BRIDGE_TOKEN || undefined,
        allowUploads: values["allow-uploads"],
        allowHistory: values["allow-history"],
      });
      break;
    } catch (error) {
      if (error.code !== "EADDRINUSE" || requested !== "auto") throw error;
    }
  }
  if (!broker)
    throw Error(
      `All discovery ports are in use (${ports[0]}–${ports.at(-1)}). Specify --port and add its URL in extension options.`,
    );
  console.error(
    `Browser Agent Bridge (${values.transport})\nExtension endpoint: ws://127.0.0.1:${broker.port}\nExtension token: ${broker.secret}\nSDK: ${values["sdk-url"] ?? process.env.BROWSER_SDK_URL ?? "bundled"}${stdio ? "" : "\nMCP endpoint: http://127.0.0.1:" + broker.port + "/mcp"}`,
  );
  let mcp,
    closing = false;
  async function close() {
    if (closing) return;
    closing = true;
    await mcp?.close();
    await broker.close();
  }
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, () => close().finally(() => process.exit()));
  if (stdio) {
    mcp = createBrowserMcp({
      broker: `http://127.0.0.1:${broker.port}`,
      secret: broker.secret,
      sdkUrl: values["sdk-url"],
    });
    const transport = new StdioServerTransport();
    mcp.server.server.onclose = () => close().finally(() => process.exit());
    process.stdin.once("end", () => close().finally(() => process.exit()));
    await mcp.server.connect(transport);
  }
  return { broker, close };
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
