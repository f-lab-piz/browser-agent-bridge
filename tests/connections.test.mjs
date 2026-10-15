import test from "node:test";
import assert from "node:assert/strict";
import {
  connectionTargets,
  ExtensionConnections,
} from "../extension/connections.mjs";
test("확장 발견 주소: 중복 제거·원격 URL 자동 스캔 금지·명시적 해제", () => {
  assert.equal(connectionTargets({ url: "ws://127.0.0.1:29651/" }).length, 10);
  assert.equal(connectionTargets({ url: "ws://localhost:29651/" }).length, 10);
  assert.equal(connectionTargets({ url: "wss://example.com" }).length, 1);
  assert.equal(connectionTargets({ autoDiscover: false }).length, 1);
  assert.throws(() => connectionTargets({ url: "https://example.com" }), /ws:/);
});
test("확장 연결 pool: 복수 연결·요청 라우팅·이벤트 전송·종료 해제", async () => {
  const sockets = [],
    calls = [],
    releases = [];
  class FakeSocket {
    constructor(url) {
      this.url = url;
      this.readyState = 1;
      this.messages = [];
      sockets.push(this);
    }
    send(x) {
      this.messages.push(JSON.parse(x));
    }
    close() {
      this.readyState = 3;
      this.onclose?.();
    }
  }
  const pool = new ExtensionConnections({
    backend: {
      invoke: async (...args) => {
        calls.push(args);
        return "ok";
      },
      releaseConnection: (id) => releases.push(id),
    },
    WebSocket: FakeSocket,
    instanceId: "extension",
    profileName: "test",
    token: "unit-token",
    targets: ["ws://127.0.0.1:1", "ws://127.0.0.1:2"],
    authenticate: async () => true,
  });
  await pool.scan();
  assert.equal(sockets.length, 2);
  await pool.scan();
  assert.equal(sockets.length, 2);
  sockets[0].onopen();
  assert.equal(sockets[0].messages[0].type, "hello");
  await sockets[1].onmessage({
    data: JSON.stringify({
      type: "request",
      id: "r",
      method: "getTabs",
      sessionId: "two",
    }),
  });
  assert.equal(calls[0][2].sessionId, "two");
  assert.equal(sockets[1].messages[0].value, "ok");
  pool.emit("event", {});
  assert.equal(sockets[0].messages.at(-1).type, "event");
  pool.close();
  assert.ok(releases.includes(calls[0][2].connectionId));
  assert.equal(pool.sockets.size, 0);
});

test("자동 발견은 같은 비밀·포트를 가진 브로커만 연결한다", async () => {
  const { startBroker } = await import("../bridge/daemon.mjs");
  const { authenticateEndpoint } = await import("../extension/connections.mjs");
  const broker = await startBroker({ port: 0, secret: "auth-token" });
  try {
    assert.equal(
      await authenticateEndpoint(`ws://127.0.0.1:${broker.port}`, "auth-token"),
      true,
    );
    assert.equal(
      await authenticateEndpoint(
        `ws://127.0.0.1:${broker.port}`,
        "wrong-token",
      ),
      false,
    );
  } finally {
    await broker.close();
  }
});
