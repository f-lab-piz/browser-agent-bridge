// 기존 조사 카탈로그의 상태와 이번 구현의 실행 증거를 분리한다.
import fs from "node:fs/promises";
const catalog = JSON.parse(
  await fs.readFile("docs/audit-catalog.json", "utf8"),
);
const main = JSON.parse(
  await fs.readFile("docs/validation/current-live-results.json", "utf8"),
);
const extra = JSON.parse(
  await fs.readFile("docs/validation/extra-live-results.json", "utf8"),
);
const external = JSON.parse(
  await fs.readFile("docs/validation/external-live-results.json", "utf8"),
);
const groups = {
  setup: ["agent.browsers.get", "browser.tabs.new", "tab.goto"],
  cleanup: ["tab.close"],
  navigation: [
    "tab.back",
    "tab.forward",
    "tab.reload",
    "tab.playwright.expectNavigation",
  ],
  "mark lifecycle": ["tab.markHandoff", "tab.markDeliverable"],
  "AX actions": ["tab.setValue", "tab.typeText", "tab.pressKey"],
  "file chooser": [
    "tab.playwright.waitForEvent",
    "chooser.isMultiple",
    "chooser.setFiles",
  ],
  download: ["tab.playwright.waitForEvent", "download.path"],
  "confirm dialog": ["tab.getJsDialog", "confirmDialog.accept"],
  "alert dialog": ["tab.getJsDialog", "alertDialog.dismiss"],
  "prompt dialog": ["tab.getJsDialog", "promptDialog.accept"],
};
const records = new Map();
for (const [file, rows] of [
  ["current-live-results.json", main],
  ["extra-live-results.json", extra],
  ["external-live-results.json", external],
])
  for (const row of rows) {
    if (row.status !== "SUCCESS" || row.expectedError) continue;
    for (const name of [row.name, ...(groups[row.name] ?? [])]) {
      const evidence = records.get(name) ?? [];
      evidence.push(file + "#" + row.name);
      records.set(name, evidence);
    }
  }
