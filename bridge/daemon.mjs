import { createMcpHttp } from "./mcp-http.mjs";
import http from "node:http";
import crypto from "node:crypto";
import { WebSocketServer } from "ws";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { ROOT, token } from "./config.mjs";
export async function startBroker({
  port = 29651,
  enableHttpMcp = true,
  sdkUrl = process.env.BROWSER_SDK_URL,
  secret,
  allowUploads = false,
  allowHistory = false,
} = {}) {
  secret ??= await token();
  const peers = new Map(),
    pending = new Map(),
    leases = new Map(),
    events = [];
  let sequence = 0;
  const record = (browserId, name, data) => {
    events.push({ sequence: ++sequence, browserId, name, data });
    if (events.length > 10000) events.splice(0, 1000);
  };
  async function native(browserId, sessionId, method, args) {
    const peer = peers.get(browserId);
    if (!peer)
      throw Error(
        "Chrome extension is not connected. Open extension options and pair it with the bridge.",
      );
    const tab =
      typeof args[0] === "number"
        ? args[0]
        : (args[0]?.target?.tabId ?? args[0]?.tabId);
    let previousOwner;
    if (
      Number.isInteger(tab) &&
      [
        "attach",
        "executeCdp",
        "executeCdpWithCachedExpression",
        "claimUserTab",
        "closeTab",
        "detach",
        "markTab",
      ].includes(method)
    ) {
      const key = `${browserId}:${tab}`,
        owner = leases.get(key);
      previousOwner = owner;
      if (owner && owner !== sessionId)
        throw Error(`Tab ${tab} is leased by another agent session`);
      if (method !== "detach") leases.set(key, sessionId);
    }
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID(),
        timer = setTimeout(() => {
          pending.delete(id);
          reject(Error(`Native request timed out: ${method}`));
        }, 125000);
      pending.set(id, {
        peer,
        resolve: (value) => {
          clearTimeout(timer);
          if (method === "createTab" && value?.id)
            leases.set(`${browserId}:${value.id}`, sessionId);
          resolve(value);
        },
        reject: (e) => {
          clearTimeout(timer);
          if (
            previousOwner === undefined &&
            leases.get(`${browserId}:${tab}`) === sessionId
          )
            leases.delete(`${browserId}:${tab}`);
          reject(e);
        },
      });
      peer.ws.send(
        JSON.stringify({ type: "request", id, method, args, sessionId }),
      );
    });
  }
  async function dispatch(operation, p, sessionId) {
    if (operation === "listBrowsers")
      return [...peers].map(([id, x]) => ({
        id,
        name: "Browser Agent Chrome",
        type: "extension",
        family: "chrome",
        profileName: x.profileName,
        metadata: { extensionInstanceId: id },
        apiSupportOverrides: { "Tab.ax": true },
        capabilities: {
          browser: [{ id: "viewport" }, { id: "visibility" }],
          tab: [{ id: "pageAssets" }, { id: "webmcp" }],
        },
      }));
    if (operation === "native") {
      if (p.method === "getUserHistory" && !allowHistory)
        throw Error(
          "History is disabled. Start bridge with --allow-history to enable it.",
        );
      return native(p.browserId, sessionId, p.method, p.args);
    }
    if (operation === "events")
      return {
        events: events.filter((e) => e.sequence > (p.after ?? 0)),
        cursor: sequence,
        truncated: events.length > 0 && (p.after ?? 0) < events[0].sequence - 1,
      };
    if (operation === "release") {
      for (const [key, owner] of leases)
        if (owner === sessionId) leases.delete(key);
      await Promise.allSettled(
        [...peers.keys()].map((browserId) =>
          native(browserId, sessionId, "releaseSession", []),
        ),
      );
      return {};
    }
    if (operation === "documentation") {
      if (!/^[a-zA-Z0-9_/-]+$/.test(p.name) || p.name.split("/").includes(".."))
        throw Error("Invalid documentation name");
      return fs.readFile(
        `${ROOT}/vendor/openai/26.928.21956/docs/${p.name}.md`,
        "utf8",
      );
    }
    if (operation === "authorize") {
      const { type, params = {} } = p.command;
      if (type === "upload" && !allowUploads)
        throw Error(
          "Uploads are disabled. Start bridge with --allow-uploads to enable them.",
        );
      if (params.url) {
        const u = new URL(params.url);
        if (
          !["http:", "https:"].includes(u.protocol) &&
          u.href !== "about:blank"
        )
          throw Error("Only HTTP(S) pages and about:blank are allowed");
      }
      return {};
    }
    throw Error(`Unknown broker operation: ${operation}`);
  }
  let mcp;
  const server = http.createServer(async (req, res) => {
    try {
      const target = new URL(req.url, "http://localhost");
      if (req.method === "GET" && target.pathname === "/discovery") {
        const nonce = target.searchParams.get("nonce");
        if (!nonce || !/^[a-f0-9-]{36}$/.test(nonce)) {
          res.writeHead(400);
          res.end();
          return;
        }
        const port = server.address().port;
        res.setHeader("content-type", "application/json");
        res.setHeader("cache-control", "no-store");
        res.end(
          JSON.stringify({
            protocol: "browser-agent-bridge/v1",
            port,
            proof: crypto
              .createHmac("sha256", secret)
              .update(`browser-agent-bridge/v1:${port}:${nonce}`)
              .digest("hex"),
          }),
        );
        return;
      }
      if (req.headers.authorization !== `Bearer ${secret}`) {
        res.writeHead(401);
        res.end();
        return;
      }
      if (req.url === "/mcp" && enableHttpMcp) return mcp.handle(req, res);
      if (req.method !== "POST" || req.url !== "/rpc") {
        res.writeHead(404);
        res.end();
        return;
      }
      let body = "";
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 16 * 1024 * 1024)
          throw Error("Request exceeds limit");
      }
      const { operation, params = {}, sessionId } = JSON.parse(body);
      if (typeof sessionId !== "string" || !sessionId)
        throw Error("sessionId required");
      const value = await dispatch(operation, params, sessionId);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true, value }));
    } catch (error) {
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          ok: false,
          error: { message: String(error.message ?? error) },
        }),
      );
    }
  });
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 32 * 1024 * 1024,
  });
  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url, "http://localhost");
    const origin = req.headers.origin ?? "";
    if (
      url.searchParams.get("token") !== secret ||
      (!origin.startsWith("chrome-extension://") && origin !== "")
    ) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) =>
      wss.emit("connection", ws, req),
    );
  });
  wss.on("connection", (ws) => {
    let peer, id;
    ws.on("message", (buffer) => {
      try {
        const m = JSON.parse(buffer.toString());
        if (m.type === "hello") {
          if (typeof m.instanceId !== "string" || m.instanceId.length > 128)
            throw Error("Invalid instance ID");
          id = m.instanceId;
          if (peers.has(id)) peers.get(id).ws.close();
          peer = { ws, profileName: m.profileName };
          peers.set(id, peer);
        } else if (m.type === "response") {
          const request = pending.get(m.id);
          if (request?.peer !== peer) return;
          pending.delete(m.id);
          m.error
            ? request.reject(Error(m.error.message))
            : request.resolve(m.value);
        } else if (m.type === "event" && peer) record(id, m.name, m.data);
      } catch {
        ws.close();
      }
    });
    ws.on("close", () => {
      const current = peers.get(id) === peer;
      if (current) peers.delete(id);
      for (const [rid, p] of pending)
        if (p.peer === peer) {
          pending.delete(rid);
          p.reject(Error("Chrome extension disconnected"));
        }
      if (id && current)
        for (const k of leases.keys())
          if (k.startsWith(id + ":")) leases.delete(k);
    });
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  if (enableHttpMcp)
    mcp = createMcpHttp({
      broker: `http://127.0.0.1:${server.address().port}`,
      secret,
      sdkUrl,
    });
  return {
    port: server.address().port,
    dispatch,
    secret,
    async close() {
      await mcp?.close();
      for (const socket of wss.clients) socket.terminate();
      wss.close();
      await new Promise((r) => {
        server.close(r);
        server.closeAllConnections();
      });
    },
  };
}
// 기존 직접 실행 경로도 통합 CLI에 위임한다. 동적 import의 순환 대기를 피한다.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href)
  import("./cli.mjs")
    .then(({ main }) => main())
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
