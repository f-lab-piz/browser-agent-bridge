import crypto from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { JsExecutor } from "./executor.mjs";
export function createMcpHttp({ broker, secret, sdkUrl }) {
  const sessions = new Map();
  async function handle(req, res) {
    try {
      let body;
      if (req.method === "POST") {
        let text = "";
        for await (const chunk of req) {
          text += chunk;
          if (text.length > 1024 * 1024) throw Error("MCP input too large");
        }
        body = JSON.parse(text);
      }
      const id = req.headers["mcp-session-id"];
      let state = id ? sessions.get(id) : null;
      if (!state) {
        if (id || req.method !== "POST" || !isInitializeRequest(body)) {
          res.writeHead(400);
          res.end(
            JSON.stringify({ error: "Initialize a new MCP session first" }),
          );
          return;
        }
        const jsSession = crypto.randomUUID(),
          executor = new JsExecutor({
            broker,
            token: secret,
            sessionId: jsSession,
            sdkUrl,
          });
        const server = new McpServer({
          name: "browser-agent-bridge",
          version: "0.1.0",
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
              if (!content.length)
                content.push({ type: "text", text: "undefined" });
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
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => crypto.randomUUID(),
          enableJsonResponse: true,
          onsessioninitialized: (sessionId) =>
            sessions.set(sessionId, { transport, executor, server, jsSession }),
        });
        transport.onclose = () => {
          if (transport.sessionId) sessions.delete(transport.sessionId);
          executor.close().catch(() => {});
        };
        await server.connect(transport);
        state = { transport, executor, server, jsSession };
      }
      await state.transport.handleRequest(req, res, body);
    } catch (error) {
      if (!res.headersSent)
        res.writeHead(500, { "content-type": "application/json" });
      if (!res.writableEnded) res.end(JSON.stringify({ error: error.message }));
    }
  }
  return {
    handle,
    async close() {
      for (const s of sessions.values()) {
        await s.executor.close();
        await s.transport.close();
      }
      sessions.clear();
    },
  };
}
