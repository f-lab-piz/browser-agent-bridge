import { parentPort, workerData } from "node:worker_threads";
import inspector from "node:inspector";
import { loadSdk } from "./sdk-loader.mjs";
const outputs = [];
let cursor = 0,
  closed = false,
  runtime;
let eventTail = Promise.resolve();
const emit = (value) => {
  outputs.push(
    value?.type
      ? value
      : {
          type: "text",
          text: typeof value === "string" ? value : JSON.stringify(value),
        },
  );
};
async function rawTransport(operation, params) {
  const r = await fetch(workerData.broker + "/rpc", {
    method: "POST",
    headers: {
      authorization: `Bearer ${workerData.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      operation,
      params,
      sessionId: workerData.sessionId,
    }),
  });
  if (!r.ok) throw Error(`Broker HTTP ${r.status}`);
  const result = await r.json();
  if (!result.ok) throw Error(result.error.message);
  return result.value;
}
function flushEvents() {
  const task = eventTail.then(async () => {
    if (closed) return;
    const r = await rawTransport("events", { after: cursor });
    if (r.truncated)
      emit({
        type: "text",
        text: "Warning: browser event buffer was truncated; refresh AX/DOM before further actions.",
      });
    cursor = r.cursor;
    for (const e of r.events) runtime?.onEvent(e.browserId, e.name, e.data);
  });
  eventTail = task.catch(() => {});
  return task;
}
// CDP 이벤트는 응답보다 먼저 도착할 수 있다. RPC 완료 전에 순서대로 반영한다.
async function transport(operation, params) {
  const value = await rawTransport(operation, params);
  if (operation === "native") await flushEvents();
  return value;
}
const { module: sdk, manifest } = await loadSdk(workerData.sdkUrl);
runtime = await sdk.createBrowserAgent({
  transport,
  sessionId: workerData.sessionId,
  emit,
});
Object.assign(globalThis, {
  agent: runtime.agent,
  cua: runtime.cua,
  nodeRepl: {
    write: emit,
    emitImage: async (value) => {
      if (value instanceof Uint8Array)
        emit({
          type: "image",
          data: Buffer.from(value).toString("base64"),
          mimeType: "image/png",
        });
      else emit(value);
    },
  },
});
console.log = (...args) =>
  emit({
    type: "text",
    text: args
      .map((v) => (typeof v === "string" ? v : JSON.stringify(v)))
      .join(" "),
  });
const interval = setInterval(
  () =>
    flushEvents().catch((e) =>
      emit({ type: "text", text: "Broker event error: " + e.message }),
    ),
  25,
);
const session = new inspector.Session();
session.connect();
const post = (method, params = {}) =>
  new Promise((resolve, reject) =>
    session.post(method, params, (e, r) => (e ? reject(e) : resolve(r))),
  );
await post("Runtime.enable");
parentPort.postMessage({ ready: true, sdkVersion: manifest.version });
parentPort.on("message", async (message) => {
  if (message.type === "dispose") {
    closed = true;
    clearInterval(interval);
    await runtime.dispose().catch(() => {});
    await transport("release", {}).catch(() => {});
    parentPort.postMessage({ disposed: true });
    return;
  }
  if (message.type !== "execute") return;
  outputs.length = 0;
  try {
    const r = await post("Runtime.evaluate", {
      expression: message.code,
      replMode: true,
      awaitPromise: true,
      returnByValue: true,
      generatePreview: false,
    });
    if (r.exceptionDetails)
      throw Error(
        r.exceptionDetails.exception?.description ?? r.exceptionDetails.text,
      );
    parentPort.postMessage({
      id: message.id,
      outputs: [...outputs],
      result:
        r.result.type === "undefined"
          ? { type: "undefined" }
          : {
              type: r.result.type,
              value: r.result.value,
              description: r.result.description,
            },
    });
  } catch (error) {
    parentPort.postMessage({
      id: message.id,
      outputs: [...outputs],
      error: String(error.message ?? error),
    });
  }
});
