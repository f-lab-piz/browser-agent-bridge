import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  v = path.join(root, "vendor/openai/26.928.21956"),
  out = path.join(root, "sdk");
const exports = `\n// 버전 고정된 원본에 export만 추가한 생성 파일.\nexport { OO as initializeCore, TY as loadOriginalCore, DO as initOriginalCore, cf as Cdp, If as Playwright, Of as Cua, hf as AXActions, jf as Tabs, Yf as Clipboard, Nf as Downloads, wf as Responses, Bf as BrowserUser, Mf as Dev, Uf as PageAssets, yf as AXController, qf as UI, Df as handlers, FN as renderApiDocumentation, SO as metadata, CO as normalize, N_ as identity };\n`;
await fs.writeFile(
  path.join(out, "original-runtime.mjs"),
  (await fs.readFile(path.join(v, "browser-service.mjs"), "utf8")) + exports,
);
await fs.writeFile(
  path.join(out, "original-client.mjs"),
  (await fs.readFile(path.join(v, "browser-client.mjs"), "utf8")) +
    "\nexport { Fc as createOriginalAgent };\n",
);
await fs.copyFile(
  path.join(v, "browser-accessibility.wasm.br"),
  path.join(out, "browser-accessibility.wasm.br"),
);
await fs.copyFile(path.join(v, "docs/api.json"), path.join(out, "api.json"));
const files = {};
for (const name of [
  "browser.mjs",
  "original-runtime.mjs",
  "original-client.mjs",
  "browser-accessibility.wasm.br",
  "api.json",
]) {
  const b = await fs.readFile(path.join(out, name));
  files[name] = {
    bytes: b.length,
    sha256: crypto.createHash("sha256").update(b).digest("hex"),
  };
}
await fs.writeFile(
  path.join(out, "manifest.json"),
  JSON.stringify(
    { version: "26.928.21956-adapter.1", entry: "browser.mjs", files },
    null,
    2,
  ) + "\n",
);
console.log("SDK manifest generated");