records.set("mcp__cua_repl.js", ["tests/http.test.mjs (browser_js adapter)"]);
records.set("mcp__cua_repl.js_reset", [
  "tests/http.test.mjs (browser_js_reset adapter)",
]);
const rows = catalog.map((x) => ({
  name: x.name,
  status:
    x.name === "beforeUnloadDialog.dismiss"
      ? "UNAVAILABLE_AUTO_ACCEPT"
      : x.name === "tab.content.exportYouTubeTranscript"
        ? "EXTERNAL_NO_TRANSCRIPT"
        : records.has(x.name)
          ? "CALL_VERIFIED"
          : "NOT_VERIFIED",
  evidence: records.get(x.name) ?? [],
  note: x.name.startsWith("mcp__")
    ? "동등 역할의 자체 MCP 툴명은 browser_js / browser_js_reset"
    : x.name === "beforeUnloadDialog.dismiss"
      ? "원본 엔진이 beforeunload를 자동 승인하여 dismiss 핸들을 얻지 못함"
      : x.name === "tab.content.exportYouTubeTranscript"
        ? "원본 핸들러 연결, 실제 영상은 No transcript is available 오류"
        : x.name === "tab.markDeliverable" || x.name === "tab.markHandoff"
          ? "자체 브릿지에서 마크 저장. Codex 턴 종료 정책은 별도 앱 기능"
          : x.name.startsWith("visibility.")
            ? "Chrome 창 최소화/복원 매핑. IAB 표시와 다름"
            : x.name.startsWith("cua.")
              ? "자체 브라우저 facade. native apps/mention/deep-link는 범위 밖"
              : "",
}));
await fs.writeFile(
  "docs/validation/coverage.json",
  JSON.stringify(
    {
      recordedOn: "2026-10-15",
      originalAppVersion: "26.928.21956",
      chrome: "Chrome for Testing 155.0.8059.79 mac-arm64",
      webmcpFlags: [
        "--enable-features=WebMCP",
        "--enable-blink-features=WebMCP",
      ],
      scope:
        "카탈로그131 API. CALL_VERIFIED는 기록된 입력 호출 성공이며 전체 옵션/사이트에서의 동등성을 보증하지 않는다.",
      counts: Object.fromEntries(
        Object.entries(Object.groupBy(rows, (x) => x.status)).map(([k, v]) => [
          k,
          v.length,
        ]),
      ),
      rows,
    },
    null,
    2,
  ) + "\n",
);
await fs.writeFile(
  "docs/compatibility.md",
  "# 브라우저 API 검증 대조표\n\n2026-10-15 · 원본 앱 26.928.21956 · Chrome for Testing 155.0.8059.79 · macOS arm64.\n\n원본 클라이언트/명령 핸들러와 AX WASM을 재사용합니다. Chrome 어댑터, 브로커, HTTP MCP, CUA facade는 직접 작성했습니다. **호출 성공은 모든 옵션과 모든 사이트에서 Codex와 완전히 같다는 의미가 아닙니다.**\n\n자동 테스트 6개 통과. 로컬 Chrome 시험 94개와 추가 시험 32개 통과(예상 정책 거절 포함). 실제 공개 Google Docs를 PDF 19,032 bytes, `%PDF-1.4`로 내보냈습니다. YouTube 자막은 원본 핸들러에서 자막 없음 오류를 받았습니다. `beforeunload.dismiss`는 원본 엔진 자동 승인 때문에 직접 실행하지 못했습니다.\n\nWebMCP 실제 등록/호출 시험은 위 Chrome에서 `--enable-features=WebMCP --enable-blink-features=WebMCP`를 켠 별도 테스트 프로필로 수행했습니다. Chrome 147에서는 `WebMCP.enable`이 없어서 실패했습니다. 일반 Chrome에서 실험 기능이 꺼져 있거나 도구가 없으면 사용할 수 없습니다. [Chrome 공식 안내](https://developer.chrome.com/docs/ai/webmcp).\n\n`audit-catalog.json`의 status는 **이전 원본 도구 조사** 결과입니다. 이번 구현 상태는 이 문서와 `validation/coverage.json`을 봅니다. 원시 code/input/output은 validation JSON에 있으며 스크린샷은 크기·MIME 메타데이터로 기록했습니다.\n\n| API | 이번 검증 | 근거/차이 |\n|---|---|---|\n" +
    rows
      .map(
        (x) =>
          `| ${x.name} | ${x.status} | ${(x.note || x.evidence.join(", ")).replaceAll("|", "/")} |`,
      )
      .join("\n") +
    "\n\n## 원본 앱과 다른 범위\n\n- HTTP MCP 툴 이름은 `browser_js`, `browser_js_reset`. 한 세션 안의 변수·객체를 유지합니다. 자동 출력이 있으면 마지막 표현식은 중복 출력하지 않습니다. 명시적 출력은 `nodeRepl.write`를 사용합니다.\n- Chrome 전용입니다. Codex의 IAB, native app 제어, tab mention URL, 계정/승인 UI, PDF 라이브러리 `getTabContext`, YouTube 로그인/자막 제공을 새로 구현하지 않습니다.\n- `markHandoff`/`markDeliverable` 표시는 저장합니다. Codex의 대화 턴 종료·자동 탭 정리 시스템은 포함하지 않습니다. 탭은 명시적으로 `close()`합니다.\n- visibility는 Chrome 창을 최소화/복원합니다. 같은 창의 다른 탭도 영향을 받을 수 있습니다.\n- clipboard는 원본의 브라우저용 컨텍스트 구현이며 OS 시스템 클립보드와 동일하다는 보장은 없습니다.\n- 여러 HTTP 세션은 JS 상태와 탭 사용권을 나눕니다. 보안 샌드박스나 에이전트별 브라우저 프로필 격리는 아닙니다.\n",
);
console.log(
  Object.fromEntries(
    Object.entries(Object.groupBy(rows, (x) => x.status)).map(([k, v]) => [
      k,
      v.length,
    ]),
  ),
);
console.log(
  "Not verified:",
  rows.filter((x) => x.status === "NOT_VERIFIED").map((x) => x.name),
);
