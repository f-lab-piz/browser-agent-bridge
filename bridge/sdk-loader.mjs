import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { ROOT } from "./config.mjs";
export async function loadSdk(
  base = process.env.BROWSER_SDK_URL ?? "http://127.0.0.1:29652/",
) {
  const url = new URL(base);
  if (!["http:", "https:"].includes(url.protocol))
    throw Error("SDK host must use HTTP(S)");
  const response = await fetch(new URL("manifest.json", url), {
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw Error(`SDK manifest HTTP ${response.status}. Run npm run host.`);
  const text = await response.text(),
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
      const r = await fetch(new URL(name, url), {
        signal: AbortSignal.timeout(30000),
      });
      if (!r.ok) throw Error(`SDK asset HTTP ${r.status}: ${name}`);
      bytes = Buffer.from(await r.arrayBuffer());
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
