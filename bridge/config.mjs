import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
export const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
export async function token(dir = path.join(ROOT, ".local")) {
  const file = path.join(dir, "token");
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  try {
    return (await fs.readFile(file, "utf8")).trim();
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  // 생성이 끝난 파일을 원자적으로 공개하여 동시 stdio 시작 시 빈 토큰을 읽지 않게 한다.
  const temporary = path.join(dir, `.token-${crypto.randomUUID()}`);
  await fs.writeFile(temporary, crypto.randomBytes(32).toString("hex"), {
    mode: 0o600,
    flag: "wx",
  });
  try {
    await fs.link(temporary, file);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  } finally {
    await fs.unlink(temporary);
  }
  return (await fs.readFile(file, "utf8")).trim();
}
