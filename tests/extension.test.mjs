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
