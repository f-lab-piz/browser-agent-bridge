// HTTP와 stdio가 같은 발견 포트 범위를 사용한다. 확장은 여러 프로세스에 동시에 연결한다.
export const DISCOVERY_PORTS = Object.freeze(
  Array.from({ length: 10 }, (_, i) => 29651 + i),
);
export function connectionTargets({
  url = "ws://127.0.0.1:29651",
  autoDiscover = true,
} = {}) {
  const base = new URL(url);
  if (!["ws:", "wss:"].includes(base.protocol))
    throw Error("Extension endpoint must use ws:// or wss://");
  const discover =
    autoDiscover &&
    base.protocol === "ws:" &&
    ["127.0.0.1", "localhost", "[::1]"].includes(base.hostname);
  if (discover) base.hostname = "127.0.0.1";
  const targets = new Set([base.href]);
  if (discover)
    for (const port of DISCOVERY_PORTS)
      targets.add(new URL(`ws://127.0.0.1:${port}`).href);
  return [...targets];
}
// 발견한 임의 포트에 토큰을 보내기 전에 같은 비밀을 가진 브로커임을 확인한다.
export async function authenticateEndpoint(endpoint, token) {
  try {
    const target = new URL(endpoint),
      port = Number(target.port || (target.protocol === "wss:" ? 443 : 80)),
      nonce = crypto.randomUUID();
    target.protocol = target.protocol === "wss:" ? "https:" : "http:";
    target.pathname = "/discovery";
    target.search = "";
    target.searchParams.set("nonce", nonce);
    const response = await fetch(target, { signal: AbortSignal.timeout(1500) });
    if (!response.ok) return false;
    const data = await response.json();
    if (data.protocol !== "browser-agent-bridge/v1" || data.port !== port)
      return false;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(token),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const proof = Array.from(
      new Uint8Array(
        await crypto.subtle.sign(
          "HMAC",
          key,
          new TextEncoder().encode(`browser-agent-bridge/v1:${port}:${nonce}`),
        ),
      ),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
    return data.proof === proof;
  } catch {
    return false;
  }
}
export class ExtensionConnections {
  constructor({
    backend,
    WebSocket,
    instanceId,
    profileName,
    token,
    targets,
    authenticate = authenticateEndpoint,
  }) {
    Object.assign(this, {
      backend,
      WebSocket,
      instanceId,
      profileName,
      token,
      targets,
      authenticate,
    });
    this.sockets = new Map();
    this.checking = new Set();
    this.closed = false;
  }
  start() {
    this.scan();
    this.retry = setInterval(() => this.scan(), 3000);
    this.heartbeat = setInterval(() => {
      for (const { socket } of this.sockets.values())
        if (socket.readyState === 1)
          socket.send(JSON.stringify({ type: "ping" }));
    }, 20000);
  }
  async scan() {
    if (this.closed) return;
    await Promise.all(
      this.targets.map(async (endpoint) => {
        if (this.sockets.has(endpoint) || this.checking.has(endpoint)) return;
        this.checking.add(endpoint);
        let accepted;
        try {
          accepted = await this.authenticate(endpoint, this.token);
        } finally {
          this.checking.delete(endpoint);
        }
        if (this.closed || !accepted || this.sockets.has(endpoint)) return;
        const url = new URL(endpoint);
        url.searchParams.set("token", this.token);
        const socket = new this.WebSocket(url),
          connectionId = crypto.randomUUID();
        this.sockets.set(endpoint, { socket, connectionId });
        socket.onopen = () =>
          socket.send(
            JSON.stringify({
              type: "hello",
              instanceId: this.instanceId,
              profileName: this.profileName,
            }),
          );
        socket.onmessage = async ({ data }) => {
          let request;
          try {
            request = JSON.parse(data);
            if (request.type !== "request") return;
            if (typeof request.sessionId !== "string")
              throw Error("sessionId required");
            const value = await this.backend.invoke(
              request.method,
              request.args ?? [],
              { sessionId: request.sessionId, connectionId },
            );
            if (socket.readyState === 1)
              socket.send(
                JSON.stringify({ type: "response", id: request.id, value }),
              );
          } catch (error) {
            if (socket.readyState === 1)
              socket.send(
                JSON.stringify({
                  type: "response",
                  id: request?.id,
                  error: { message: String(error?.message ?? error) },
                }),
              );
          }
        };
        socket.onclose = () => {
          if (this.sockets.get(endpoint)?.socket === socket)
            this.sockets.delete(endpoint);
          this.backend.releaseConnection(connectionId);
        };
        socket.onerror = () => socket.close();
      }),
    );
  }
  emit(name, data) {
    for (const { socket } of this.sockets.values())
      if (socket.readyState === 1)
        socket.send(JSON.stringify({ type: "event", name, data }));
  }
  close() {
    this.closed = true;
    clearInterval(this.retry);
    clearInterval(this.heartbeat);
    for (const { socket, connectionId } of this.sockets.values()) {
      this.backend.releaseConnection(connectionId);
      socket.close();
    }
    this.sockets.clear();
  }
}
