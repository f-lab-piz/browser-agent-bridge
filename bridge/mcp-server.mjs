// HTTP와 stdio가 공유하는 MCP 툴 및 JavaScript 세션.
import crypto from "node:crypto";
import packageInfo from "../package.json" with { type: "json" };
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { JsExecutor } from "./executor.mjs";
import { getHelp, recoveryHint } from "./help.mjs";
import {
  SERVER_INSTRUCTIONS,
  JS_DESCRIPTION,
  RESET_DESCRIPTION,
  HELP_DESCRIPTION,
  HELP_TOPICS,
} from "./help-content.mjs";

// 원본 AX 캡처는 JPEG일 수 있다. 양 transport에서 실제 바이트와 MIME을 맞춘다.
function imageMime(data, fallback) {
  const bytes = Buffer.from(data, "base64");
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  return fallback;
}
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
  const server = new McpServer(
    {
      name: "browser-agent-bridge",
      version: packageInfo.version,
    },
    { instructions: SERVER_INSTRUCTIONS },
  );
  server.registerTool(
    "browser_js",
    {
      description: JS_DESCRIPTION,
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
            return {
              type: "image",
              data: x.data,
              mimeType: imageMime(x.data, x.mimeType),
            };
          return { type: "text", text: x.text ?? JSON.stringify(x) };
        });
        if (r.error) {
          content.push({ type: "text", text: r.error });
          const hint = recoveryHint(r.error);
          if (hint) content.push({ type: "text", text: hint });
        } else if (!content.length && r.result.type !== "undefined")
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
        const hint = recoveryHint(e.message);
        return {
          content: [
            { type: "text", text: e.message },
            ...(hint ? [{ type: "text", text: hint }] : []),
          ],
          isError: true,
        };
      }
    },
  );
  server.registerTool(
    "browser_js_reset",
    {
      description: RESET_DESCRIPTION,
      inputSchema: {},
    },
    async () => {
      await executor.close();
      return {
        content: [{ type: "text", text: "JavaScript session reset." }],
      };
    },
  );
  server.registerTool(
    "browser_help",
    {
      title: "Browser guide and API help",
      description: HELP_DESCRIPTION,
      inputSchema: {
        topic: z
          .string()
          .max(80)
          .optional()
          .describe(
            `Guide topic: ${HELP_TOPICS.join(", ")}. Defaults to quickstart, or api when api is given.`,
          ),
        api: z
          .string()
          .min(1)
          .max(160)
          .optional()
          .describe(
            "Exact JavaScript API or namespace, e.g. tab.getAXState or tab.playwright. Use alone or with topic:api.",
          ),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => getHelp(args),
  );
  return { server, executor, jsSession, close: () => executor.close() };
}
