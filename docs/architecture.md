# 실행 구조

```text
에이전트 A ─ HTTP /mcp ─ Node MCP 프로그램 ─ JS Worker A ─┐
에이전트 B ─ HTTP /mcp ─ 같은 프로그램     ─ JS Worker B ─┤
에이전트 C ─ stdio ──── 별도 MCP 자식 프로세스 ─ Worker ─┼─ WebSocket ─ Chrome 확장 ─ Chrome API/CDP
에이전트 D ─ stdio ──── 별도 MCP 자식 프로세스 ─ Worker ─┘
                             ↑
                기본: 패키지 sdk/ 파일
                선택: 원격 HTTP(S) SDK 호스트
```

`cli.mjs`는 전송 방식과 포트만 선택합니다. `mcp-server.mjs`가 `browser_js`, `browser_js_reset`과 JS 세션을 공통 생성하고, HTTP는 MCP 세션마다 생성하며 stdio는 자식 프로세스당 하나를 생성합니다. 원본 SDK·핸들러·AX WASM은 양쪽에서 동일합니다.

각 MCP 프로그램이 내부 RPC와 확장 WebSocket endpoint를 같은 프로세스에서 제공합니다. stdio 모드에서는 외부 `/mcp`를 열지 않습니다. 별도 중계 프로세스가 없으며 Python은 선택 사항입니다. Worker는 스레드이므로 별도 중계 프로세스에 해당하지 않습니다.

HTTP 기본 포트는 29651입니다. stdio는 29652–29660 중 빈 포트를 선택하여 HTTP 시작 순서와 관계없이 공존합니다. 확장은 한 서비스 워커의 연결 pool에서 여러 endpoint를 찾고, 개별 socket으로 요청과 응답을 라우팅하며 CDP 이벤트를 연결된 프로세스들에 전달합니다. 토큰은 같은 설치의 `.local/token`을 공유하고 원자적으로 생성합니다. `/discovery`에서 nonce·실제 포트에 대한 HMAC을 검증하여 다른 서비스에 토큰을 먼저 보내지 않도록 합니다.

프로세스 내부 브로커는 세션별 탭 lease를 관리합니다. 확장에서도 `(connectionId, sessionId)`로 전역 lease를 확인하므로 서로 다른 stdio 프로세스와 HTTP 서버 사이에서도 동시 조작을 거절합니다. 생성된 탭은 즉시 lease를 설정합니다. reset/세션 종료는 확장에 반납을 전달하며 WebSocket 단절 시에도 해당 연결의 lease를 해제합니다. 처리 중 단절된 요청은 이미 동작했을 수 있으므로 새 스냅샷을 확인합니다.

각 Worker는 `agent`, `cua`, `nodeRepl`, JS lexical 변수와 원본 SDK 컨텍스트를 유지합니다. 같은 세션은 순서대로 실행하고 다른 세션은 독립 실행합니다. Inspector `replMode`와 top-level await를 사용합니다. **Worker/Inspector는 적대적인 JavaScript를 위한 보안 샌드박스가 아닙니다.**

SDK 기본값은 패키지의 `sdk/manifest.json`입니다. `--sdk-url` 또는 `BROWSER_SDK_URL`로 HTTP(S) 정적 호스트를 선택합니다. 파일 크기·SHA-256과 경로를 검증한 후 manifest 해시별로 캐시합니다. reset 후 다음 Worker에서 다시 manifest를 읽습니다. 원격 SDK는 확장 내부가 아니라 신뢰하는 Node에서 실행합니다.

stdio stdout에는 MCP JSON-RPC만 쓰고 CLI·Worker 로그는 stderr로 보냅니다. stdin EOF/SIGTERM 시 Worker와 endpoint를 정리합니다. HTTP MCP는 DELETE 또는 reset으로 세션을 종료하며 TCP 연결 단절만으로 MCP 세션을 종료하지 않습니다.

브라우저 프로필은 `agent.browsers.list()`의 확장 instance ID로 선택합니다. 하나뿐이면 `chrome` 별칭을 사용할 수 있습니다. 네이티브 앱 제어·Codex 계정/승인 UI·IAB·자동 대화 턴 정리는 포함하지 않습니다. Chrome visibility는 창 최소화/복원에 대응합니다. 원본과의 차이는 [호환성 문서](compatibility.md)에 기록합니다.
