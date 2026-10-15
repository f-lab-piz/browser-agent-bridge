import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { loadSdk } from "../bridge/sdk-loader.mjs";
test("SDK loader rejects traversal and mismatched artifact hashes", async () => {
  let mode = "path";
  const server = http.createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.url === "/manifest.json")
      res.end(
        JSON.stringify({
          entry: mode === "path" ? "../escape.mjs" : "test.mjs",
          files: {
            [mode === "path" ? "../escape.mjs" : "test.mjs"]: {
              bytes: 4,
              sha256: "0".repeat(64),
            },
          },
        }),
      );
    else res.end("evil");
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const url = `http://127.0.0.1:${server.address().port}/`;
    await assert.rejects(loadSdk(url), /Invalid SDK asset/);
    mode = "hash";
    await assert.rejects(loadSdk(url), /checksum mismatch/);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("bundled SDK는 별도 호스트 없이 실행된다", async () => {
  const result = await loadSdk(new URL("../sdk/", import.meta.url).href);
  assert.equal(typeof result.module.createBrowserAgent, "function");
  assert.ok(result.manifest.files["browser-accessibility.wasm.br"]);
});

test("원격 SDK도 manifest와 해시를 검증하여 로드한다", async () => {
  const { createHash } = await import("node:crypto");
  const bytes = Buffer.from("export const remoteSdkTest=true;");
  const manifest = {
    version: "remote-test",
    entry: "remote.mjs",
    files: {
      "remote.mjs": {
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      },
    },
  };
  const server = http.createServer((req, res) =>
    res.end(req.url === "/manifest.json" ? JSON.stringify(manifest) : bytes),
  );
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const result = await loadSdk(`http://127.0.0.1:${server.address().port}/`);
    assert.equal(result.module.remoteSdkTest, true);
  } finally {
    await new Promise((r) => server.close(r));
  }
});
