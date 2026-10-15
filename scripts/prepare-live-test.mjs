// 별도의 Chrome for Testing 실행 파일을 지정해 개인 프로필과 분리한다.
import fs from "node:fs/promises";
import path from "node:path";
import { ROOT } from "../bridge/config.mjs";
const executable = process.env.TEST_CHROME;
if (!executable)
  throw Error("Set TEST_CHROME to the official Chrome for Testing executable.");
const ext = path.join(ROOT, ".local/test-extension");
await fs.mkdir(ext, { recursive: true });
await fs.cp(path.join(ROOT, "extension"), ext, { recursive: true });
let s = await fs.readFile(path.join(ext, "background.mjs"), "utf8");
s = s.replace(
  /token,\s*profileName\s*=\s*["']Chrome["']/,
  "token='integration-test-only',profileName='Disposable test Chrome'",
);
await fs.writeFile(path.join(ext, "background.mjs"), s);
const config = {
  browser: {
    browserName: "chromium",
    launchOptions: {
      executablePath: path.resolve(executable),
      headless: true,
      args: [
        "--enable-features=WebMCP",
        "--enable-blink-features=WebMCP",
        "--disable-extensions-except=" + ext,
        "--load-extension=" + ext,
      ],
      ignoreDefaultArgs: ["--disable-extensions"],
    },
    contextOptions: {},
  },
};
await fs.writeFile(
  path.join(ROOT, ".local/cli.config.json"),
  JSON.stringify(config, null, 2),
);
console.log("Prepared .local/cli.config.json and isolated test extension.");
