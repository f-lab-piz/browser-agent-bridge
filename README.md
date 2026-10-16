# Browser Agent Bridge

호환성 연구용 Chrome 확장 + MCP 프로그램입니다. HTTP와 stdio가 같은 브라우저 툴·JavaScript 실행부를 사용합니다. 원본 JS/WASM을 포함하며 원본과 직접 작성한 어댑터를 구분합니다.

현재 버전은 **0.3.0**입니다. [변경 기록](CHANGELOG.md)에서 추가 기능과 검증 범위를 확인할 수 있습니다.

| 방식  | 실행 주체                            | 에이전트 연결          | 확장 연결                      |
| ----- | ------------------------------------ | ---------------------- | ------------------------------ |
| HTTP  | 사용자가 MCP 프로그램 실행           | Streamable HTTP `/mcp` | 같은 프로그램의 WebSocket      |
| stdio | 에이전트 앱이 MCP 프로그램 자동 실행 | stdin/stdout           | 같은 자식 프로세스의 WebSocket |

두 방식 모두 **별도 중계 프로세스나 Python 서버 없이** 기본 SDK를 실행합니다. 원격 SDK 호스팅은 선택 사항입니다.

## 공통 준비

Node.js 22.19 이상, Chrome 125 이상이 필요합니다. 일부 기능(WebMCP 등)은 더 최신 Chrome과 기능 활성화가 필요합니다.

```bash
npm ci
npm run build
node bridge/cli.mjs --pair
```

`--pair`는 프로그램을 상시 실행하지 않고 연결 토큰을 준비해 보여줍니다. 토큰은 `.local/token`에 저장하며 여러 MCP 프로세스가 공유합니다. `BROWSER_BRIDGE_TOKEN`으로 별도 값을 지정할 수도 있습니다.

1. Chrome `chrome://extensions` → 개발자 모드 → 압축 해제된 확장 로드 → `extension/` 선택.
2. 확장 아이콘 → 옵션에서 표시된 토큰을 저장합니다. 기본 주소는 `ws://127.0.0.1:29651`입니다.
3. **로컬 HTTP·stdio 프로세스 자동 연결**을 켜 둡니다.
4. 아래 HTTP 또는 stdio 설정을 에이전트 앱에 등록합니다.

기존 설치에서는 저장소를 업데이트한 뒤 확장도 새로고침해야 복수 연결 기능이 적용됩니다.

## stdio: 에이전트가 자동 실행

MCP 클라이언트가 지원하는 JSON 설정 예입니다. `args`의 경로를 실제 저장소의 **절대 경로**로 바꾸세요.

```json
{
  "mcpServers": {
    "browser": {
      "command": "node",
      "args": [
        "/absolute/path/browser-agent-bridge/bridge/cli.mjs",
        "--transport",
        "stdio"
      ]
    }
  }
}
```

GUI 앱에서 `node`를 찾지 못하면 `command`에도 Node 실행 파일의 절대 경로를 지정하세요. 업로드/기록 조회가 필요하면 args에 `--allow-uploads`, `--allow-history`를 추가합니다.

별도 서버를 먼저 켤 필요가 없습니다. 각 에이전트 앱은 자체 MCP 자식 프로세스를 실행합니다. stdio의 기본 포트는 **29652–29660 중 빈 포트**이며, 확장이 자동으로 여러 프로세스에 연결합니다. 29651은 HTTP 기본값을 위해 남겨 둡니다.

MCP stdout에는 JSON-RPC만 기록하며 로그는 stderr로 보냅니다. MCP command에 일반 `npm run`을 넣으면 npm 출력이 섞일 수 있으므로 위의 Node 실행 명령을 사용하세요. stdin 종료 또는 SIGTERM 시 프로그램과 포트를 정리합니다.

## HTTP: 하나의 주소를 공유

```bash
npm run mcp:http
# 또는 node bridge/cli.mjs --transport http --allow-uploads --allow-history
```

