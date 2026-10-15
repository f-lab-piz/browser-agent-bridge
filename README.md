# Browser Agent Bridge

**private 연구용** Chrome 확장 + HTTP MCP/JavaScript 브릿지 + Python SDK 정적 호스팅입니다. 확보한 원본 브라우저 JavaScript/WASM을 포함하며 원본과 자체 어댑터를 구분합니다.

## 시작

Node.js 22.19 이상 또는 24.11 이상, Python 3, Chrome 125 이상이 필요합니다. 현재 macOS Chrome for Testing에서 시험했습니다.

```bash
npm ci
npm run build
npm run host
```

다른 터미널에서:

```bash
npm run bridge
# 필요한 경우: npm run bridge -- --allow-uploads --allow-history
```

브릿지가 연결 토큰과 `http://127.0.0.1:29651/mcp` 주소를 출력합니다. 토큰은 `.local/token`에 저장되며 Git에는 올라가지 않습니다.

1. Chrome의 `chrome://extensions`에서 개발자 모드를 켭니다.
2. 압축 해제된 확장 프로그램 로드 → 이 저장소의 `extension/`을 선택합니다.
3. 확장 아이콘을 눌러 옵션에서 브릿지 주소 `ws://127.0.0.1:29651`과 토큰을 저장합니다.
4. 에이전트의 MCP 설정에 HTTP 주소와 `Authorization: Bearer <토큰>` 헤더를 추가합니다.

호스트가 지원하는 HTTP MCP 설정 예:

```json
{
  "mcpServers": {
    "browser": {
      "type": "http",
      "url": "http://127.0.0.1:29651/mcp",
      "headers": { "Authorization": "Bearer <로컬 토큰>" }
    }
  }
}
```

## JavaScript 호출

MCP 툴은 `browser_js`, `browser_js_reset`입니다. `browser_js`의 `code`에 다음 코드를 전달합니다.

```javascript
const browser = await agent.browsers.get("chrome");
const tab = await browser.tabs.new();
await tab.goto("https://www.naver.com");
await tab.getAXState();
```

다음 호출에서 같은 변수를 사용할 수 있습니다.

```javascript
await tab.playwright.getByRole("button", { name: "검색", exact: true }).click();
await tab.getAXState();
```

`nodeRepl.write(value)`로 필요한 값을 출력하고, `await nodeRepl.emitImage(await tab.screenshot({fullPage:false}))`로 이미지를 반환할 수 있습니다. `cua.getTab`, `cua.listTabs`, `cua.createBrowserTab` 등 브라우저 facade도 제공합니다.

여러 에이전트가 같은 HTTP endpoint에 접속해도 변수·SDK context는 MCP 세션별로 나뉩니다. 같은 탭의 동시 조작은 lease로 막습니다. MCP DELETE 종료 또는 `browser_js_reset`으로 사용권을 반납합니다.

## 코드 배치

| 경로                          | 역할                                          |
| ----------------------------- | --------------------------------------------- |
| `extension/`                  | 실제 Chrome API·CDP 실행                      |
| `bridge/`                     | HTTP MCP, 지속 JS 실행, 확장 통신·탭 lease    |
| `sdk/`                        | 호스팅해서 내려받는 SDK와 원본 기반 생성 모듈 |
| `server/serve.py`             | SDK 파일만 제공하는 정적 서버                 |
| `vendor/openai/26.928.21956/` | 원본 JS·WASM·문서·해시                        |
| `docs/`                       | 설계, 원본 조사, API 대조 및 검증 결과        |

`npm test`는 독립적인 단위·HTTP 통합 테스트입니다. 실제 Chrome을 사용한 시험은 `docs/validation/`과 호환성 문서를 확인하세요. API 노출과 실제 실행 성공, Codex와 완전 동일하다는 주장을 구분합니다.

Python 서버를 바꾸려면 `BROWSER_SDK_URL`로 manifest의 기본 URL을 지정합니다. SDK manifest의 파일별 해시를 검증하고 캐시합니다. 서버 운영자가 제공하는 JS를 로컬 Node 권한으로 실행하는 구조이므로 신뢰하는 SDK 호스트만 사용하세요.

[API별 검증 대조표](docs/compatibility.md) · [설계](docs/architecture.md) · [원본 출처](vendor/README.md) · [원본 조사](docs/reverse-engineering-report.txt)

원격 머신의 에이전트는 SSH 터널 등으로 이 loopback 주소에 연결할 수 있습니다. 현재 브릿지는 인터넷 공개 서버로 바인딩하지 않습니다.
