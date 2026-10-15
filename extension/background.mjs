import { createChromeBackend } from "./backend.mjs";
async function main() {
  let socket, retry, heartbeat;
  let generation = 0;
  const instanceId =
    (await chrome.storage.local.get("instanceId")).instanceId ??
    crypto.randomUUID();
  await chrome.storage.local.set({ instanceId });
  const backend = createChromeBackend(chrome, (name, data) => {
    if (socket?.readyState === 1)
      socket.send(JSON.stringify({ type: "event", name, data }));
  });
  async function connect() {
    const current = ++generation;
    clearTimeout(retry);
    const {
      url = "ws://127.0.0.1:29651",
      token,
      profileName = "Chrome",
    } = await chrome.storage.local.get(["url", "token", "profileName"]);
    if (current !== generation || !token) return;
    const target = new URL(url);
    target.searchParams.set("token", token);
    const ws = new WebSocket(target);
    socket = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "hello", instanceId, profileName }));
      clearInterval(heartbeat);
      heartbeat = setInterval(() => {
        if (ws.readyState === 1) ws.send(JSON.stringify({ type: "ping" }));
      }, 20000);
    };
    ws.onmessage = async ({ data }) => {
      let request;
      try {
        request = JSON.parse(data);
        if (request.type !== "request") return;
        const value = await backend.invoke(request.method, request.args ?? [], {
          sessionId: request.sessionId,
        });
        ws.send(JSON.stringify({ type: "response", id: request.id, value }));
      } catch (error) {
        if (ws?.readyState === 1)
          ws.send(
            JSON.stringify({
              type: "response",
              id: request?.id,
              error: { message: String(error?.message ?? error) },
            }),
          );
      }
    };
    ws.onclose = () => {
      if (socket !== ws) return;
      clearInterval(heartbeat);
      retry = setTimeout(connect, 3000);
    };
    ws.onerror = () => ws.close();
  }
  chrome.storage.onChanged.addListener(() => {
    socket?.close();
    connect();
  });
  chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
  chrome.alarms.create("reconnect", { periodInMinutes: 1 });
  chrome.alarms.onAlarm.addListener(() => {
    if (!socket || socket.readyState > 1) connect();
  });
  connect();
}
main().catch((error) => console.error("Bridge startup failed", error));
