import { Worker } from "node:worker_threads";
import crypto from "node:crypto";
export class JsExecutor {
  constructor(options) {
    this.options = options;
    this.tail = Promise.resolve();
    this.worker = null;
    this.pending = new Map();
  }
  async start() {
    if (this.ready) return this.ready;
    this.ready = new Promise((resolve, reject) => {
      const worker = (this.worker = new Worker(
        new URL("./js-worker.mjs", import.meta.url),
        { workerData: this.options, stdout: true, stderr: true },
      ));
      worker.stdout.on("data", (bytes) => process.stderr.write(bytes));
      worker.stderr.on("data", (bytes) => process.stderr.write(bytes));
      worker.on("message", (m) => {
        if (m.ready) resolve(m);
        if (m.id) {
          const p = this.pending.get(m.id);
          if (p) {
            this.pending.delete(m.id);
            clearTimeout(p.timer);
            p.resolve(m);
          }
        }
      });
      worker.on("error", (e) => {
        reject(e);
        this.fail(e);
        if (this.worker === worker) {
          this.worker = null;
          this.ready = null;
        }
      });
      worker.on("exit", (code) => {
        if (code && this.worker === worker)
          this.fail(Error(`JavaScript worker exited: ${code}`));
      });
    });
    return this.ready;
  }
  fail(error) {
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(error);
    }
    this.pending.clear();
  }
  execute(code, timeoutMs = 120000) {
    const task = this.tail.then(async () => {
      await this.start();
      return new Promise((resolve, reject) => {
        const id = crypto.randomUUID(),
          timer = setTimeout(async () => {
            this.pending.delete(id);
            await this.reset().catch(() => {});
            reject(
              Error(
                "JavaScript execution timed out; the session was reset and variables were cleared. An action may already have occurred; inspect before retrying.",
              ),
            );
          }, timeoutMs);
        this.pending.set(id, { resolve, reject, timer });
        this.worker.postMessage({ type: "execute", id, code });
      });
    });
    this.tail = task.catch(() => {});
    return task;
  }
  async reset() {
    const w = this.worker;
    this.worker = null;
    this.ready = null;
    this.fail(Error("JavaScript session reset"));
    if (w) await w.terminate();
    await fetch(this.options.broker + "/rpc", {
      method: "POST",
      headers: {
        authorization: "Bearer " + this.options.token,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        operation: "release",
        params: {},
        sessionId: this.options.sessionId,
      }),
    }).catch(() => {});
  }
  async close() {
    const w = this.worker;
    if (w) {
      w.postMessage({ type: "dispose" });
      await Promise.race([
        new Promise((r) => w.once("message", (m) => m.disposed && r())),
        new Promise((r) => setTimeout(r, 500)),
      ]);
    }
    await this.reset();
  }
}
