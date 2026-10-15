import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { token } from "../bridge/config.mjs";
test("여러 stdio 동시 첫 실행도 같은 완성된 토큰을 읽는다", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "browser-token-"));
  try {
    const tokens = await Promise.all(
      Array.from({ length: 16 }, () => token(dir)),
    );
    assert.equal(new Set(tokens).size, 1);
    assert.match(tokens[0], /^[a-f0-9]{64}$/);
    assert.deepEqual(await fs.readdir(dir), ["token"]);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
