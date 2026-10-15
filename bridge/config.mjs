import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
export const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
export async function token() {
  const dir = path.join(ROOT, ".local"),
    file = path.join(dir, "token");
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  try {
    return (await fs.readFile(file, "utf8")).trim();
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    const value = crypto.randomBytes(32).toString("hex");
    try {
      await fs.writeFile(file, value, { mode: 0o600, flag: "wx" });
      return value;
    } catch (e) {
      if (e.code === "EEXIST") return (await fs.readFile(file, "utf8")).trim();
      throw e;
    }
  }
}
