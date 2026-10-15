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
