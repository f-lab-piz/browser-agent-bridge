import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { ROOT } from "./config.mjs";
export async function loadSdk(
  base = process.env.BROWSER_SDK_URL ??
    new URL("../sdk/", import.meta.url).href,
) {
  const url = new URL(base);
  if (!["http:", "https:", "file:"].includes(url.protocol))
    throw Error("SDK host must use HTTP(S) or a local file directory");
  async function read(name) {
    const target = new URL(name, url);
    if (url.protocol === "file:") return fs.readFile(target);
    const response = await fetch(target, {
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw Error(`SDK HTTP ${response.status}: ${name}`);
    return Buffer.from(await response.arrayBuffer());
  }
  const text = (await read("manifest.json")).toString("utf8"),
    manifest = JSON.parse(text),
    digest = crypto.createHash("sha256").update(text).digest("hex");
  if (!manifest.files || !Object.hasOwn(manifest.files, manifest.entry))
    throw Error("Invalid SDK manifest");
  const cache = path.join(ROOT, ".cache/sdk", digest);
  await fs.mkdir(cache, { recursive: true });
  for (const [name, spec] of Object.entries(manifest.files)) {
    if (
      !/^[a-zA-Z0-9_.-]+$/.test(name) ||
      name === "." ||
      name === ".." ||
      !Number.isInteger(spec.bytes) ||
      spec.bytes < 0 ||
      spec.bytes > 16 * 1024 * 1024 ||
      !/^[a-f0-9]{64}$/.test(spec.sha256)
    )
      throw Error("Invalid SDK asset");
    const file = path.join(cache, name);
    let bytes;
    try {
      bytes = await fs.readFile(file);
    } catch {}
    if (
      !bytes ||
      crypto.createHash("sha256").update(bytes).digest("hex") !== spec.sha256
    ) {
      bytes = await read(name);
      if (
        bytes.length !== spec.bytes ||
        crypto.createHash("sha256").update(bytes).digest("hex") !== spec.sha256
      )
        throw Error(`SDK checksum mismatch: ${name}`);
      const temporary = file + "." + crypto.randomUUID();
      await fs.writeFile(temporary, bytes);
      await fs.rename(temporary, file);
    }
  }
  return {
    module: await import(pathToFileURL(path.join(cache, manifest.entry)).href),
    manifest,
  };
}
