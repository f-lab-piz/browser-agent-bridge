# 실행 구조

```text
에이전트 A ── MCP HTTP /mcp ── JS Worker A ─┐
에이전트 B ── MCP HTTP /mcp ── JS Worker B ─┼─ 로컬 브로커 ─ WebSocket ─ Chrome 확장 ─ Chrome API / CDP
                                         │
                 Python SDK 정적 호스트 ─┘
```

로컬 Node 프로세스 하나가 `/mcp`, 내부 `/rpc`, 확장 WebSocket endpoint를 제공합니다. Python은 `sdk/` 파일만 제공합니다. 에이전트는 확장에 직접 접속하지 않습니다.

MCP 초기화마다 Worker를 만들어 `agent`, `cua`, `nodeRepl`, JavaScript lexical 변수와 원본 SDK context를 유지합니다. 한 세션의 코드는 순서대로 실행되며 서로 다른 세션은 독립 실행됩니다. Inspector의 `replMode`와 최상위 await를 사용합니다. **Worker와 Inspector는 적대적인 JavaScript에 대한 보안 샌드박스가 아닙니다. 신뢰하는 에이전트의 코드 실행용입니다.**

에이전트가 `agent.browsers.list()`로 연결된 Chrome 프로필을 선택합니다. 확장의 instance ID가 browser ID가 됩니다. 프로필이 하나면 `chrome` 별칭을 사용할 수 있습니다. 여러 프로필이 있으면 실제 ID를 선택합니다.

확장은 고정된 Native API 어댑터만 포함합니다. 원격에서 내려받은 SDK는 확장이 아니라 Node Worker에서 실행합니다. 원본 Playwright·AX·대화상자·다운로드·내보내기 핸들러와 원본 WASM을 그대로 사용하고, Chrome Native API 통신 계층을 직접 구현했습니다.

탭 lease는 에이전트 세션 단위입니다. 같은 탭에 다른 세션이 이미 붙어 있으면 조작을 거절합니다. `browser_js_reset`, MCP DELETE 종료, 실행 timeout 시 반납합니다. HTTP TCP 연결이 끊긴 것만으로는 MCP 세션 종료를 의미하지 않습니다. 종료 시 MCP DELETE를 보내거나 reset을 호출하세요.

권한: loopback 바인딩과 개인 토큰을 사용합니다. history와 파일 업로드는 각각 `--allow-history`, `--allow-uploads`로 명시적으로 활성화합니다. 토큰과 다운로드된 SDK 캐시는 Git에 포함하지 않습니다. 파일 URL 업로드는 Chrome 확장 상세 설정에서 파일 URL 접근 허용이 필요할 수 있습니다.

호환성 한계: ChatGPT 고유 승인 UI·계정·라이브러리 저장·내장 브라우저는 제공하지 않습니다. Chrome 창 visibility는 window minimize/restore로 대응합니다. 기존 Codex를 위한 browser access 서명·계정 인증을 위조하거나 해당 서비스에 연결하지 않습니다.