연결 주소는 `http://127.0.0.1:29651/mcp`입니다. 호스트별 설정 형식은 다를 수 있습니다.

```json
{
  "mcpServers": {
    "browser": {
      "type": "http",
      "url": "http://127.0.0.1:29651/mcp",
      "headers": { "Authorization": "Bearer <공통 준비에서 얻은 토큰>" }
    }
  }
}
```

여러 HTTP 클라이언트와 여러 stdio 프로세스를 함께 사용할 수 있습니다. 다른 머신에서는 SSH 터널 등으로 loopback 주소에 연결하세요. 기본 인터넷 공개 바인딩은 제공하지 않습니다.

<!-- browser-help:start -->
## 에이전트 시작 안내

별도 스킬 없이 MCP 도구 `browser_help`로 사용법을 읽습니다. HTTP·stdio 모두 `browser_js`, `browser_js_reset`, `browser_help`를 제공합니다. help는 Chrome·Worker 없이 응답하고 JavaScript 변수를 바꾸지 않습니다.

MCP 호출 예: `browser_help({})`, `browser_help({topic:"ax"})`, `browser_help({api:"tab.getAXState"})`.

### Start here

Call MCP tool browser_js with a code string containing the examples below. These are JavaScript APIs, not separate MCP tools. No imports or runtime setup are needed.

agent, cua and nodeRepl are already bound. Top-level await is supported. Variables persist only within this MCP session; reuse bindings. A reset, timeout reset or new MCP session clears them.

1. Discover paired browsers; this first example is ready to run:

```javascript
nodeRepl.write(await agent.browsers.list());
```

If the list is empty, read browser_help({topic:"troubleshooting"}) and check pairing. Do not invent an ID. If several browsers appear, choose the requested one. The chrome alias is safe only when exactly one extension is connected.

2. In the next browser_js call, replace BROWSER_ID_FROM_LIST with an actual returned ID before running:

```javascript
var browser = await agent.browsers.get("BROWSER_ID_FROM_LIST");
var tab = await browser.tabs.new();
await tab.goto("https://www.naver.com/");
await tab.getAXState();
```

Observe the current AX state, choose a target from it, act, then read fresh AX to verify the result. Stop when the requested result is verified.

3. Reuse browser and tab in later calls. For a fresh complete tree:

```javascript
await tab.getAXState({ disableDiffing: true });
```

getAXState() already emits AX text. Do not wrap it in nodeRepl.write unless using {emit:false}. Select action indices from the observed tree; help never supplies a reusable page index.

Use nodeRepl.write(value) for explicit text and await nodeRepl.emitImage(bytes) for images. Emitted outputs suppress the last expression's automatic result. With no emitted output, the last expression is returned; assignments may return undefined.

This bridge controls paired Chrome extensions. It does not provide Codex IAB, native apps, tab mention URLs, account/approval UI, or automatic end-of-turn tab cleanup. markDeliverable/markHandoff store marks only; explicitly close disposable tabs.

For exact arguments use browser_help({api:"tab.getAXState"}); for a namespace use browser_help({api:"tab.playwright"}). browser.documentation() remains the original SDK reference, not this facade guide.

다른 주제: `browser_help({topic:"session"})`, `browser_help({topic:"output"})`, `browser_help({topic:"troubleshooting"})`, `browser_help({topic:"api"})`.
<!-- browser-help:end -->

세션별로 변수·SDK 컨텍스트를 분리합니다. 같은 탭을 다른 에이전트가 사용하면 명시적으로 거절합니다. `browser_js_reset`, HTTP MCP DELETE, stdio 종료로 사용권을 반납합니다. HTTP의 일시적인 TCP 연결 종료만으로 세션이 종료되지는 않습니다. timeout이나 연결 끊김 직전에 동작이 이미 실행됐을 수 있으므로 재시도 전 새 상태를 확인하세요.

