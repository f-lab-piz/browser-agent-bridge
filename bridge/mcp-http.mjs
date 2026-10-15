import crypto from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createBrowserMcp } from "./mcp-server.mjs";
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
        const { server, executor, jsSession } = createBrowserMcp({
          broker,
          secret,
          sdkUrl,
        });
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
