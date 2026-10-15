import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { brotliDecompressSync } from "node:zlib";
import { WASI } from "node:wasi";
import {
  metadata,
  normalize,
  identity,
  initOriginalCore,
  loadOriginalCore,
} from "../sdk/original-runtime.mjs";
test("생성된 런타임이 원본 전체와 동일한 prefix를 보존", async () => {
  for (const [original, generated] of [
    ["browser-service.mjs", "original-runtime.mjs"],
    ["browser-client.mjs", "original-client.mjs"],
  ]) {
    const raw = await fs.readFile(
      new URL("../vendor/openai/26.928.21956/" + original, import.meta.url),
    );
    const generatedBytes = await fs.readFile(
      new URL("../sdk/" + generated, import.meta.url),
    );
    assert.deepEqual(generatedBytes.subarray(0, raw.length), raw);
  }
});
test("원본 DOM/AX 정규화와 WASM은 독립 실행 가능", async () => {
  const data = {
    documents: [
      {
        nodes: {
          backendNodeId: [1, 2],
          nodeName: [0, 1],
          attributes: [[], []],
          parentIndex: [-1, 0],
        },
        layout: {
          nodeIndex: [0, 1],
          bounds: [
            [0, 0, 800, 600],
            [0, 10000, 100, 20],
          ],
        },
      },
    ],
    strings: ["BODY", "BUTTON"],
  };
  const meta = metadata(data, new Set([1, 2]));
  const nodes = normalize(
    [
      {
        frame: { frameId: "f" },
        targetId: "tab:1",
        actionTargetId: null,
        metadata: meta,
        nodes: [
          {
            nodeId: "ax1",
            backendDOMNodeId: 1,
            role: { value: "RootWebArea" },
            name: { value: "Test" },
            childIds: ["ax2"],
          },
          {
            nodeId: "ax2",
            backendDOMNodeId: 2,
            role: { value: "button" },
            name: { value: "Run" },
            childIds: [],
          },
        ],
      },
    ],
    [],
  );
  assert.equal(nodes[1].parentIndex, 0);
  assert.equal(identity(1, nodes[1]), "1:1|0:|1:2");
  assert.equal(meta.get(2).bounds[1], 10000);
  initOriginalCore();
  const core = await loadOriginalCore(
    new URL("../sdk/browser-accessibility.wasm.br", import.meta.url),
  );
  const revision = core.buildRevision(null, {
    capturedAt: new Date().toISOString(),
    tab: { id: 1, title: "Test", url: "https://example.com", active: true },
    nodes: nodes.map(({ frameId, ...n }) => n),
    warnings: [],
  });
  assert.match(revision.text, /1 button Run/);
  assert.equal(revision.identityForElement(1), "1:1|0:|1:2");
});