## SDK를 서버에서 관리하기

기본값은 패키지의 `sdk/`입니다. 원격 SDK를 사용하려면 두 방식에 같은 옵션을 적용합니다.

```bash
node bridge/cli.mjs --transport http --sdk-url https://your-host.example/sdk/
node bridge/cli.mjs --transport stdio --sdk-url https://your-host.example/sdk/
```

`BROWSER_SDK_URL` 환경 변수도 지원합니다. Python 정적 서버를 사용하고 싶으면:

```bash
npm run host
# 다른 터미널 또는 stdio args:
node bridge/cli.mjs --transport http --sdk-url http://127.0.0.1:29652/
```

Python이 29652를 사용하면 stdio는 다음 빈 포트를 선택합니다. JS 수정 후 `npm run build`로 manifest를 갱신하고 `browser_js_reset`을 호출하면 다음 실행에서 SDK를 다시 확인합니다. manifest의 파일별 크기·SHA-256을 검증해 캐시합니다. SDK는 로컬 Node 권한으로 실행하므로 신뢰하는 호스트를 사용하세요.

## 포트와 연결

자동 발견은 loopback의 29651–29660으로 한정합니다. nonce와 포트를 포함한 HMAC으로 상대 MCP 프로그램을 먼저 확인한 뒤 토큰으로 연결을 인증합니다. 모든 stdio 포트가 차면 오류를 반환합니다. `--port 31000`처럼 지정하면 확장 옵션의 주소도 `ws://127.0.0.1:31000`으로 맞추세요. 자동 발견을 끄면 옵션의 주소 하나에만 연결합니다.

확장이 깨어 있고 연결을 유지 중이면 새 MCP 프로세스를 약 3초 간격으로 찾습니다. 서비스 워커가 잠들어 있으면 다음 알람(최대 약 30초, Chrome 스케줄링에 따라 지연 가능) 또는 확장 재로딩 때 연결합니다. 도구 호출 시 브라우저가 아직 없으면 잠시 후 다시 조회하세요.

## 코드와 검증

| 경로                    | 역할                                    |
| ----------------------- | --------------------------------------- |
| `bridge/cli.mjs`        | HTTP·stdio 선택과 프로세스 수명         |
| `bridge/mcp-server.mjs` | 공통 MCP 툴·지속 JS 실행                |
| `bridge/help.mjs`, `bridge/help-content.mjs` | Worker 없이 읽는 help·API 색인·공통 가이드 |
| `bridge/daemon.mjs`     | 프로세스 내부 확장/RPC 연결, HTTP 세션  |
| `extension/`            | 복수 연결·전역 탭 사용권·Chrome API/CDP |
| `sdk/`                  | 기본 JS/WASM, 원격 배포 가능            |
| `server/serve.py`       | 선택 사항인 SDK 정적 호스트             |
| `vendor/`               | 원본 코드와 출처·해시                   |

`npm test`는 별도 Chrome/Python 없이 실행합니다. 실제 Chrome 혼용 시험은 `node scripts/live-dual-transport.mjs`이며 별도 테스트 확장 준비 후 실행합니다. 상세 절차와 원시 결과는 [HTTP·stdio 검증](docs/dual-transport.md)에 있습니다.

help 내용을 바꾸면 `node scripts/update-help-readme.mjs`로 README의 생성 구역을 갱신합니다. `node scripts/update-help-readme.mjs --check`와 `npm test`에서 일치 여부를 확인합니다. 기존 MCP 프로그램을 다시 시작하고 클라이언트에서 도구 목록을 새로 읽으면 추가된 `browser_help`와 안내 metadata가 반영됩니다. 이번 변경만으로 확장 재설치는 필요하지 않습니다.

[API별 검증 대조표](docs/compatibility.md) · [설계](docs/architecture.md) · [원본 출처](vendor/README.md) · [원본 조사](docs/reverse-engineering-report.txt)
