// help의 공통 원본에서 README의 표시 구역만 갱신한다.
import fs from "node:fs/promises";
import { renderReadmeHelp } from "../bridge/help-content.mjs";
const file = new URL("../README.md", import.meta.url);
const text = await fs.readFile(file, "utf8");
const pattern = /<!-- browser-help:start -->[\s\S]*?<!-- browser-help:end -->/;
if (!pattern.test(text)) throw Error("README help markers not found");
const next = text.replace(
  pattern,
  "<!-- browser-help:start -->\n" +
    renderReadmeHelp() +
    "\n<!-- browser-help:end -->",
);
if (process.argv.includes("--check")) {
  if (next !== text)
    throw Error(
      "README help is stale; run node scripts/update-help-readme.mjs",
    );
} else await fs.writeFile(file, next);
