import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { once } from "node:events";
import { startBroker } from "../bridge/daemon.mjs";
test("HTTP 인증·탭 lease·반납·업로드 차단", async () => {
  const b = await startBroker({ port: 0, secret: "unit-token" });
  const ws = new WebSocket(`ws://127.0.0.1:${b.port}/?token=unit-token`);
  try {
    await once(ws, "open");
    ws.on("message", (buffer) => {
      const m = JSON.parse(buffer);
      if (m.type === "request")
        ws.send(JSON.stringify({ type: "response", id: m.id, value: {} }));
    });
    ws.send(
      JSON.stringify({
        type: "hello",
        instanceId: "unit-browser",
        profileName: "unit",
      }),
    );
    for (let i = 0; i < 50; i++) {
      if ((await b.dispatch("listBrowsers", {}, "one")).length) break;
      await new Promise((r) => setTimeout(r, 5));
    }
    const response = await fetch(`http://127.0.0.1:${b.port}/rpc`, {
      method: "POST",
      body: "{}",
    });
    assert.equal(response.status, 401);
    const p = { browserId: "unit-browser", method: "attach", args: [10] };
    await b.dispatch("native", p, "one");
    await assert.rejects(b.dispatch("native", p, "two"), /leased/);
    await b.dispatch("release", {}, "one");
    await b.dispatch("native", p, "two");
    await assert.rejects(
      b.dispatch("authorize", { command: { type: "upload" } }, "one"),
      /disabled/,
    );
    await assert.rejects(
      b.dispatch(
        "authorize",
        {
          command: {
            type: "navigate_tab_url",
            params: { url: "file:///tmp/private" },
          },
        },
        "one",
      ),
      /Only HTTP/,
    );
  } finally {
    ws.close();
    await b.close();
  }
});

test("hello 없는 WebSocket과 HTTP 선연결도 종료 시 정리한다", async () => {
  const net = await import("node:net");
  const b = await startBroker({ port: 0, secret: "close-token" });
  const ws = new WebSocket(`ws://127.0.0.1:${b.port}/?token=close-token`);
  await once(ws, "open");
  const socket = net.connect({ host: "127.0.0.1", port: b.port });
  await once(socket, "connect");
  try {
    await b.close();
  } finally {
    ws.terminate();
    socket.destroy();
  }
});
