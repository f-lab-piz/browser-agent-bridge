// HTTP와 stdio가 공유하는 MCP 툴 및 JavaScript 세션.
import crypto from "node:crypto";
import packageInfo from "../package.json" with { type: "json" };
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { JsExecutor } from "./executor.mjs";
export function createBrowserMcp({
  broker,
  secret,
  sdkUrl,
  sessionId = crypto.randomUUID(),
}) {
  const jsSession = sessionId,
    executor = new JsExecutor({
      broker,
      token: secret,
      sessionId: jsSession,
      sdkUrl,
    });
  const server = new McpServer({
    name: "browser-agent-bridge",
    version: packageInfo.version,
  });
  server.registerTool(
    "browser_js",
    {
      description:
        "Execute JavaScript with persistent agent, cua and nodeRepl bindings. Supports top-level await; variables and browser objects persist within this MCP session. Browser actions run on the paired Chrome extension. Trusted code only.",
      inputSchema: {
        code: z.string().min(1),
        timeout_ms: z.number().int().min(1).max(300000).optional(),
      },
    },
    async ({ code, timeout_ms }) => {
      try {
        const r = await executor.execute(code, timeout_ms);
        const content = r.outputs.map((x) => {
          if (x.type === "image" && x.data && x.mimeType)
            return { type: "image", data: x.data, mimeType: x.mimeType };
          return { type: "text", text: x.text ?? JSON.stringify(x) };
        });
        if (r.error) content.push({ type: "text", text: r.error });
        else if (!content.length && r.result.type !== "undefined")
          content.push({
            type: "text",
            text:
              typeof r.result.value === "string"
                ? r.result.value
                : JSON.stringify(r.result.value ?? r.result.description),
          });
        if (!content.length) content.push({ type: "text", text: "undefined" });
        return { content, isError: !!r.error };
      } catch (e) {
        return {
          content: [{ type: "text", text: e.message }],
          isError: true,
        };
      }
    },
  );
  server.registerTool(
    "browser_js_reset",
    {
      description:
        "Reset this MCP JavaScript session and clear its variables and browser bindings.",
      inputSchema: {},
    },
    async () => {
      await executor.close();
      return {
        content: [{ type: "text", text: "JavaScript session reset." }],
      };
    },
  );
  return { server, executor, jsSession, close: () => executor.close() };
}
