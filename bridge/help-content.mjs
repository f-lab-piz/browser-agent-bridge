import documents from "../vendor/openai/26.928.21956/docs/documents.json" with { type: "json" };

// 문서 선택과 MCP 호출 metadata만 정의한다. 사용 전략은 원본 문서에서 그대로 읽는다.
export const DOCUMENT_NAMES = documents.map(({ name }) => name);
export const TOPIC_DOCUMENTS = {
  quickstart: "accessibility",
  ax: "accessibility",
  session: "api-use-behavior",
  output: "screenshots",
  troubleshooting: "browser-troubleshooting",
};
export const HELP_TOPICS = [
  ...Object.keys(TOPIC_DOCUMENTS),
  "documents",
  "api",
];
export const SERVER_INSTRUCTIONS =
  'Browser documentation: browser_help({}). Document index: browser_help({topic:"documents"}). API index: browser_help({topic:"api"}).';
export const JS_DESCRIPTION =
  "Execute JavaScript with persistent agent, cua and nodeRepl bindings. Supports top-level await; variables and browser objects persist within this MCP session. Browser actions run on the paired Chrome extension. Trusted code only. Packaged original documentation is available through browser_help.";
export const RESET_DESCRIPTION =
  "Reset this MCP JavaScript session and clear its variables and browser bindings.";
export const HELP_DESCRIPTION =
  'Read packaged original browser documentation without running JavaScript or connecting Chrome. No arguments returns the original accessibility document. topic:"documents" lists original document names; pass a name as topic to read it verbatim. topic:"api" lists namespaces; api selects an original SDK API or namespace, e.g. tab.ax or tab.playwright. API names are JavaScript APIs inside browser_js, not separate MCP tools.';

export const API_ROOTS = {
  "agent.browsers": "Browsers",
  "agent.documentation": "Documentation",
  browser: "Browser",
  "browser.tabs": "Tabs",
  "browser.user": "BrowserUser",
  tab: "Tab",
  "tab.ax": "AXAPI",
  "tab.playwright": "PlaywrightAPI",
  "tab.cua": "CUAAPI",
  "tab.dom_cua": "DomCUAAPI",
  "tab.content": "ContentAPI",
  "tab.clipboard": "TabClipboardAPI",
  "tab.dev": "TabDevAPI",
  frame: "PlaywrightFrameLocator",
  locator: "PlaywrightLocator",
  download: "PlaywrightDownload",
  chooser: "PlaywrightFileChooser",
  alertDialog: "AlertDialog",
  beforeUnloadDialog: "BeforeUnloadDialog",
  confirmDialog: "ConfirmDialog",
  promptDialog: "PromptDialog",
};

export function renderReadmeHelp() {
  return [
    "## 에이전트 문서 조회",
    "HTTP·stdio 모두 `browser_js`, `browser_js_reset`, `browser_help`를 제공합니다. help는 Chrome·Worker 없이 원본 문서를 읽으며 JavaScript 변수를 바꾸지 않습니다.",
    "help 본문은 `vendor/openai/26.928.21956/docs/`의 원문을 수정·요약 없이 반환합니다. 자체 사용 전략·예제·복구 가이드는 추가하지 않습니다. 원본 앱 전용 설명이 포함되어 있으므로 브릿지의 실제 지원 범위는 [호환성 문서](docs/compatibility.md)를 확인하세요.",
    '- `browser_help({})`: 원본 `accessibility.md`.\n- `browser_help({topic:"documents"})`: 원본 문서 색인.\n- `browser_help({topic:"api-use-behavior"})`: 해당 원문.\n- `browser_help({topic:"api"})`: 원본 SDK API 색인.\n- `browser_help({api:"tab.ax.click"})`: 원본 API 선언과 참조형.',
    "기존 topic 별칭: `quickstart`·`ax` → `accessibility`, `session` → `api-use-behavior`, `output` → `screenshots`, `troubleshooting` → `browser-troubleshooting`. 자체 facade 설명 대신 원본 `tab.ax.*` API를 조회합니다.",
  ].join("\n\n");
}
