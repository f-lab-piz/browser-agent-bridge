import test from "node:test";
import assert from "node:assert/strict";
import { createChromeBackend } from "../extension/backend.mjs";
function event() {
  const listeners = [];
  return {
    addListener: (f) => listeners.push(f),
    send: (...a) => listeners.forEach((f) => f(...a)),
  };
}
function fakeChrome() {
  let id = 1;
  const tabs = new Map([
      [
        1,
        {
          id: 1,
          url: "https://example.com/",
          title: "Example",
          active: true,
          windowId: 1,
        },
      ],
    ]),
    calls = [];
  return {
    calls,
    tabs: {
      query: async () => [...tabs.values()],
      get: async (id) => tabs.get(id),
      create: async (p) => {
        const t = { ...p, id: ++id, windowId: 1 };
        tabs.set(id, t);
        return t;
      },
      remove: async (id) => tabs.delete(id),
    },
    debugger: {
      onEvent: event(),
      onDetach: event(),
      attach: async (target) => calls.push(["attach", target]),
      detach: async () => {},
      sendCommand: async (...p) => {
        calls.push(p);
        return { ok: true };
      },
    },
    downloads: {
      onCreated: event(),
      onChanged: event(),
      search: async () => [],
    },
    windows: { update: async () => {} },
    history: {
      search: async () => [
        { url: "https://example.com", title: "x", lastVisitTime: 1000 },
      ],
    },
  };
}
test("확장 Native API: 탭·CDP session·history·미지원 명령 오류", async () => {
  const chrome = fakeChrome(),
    events = [],
    backend = createChromeBackend(chrome, (...e) => events.push(e));
  const t = await backend.invoke("createTab", []);
  assert.equal(t.id, 2);
  assert.equal((await backend.invoke("getTabs", [])).length, 2);
  await backend.invoke("executeCdp", [
    {
      target: { tabId: 2, sessionId: "frame-session" },
      method: "DOM.getDocument",
      commandParams: { depth: 1 },
    },
  ]);
  assert.deepEqual(chrome.calls.at(-1), [
    { tabId: 2, sessionId: "frame-session" },
    "DOM.getDocument",
    { depth: 1 },
  ]);
  chrome.debugger.onEvent.send({ tabId: 2 }, "Page.loadEventFired", {});
  assert.equal(events[0][0], "onCDPEvent");
  assert.equal(
    (await backend.invoke("getUserHistory", [{}]))[0].dateVisited,
    "1970-01-01T00:00:01.000Z",
  );
  await assert.rejects(backend.invoke("notImplemented", []), /not mapped/);
  await backend.invoke("closeTab", [2]);
  assert.equal((await backend.invoke("getTabs", [])).length, 1);
});

test("확장 전역 탭 lease: 서로 다른 프로세스 거절, reset·disconnect 후 반납", async () => {
  const backend = createChromeBackend(fakeChrome());
  const a = { sessionId: "a", connectionId: "one" },
    b = { sessionId: "b", connectionId: "two" };
  const tab = await backend.invoke("createTab", [], a);
  await assert.rejects(backend.invoke("attach", [tab.id], b), /leased/);
  await backend.invoke("releaseSession", [], a);
  await backend.invoke("attach", [tab.id], b);
  await assert.rejects(backend.invoke("closeTab", [tab.id], a), /leased/);
  backend.releaseConnection("two");
  await backend.invoke("closeTab", [tab.id], a);
});

test("탭 생성 응답 전에 연결이 끊겨도 사용권이 남지 않는다", async () => {
  const chrome = fakeChrome();
  let resolve;
  chrome.tabs.create = () => new Promise((r) => (resolve = r));
  const backend = createChromeBackend(chrome);
  const pending = backend.invoke("createTab", [], {
    sessionId: "old",
    connectionId: "old-connection",
  });
  backend.releaseConnection("old-connection");
  resolve({ id: 99, url: "about:blank" });
  await assert.rejects(pending, /connection closed/);
  await backend.invoke("attach", [99], {
    sessionId: "new",
    connectionId: "new-connection",
  });
});
