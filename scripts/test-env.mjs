import { startBroker } from "../bridge/daemon.mjs";
import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs/promises";
const broker = await startBroker({
  port: 29651,
  secret: "integration-test-only",
  allowUploads: true,
  allowHistory: true,
});
const python = spawn("python3", ["server/serve.py"], {
  stdio: ["ignore", "ignore", "inherit"],
});
const server = http.createServer(async (req, res) => {
  try {
    const name = new URL(req.url, "http://localhost").pathname;
    const file = new URL(
      "../tests/fixture/" + (name === "/" ? "index.html" : name.slice(1)),
      import.meta.url,
    );
    if (!file.pathname.includes("/tests/fixture/")) throw Error("bad path");
    res.setHeader(
      "Content-Type",
      name.endsWith(".txt")
        ? "text/plain"
        : name.endsWith(".png")
          ? "image/png"
          : "text/html",
    );
    res.end(await fs.readFile(file));
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(29653, "127.0.0.1", r));
console.log(
  "Test MCP http://127.0.0.1:29651/mcp; fixture http://127.0.0.1:29653/",
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    python.kill();
    await broker.close();
    await new Promise((r) => server.close(r));
    process.exit();
  });
