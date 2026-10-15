# 브라우저 API 검증 대조표

서버 0.2.0의 HTTP·stdio 통합 검증은 [별도 기록](dual-transport.md)을 확인하세요. 아래131항목은 원본 기반 초기 HTTP 구현의 API 기준입니다.

2026-10-15 · 원본 앱 26.928.21956 · Chrome for Testing 155.0.8059.79 · macOS arm64.

원본 클라이언트/명령 핸들러와 AX WASM을 재사용합니다. Chrome 어댑터, 브로커, HTTP MCP, CUA facade는 직접 작성했습니다. **호출 성공은 모든 옵션과 모든 사이트에서 Codex와 완전히 같다는 의미가 아닙니다.**

자동 테스트 6개 통과. 로컬 Chrome 시험 94개와 추가 시험 32개 통과(예상 정책 거절 포함). 실제 공개 Google Docs를 PDF 19,032 bytes, `%PDF-1.4`로 내보냈습니다. YouTube 자막은 원본 핸들러에서 자막 없음 오류를 받았습니다. `beforeunload.dismiss`는 원본 엔진 자동 승인 때문에 직접 실행하지 못했습니다.

WebMCP 실제 등록/호출 시험은 위 Chrome에서 `--enable-features=WebMCP --enable-blink-features=WebMCP`를 켠 별도 테스트 프로필로 수행했습니다. Chrome 147에서는 `WebMCP.enable`이 없어서 실패했습니다. 일반 Chrome에서 실험 기능이 꺼져 있거나 도구가 없으면 사용할 수 없습니다. [Chrome 공식 안내](https://developer.chrome.com/docs/ai/webmcp).

`audit-catalog.json`의 status는 **이전 원본 도구 조사** 결과입니다. 이번 구현 상태는 이 문서와 `validation/coverage.json`을 봅니다. 원시 code/input/output은 validation JSON에 있으며 스크린샷은 크기·MIME 메타데이터로 기록했습니다.

| API                                 | 이번 검증               | 근거/차이                                                                                                                 |
| ----------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| agent.browsers.get                  | CALL_VERIFIED           | current-live-results.json#setup, extra-live-results.json#setup, external-live-results.json#setup                          |
| agent.browsers.list                 | CALL_VERIFIED           | current-live-results.json#agent.browsers.list                                                                             |
| browser.documentation               | CALL_VERIFIED           | current-live-results.json#browser.documentation                                                                           |
| browser.history                     | CALL_VERIFIED           | extra-live-results.json#browser.history                                                                                   |
| browser.nameSession                 | CALL_VERIFIED           | extra-live-results.json#browser.nameSession                                                                               |
| browser.user.claimTab               | CALL_VERIFIED           | extra-live-results.json#browser.user.claimTab                                                                             |
| browser.user.openTabs               | CALL_VERIFIED           | current-live-results.json#browser.user.openTabs                                                                           |
| browser.tabs.get                    | CALL_VERIFIED           | extra-live-results.json#browser.tabs.get                                                                                  |
| browser.tabs.list                   | CALL_VERIFIED           | current-live-results.json#browser.tabs.list                                                                               |
| browser.tabs.new                    | CALL_VERIFIED           | current-live-results.json#setup, extra-live-results.json#setup, external-live-results.json#setup                          |
| browser.tabs.selected               | CALL_VERIFIED           | extra-live-results.json#browser.tabs.selected                                                                             |
| tab.back                            | CALL_VERIFIED           | current-live-results.json#navigation                                                                                      |
| tab.close                           | CALL_VERIFIED           | current-live-results.json#cleanup, extra-live-results.json#cleanup, external-live-results.json#cleanup                    |
| tab.forward                         | CALL_VERIFIED           | current-live-results.json#navigation                                                                                      |
| tab.getJsDialog                     | CALL_VERIFIED           | current-live-results.json#confirm dialog, current-live-results.json#prompt dialog, current-live-results.json#alert dialog |
| tab.goto                            | CALL_VERIFIED           | current-live-results.json#setup, extra-live-results.json#setup, external-live-results.json#setup                          |
| tab.markDeliverable                 | CALL_VERIFIED           | 자체 브릿지에서 마크 저장. Codex 턴 종료 정책은 별도 앱 기능                                                              |
| tab.markHandoff                     | CALL_VERIFIED           | 자체 브릿지에서 마크 저장. Codex 턴 종료 정책은 별도 앱 기능                                                              |
| tab.reload                          | CALL_VERIFIED           | current-live-results.json#navigation                                                                                      |
| tab.screenshot                      | CALL_VERIFIED           | current-live-results.json#tab.screenshot                                                                                  |
| tab.title                           | CALL_VERIFIED           | current-live-results.json#tab.title                                                                                       |
| tab.url                             | CALL_VERIFIED           | current-live-results.json#tab.url                                                                                         |
| tab.content.exportGsuite            | CALL_VERIFIED           | external-live-results.json#tab.content.exportGsuite                                                                       |
| tab.content.exportYouTubeTranscript | EXTERNAL_NO_TRANSCRIPT  | 원본 핸들러 연결, 실제 영상은 No transcript is available 오류                                                             |
| tab.playwright.domSnapshot          | CALL_VERIFIED           | current-live-results.json#tab.playwright.domSnapshot                                                                      |
| tab.playwright.evaluate             | CALL_VERIFIED           | current-live-results.json#tab.playwright.evaluate                                                                         |
| tab.playwright.expectNavigation     | CALL_VERIFIED           | current-live-results.json#navigation                                                                                      |
| tab.playwright.frameLocator         | CALL_VERIFIED           | current-live-results.json#tab.playwright.frameLocator                                                                     |
| tab.playwright.getByLabel           | CALL_VERIFIED           | current-live-results.json#tab.playwright.getByLabel                                                                       |
| tab.playwright.getByPlaceholder     | CALL_VERIFIED           | current-live-results.json#tab.playwright.getByPlaceholder                                                                 |
| tab.playwright.getByRole            | CALL_VERIFIED           | current-live-results.json#tab.playwright.getByRole                                                                        |
| tab.playwright.getByTestId          | CALL_VERIFIED           | current-live-results.json#tab.playwright.getByTestId                                                                      |
| tab.playwright.getByText            | CALL_VERIFIED           | current-live-results.json#tab.playwright.getByText                                                                        |
| tab.playwright.locator              | CALL_VERIFIED           | current-live-results.json#tab.playwright.locator                                                                          |
| tab.playwright.waitForEvent         | CALL_VERIFIED           | current-live-results.json#file chooser, current-live-results.json#download                                                |
| tab.playwright.waitForLoadState     | CALL_VERIFIED           | current-live-results.json#tab.playwright.waitForLoadState                                                                 |
| tab.playwright.waitForTimeout       | CALL_VERIFIED           | current-live-results.json#tab.playwright.waitForTimeout                                                                   |
| tab.playwright.waitForURL           | CALL_VERIFIED           | current-live-results.json#tab.playwright.waitForURL                                                                       |
| frame.frameLocator                  | CALL_VERIFIED           | current-live-results.json#frame.frameLocator                                                                              |
| frame.getByLabel                    | CALL_VERIFIED           | current-live-results.json#frame.getByLabel                                                                                |
| frame.getByPlaceholder              | CALL_VERIFIED           | current-live-results.json#frame.getByPlaceholder                                                                          |
| frame.getByRole                     | CALL_VERIFIED           | current-live-results.json#frame.getByRole                                                                                 |
| frame.getByTestId                   | CALL_VERIFIED           | current-live-results.json#frame.getByTestId                                                                               |
| frame.getByText                     | CALL_VERIFIED           | current-live-results.json#frame.getByText                                                                                 |
| frame.locator                       | CALL_VERIFIED           | current-live-results.json#frame.locator                                                                                   |
| locator.all                         | CALL_VERIFIED           | current-live-results.json#locator.all                                                                                     |
| locator.allTextContents             | CALL_VERIFIED           | current-live-results.json#locator.allTextContents                                                                         |
| locator.and                         | CALL_VERIFIED           | current-live-results.json#locator.and                                                                                     |
| locator.check                       | CALL_VERIFIED           | current-live-results.json#locator.check                                                                                   |
| locator.click                       | CALL_VERIFIED           | current-live-results.json#locator.click                                                                                   |
| locator.count                       | CALL_VERIFIED           | current-live-results.json#locator.count                                                                                   |
| locator.dblclick                    | CALL_VERIFIED           | current-live-results.json#locator.dblclick                                                                                |
| locator.downloadMedia               | CALL_VERIFIED           | extra-live-results.json#locator.downloadMedia                                                                             |
| locator.evaluate                    | CALL_VERIFIED           | current-live-results.json#locator.evaluate                                                                                |
| locator.evaluateAll                 | CALL_VERIFIED           | current-live-results.json#locator.evaluateAll                                                                             |
| locator.fill                        | CALL_VERIFIED           | current-live-results.json#locator.fill                                                                                    |
| locator.filter                      | CALL_VERIFIED           | current-live-results.json#locator.filter                                                                                  |
| locator.first                       | CALL_VERIFIED           | current-live-results.json#locator.first                                                                                   |
| locator.getAttribute                | CALL_VERIFIED           | current-live-results.json#locator.getAttribute                                                                            |
| locator.getByLabel                  | CALL_VERIFIED           | current-live-results.json#locator.getByLabel                                                                              |
| locator.getByPlaceholder            | CALL_VERIFIED           | current-live-results.json#locator.getByPlaceholder                                                                        |
| locator.getByRole                   | CALL_VERIFIED           | current-live-results.json#locator.getByRole                                                                               |
| locator.getByTestId                 | CALL_VERIFIED           | current-live-results.json#locator.getByTestId                                                                             |
| locator.getByText                   | CALL_VERIFIED           | current-live-results.json#locator.getByText                                                                               |
| locator.innerText                   | CALL_VERIFIED           | current-live-results.json#locator.innerText                                                                               |
| locator.isEnabled                   | CALL_VERIFIED           | current-live-results.json#locator.isEnabled                                                                               |
| locator.isVisible                   | CALL_VERIFIED           | current-live-results.json#locator.isVisible                                                                               |
| locator.last                        | CALL_VERIFIED           | current-live-results.json#locator.last                                                                                    |
| locator.locator                     | CALL_VERIFIED           | current-live-results.json#locator.locator                                                                                 |
| locator.nth                         | CALL_VERIFIED           | current-live-results.json#locator.nth                                                                                     |
| locator.or                          | CALL_VERIFIED           | current-live-results.json#locator.or                                                                                      |
| locator.press                       | CALL_VERIFIED           | current-live-results.json#locator.press                                                                                   |
| locator.pressSequentially           | CALL_VERIFIED           | current-live-results.json#locator.pressSequentially                                                                       |
| locator.selectOption                | CALL_VERIFIED           | current-live-results.json#locator.selectOption                                                                            |
| locator.setChecked                  | CALL_VERIFIED           | current-live-results.json#locator.setChecked                                                                              |
| locator.textContent                 | CALL_VERIFIED           | current-live-results.json#locator.textContent                                                                             |
| locator.type                        | CALL_VERIFIED           | current-live-results.json#locator.type                                                                                    |
| locator.uncheck                     | CALL_VERIFIED           | current-live-results.json#locator.uncheck                                                                                 |
| locator.waitFor                     | CALL_VERIFIED           | current-live-results.json#locator.waitFor                                                                                 |
| download.path                       | CALL_VERIFIED           | current-live-results.json#download                                                                                        |
| chooser.isMultiple                  | CALL_VERIFIED           | current-live-results.json#file chooser                                                                                    |
| chooser.setFiles                    | CALL_VERIFIED           | current-live-results.json#file chooser                                                                                    |
| tab.clipboard.read                  | CALL_VERIFIED           | current-live-results.json#tab.clipboard.read                                                                              |
| tab.clipboard.readText              | CALL_VERIFIED           | current-live-results.json#tab.clipboard.readText                                                                          |
| tab.clipboard.write                 | CALL_VERIFIED           | current-live-results.json#tab.clipboard.write                                                                             |
| tab.clipboard.writeText             | CALL_VERIFIED           | current-live-results.json#tab.clipboard.writeText                                                                         |
| tab.dev.logs                        | CALL_VERIFIED           | current-live-results.json#tab.dev.logs                                                                                    |
| alertDialog.dismiss                 | CALL_VERIFIED           | current-live-results.json#alert dialog                                                                                    |
| beforeUnloadDialog.dismiss          | UNAVAILABLE_AUTO_ACCEPT | 원본 엔진이 beforeunload를 자동 승인하여 dismiss 핸들을 얻지 못함                                                         |
| confirmDialog.accept                | CALL_VERIFIED           | current-live-results.json#confirm dialog                                                                                  |
| confirmDialog.dismiss               | CALL_VERIFIED           | extra-live-results.json#confirmDialog.dismiss                                                                             |
| agent.documentation.get             | CALL_VERIFIED           | extra-live-results.json#agent.documentation.get                                                                           |
| promptDialog.accept                 | CALL_VERIFIED           | current-live-results.json#prompt dialog                                                                                   |
| promptDialog.dismiss                | CALL_VERIFIED           | extra-live-results.json#promptDialog.dismiss                                                                              |
| cua.getState                        | CALL_VERIFIED           | 자체 브라우저 facade. native apps/mention/deep-link는 범위 밖                                                             |
| cua.getBrowser                      | CALL_VERIFIED           | 자체 브라우저 facade. native apps/mention/deep-link는 범위 밖                                                             |
| cua.listBrowsers                    | CALL_VERIFIED           | 자체 브라우저 facade. native apps/mention/deep-link는 범위 밖                                                             |
| cua.createBrowserTab                | CALL_VERIFIED           | 자체 브라우저 facade. native apps/mention/deep-link는 범위 밖                                                             |
| cua.getTab                          | CALL_VERIFIED           | 자체 브라우저 facade. native apps/mention/deep-link는 범위 밖                                                             |
| cua.listTabs                        | CALL_VERIFIED           | 자체 브라우저 facade. native apps/mention/deep-link는 범위 밖                                                             |
| tab.getAXState                      | CALL_VERIFIED           | current-live-results.json#tab.getAXState                                                                                  |
| tab.getScreenshot                   | CALL_VERIFIED           | current-live-results.json#tab.getScreenshot                                                                               |
| tab.getAXStateAndScreenshot         | CALL_VERIFIED           | current-live-results.json#tab.getAXStateAndScreenshot                                                                     |
| tab.click                           | CALL_VERIFIED           | extra-live-results.json#tab.click                                                                                         |
| tab.drag                            | CALL_VERIFIED           | extra-live-results.json#tab.drag                                                                                          |
| tab.scroll                          | CALL_VERIFIED           | extra-live-results.json#tab.scroll                                                                                        |
| tab.typeText                        | CALL_VERIFIED           | current-live-results.json#AX actions, extra-live-results.json#tab.typeText                                                |
| tab.paste                           | CALL_VERIFIED           | extra-live-results.json#tab.paste                                                                                         |
| tab.pressKey                        | CALL_VERIFIED           | current-live-results.json#AX actions, extra-live-results.json#tab.pressKey                                                |
| tab.setValue                        | CALL_VERIFIED           | current-live-results.json#AX actions, extra-live-results.json#tab.setValue                                                |
| tab.selectText                      | CALL_VERIFIED           | extra-live-results.json#tab.selectText                                                                                    |
| tab.performSecondaryAction          | CALL_VERIFIED           | extra-live-results.json#tab.performSecondaryAction                                                                        |
| browser.capabilities.list           | CALL_VERIFIED           | current-live-results.json#browser.capabilities.list                                                                       |
| browser.capabilities.get            | CALL_VERIFIED           | current-live-results.json#browser.capabilities.get                                                                        |
| tab.capabilities.list               | CALL_VERIFIED           | current-live-results.json#tab.capabilities.list                                                                           |
| tab.capabilities.get                | CALL_VERIFIED           | current-live-results.json#tab.capabilities.get                                                                            |
| viewport.documentation              | CALL_VERIFIED           | current-live-results.json#viewport.documentation                                                                          |
| viewport.set                        | CALL_VERIFIED           | current-live-results.json#viewport.set                                                                                    |
| viewport.reset                      | CALL_VERIFIED           | current-live-results.json#viewport.reset                                                                                  |
| visibility.documentation            | CALL_VERIFIED           | Chrome 창 최소화/복원 매핑. IAB 표시와 다름                                                                               |
| visibility.get                      | CALL_VERIFIED           | Chrome 창 최소화/복원 매핑. IAB 표시와 다름                                                                               |
| visibility.set                      | CALL_VERIFIED           | Chrome 창 최소화/복원 매핑. IAB 표시와 다름                                                                               |
| pageAssets.documentation            | CALL_VERIFIED           | current-live-results.json#pageAssets.documentation                                                                        |
| pageAssets.list                     | CALL_VERIFIED           | current-live-results.json#pageAssets.list                                                                                 |
| pageAssets.bundle                   | CALL_VERIFIED           | current-live-results.json#pageAssets.bundle                                                                               |
| webmcp.documentation                | CALL_VERIFIED           | current-live-results.json#webmcp.documentation                                                                            |
| webmcp.fetchTools                   | CALL_VERIFIED           | current-live-results.json#webmcp.fetchTools                                                                               |
| webmcp.tools.description            | CALL_VERIFIED           | current-live-results.json#webmcp.tools.description                                                                        |
| webmcp.tools.call                   | CALL_VERIFIED           | extra-live-results.json#webmcp.tools.call                                                                                 |
| mcp__cua_repl.js                    | CALL_VERIFIED           | 동등 역할의 자체 MCP 툴명은 browser_js / browser_js_reset                                                                 |
| mcp__cua_repl.js_reset              | CALL_VERIFIED           | 동등 역할의 자체 MCP 툴명은 browser_js / browser_js_reset                                                                 |

## 원본 앱과 다른 범위

- HTTP MCP 툴 이름은 `browser_js`, `browser_js_reset`. 한 세션 안의 변수·객체를 유지합니다. 자동 출력이 있으면 마지막 표현식은 중복 출력하지 않습니다. 명시적 출력은 `nodeRepl.write`를 사용합니다.
- Chrome 전용입니다. Codex의 IAB, native app 제어, tab mention URL, 계정/승인 UI, PDF 라이브러리 `getTabContext`, YouTube 로그인/자막 제공을 새로 구현하지 않습니다.
- `markHandoff`/`markDeliverable` 표시는 저장합니다. Codex의 대화 턴 종료·자동 탭 정리 시스템은 포함하지 않습니다. 탭은 명시적으로 `close()`합니다.
- visibility는 Chrome 창을 최소화/복원합니다. 같은 창의 다른 탭도 영향을 받을 수 있습니다.
- clipboard는 원본의 브라우저용 컨텍스트 구현이며 OS 시스템 클립보드와 동일하다는 보장은 없습니다.
- 여러 HTTP 세션은 JS 상태와 탭 사용권을 나눕니다. 보안 샌드박스나 에이전트별 브라우저 프로필 격리는 아닙니다.
