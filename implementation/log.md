# 구현 기록

## 2026-10-15

### Plan Input

`planning/index.md`, `planning/log.md`, 사용자 승인: private GitHub 저장소, 원본 스크립트 포함, 전체 브라우저 API, JS 방식 호출, 여러 에이전트를 위한 HTTP MCP.

### Implemented

- MV3 Chrome 확장의 `chrome.debugger`/tabs/history/downloads 어댑터와 WebSocket 연결.
- 원본 JS 클래스·핸들러와 원본 AX WASM을 그대로 연결하는 SDK. 생성 파일은 원본 전체 뒤에 export만 추가.
- Python 정적 SDK 호스트, manifest 파일별 SHA-256 검증과 캐시.
- 공식 MCP SDK의 Streamable HTTP endpoint와 에이전트 세션별 Worker/Inspector REPL.
- 세션별 변수와 tab 객체 유지, 명시적 reset/DELETE, timeout 복구, 탭 lease 충돌 처리.
- CDP 이벤트를 RPC 응답 전에 순서대로 반영. WebMCP 등록 세대가 늦게 무효화되는 문제 수정.
- 131개 이전 조사 항목의 대조표와 raw 호출/결과 증거. 이전 원본 조사 status와 이번 구현 검증을 분리.

### Test Coverage

인증 실패, 탭 lease 거절/반납, 업로드 거절, native Chrome 어댑터, MCP 변수 유지/세션 격리/reset/무한 루프 timeout 후 복구, SDK 경로/해시 오류, 원본 prefix 동일성과 WASM 독립 동작.

별도 Chrome for Testing 155.0.8059.79 프로필에서 AX·DOM·locator/frame·입력·내비게이션·파일선택·다운로드·대화상자·스크린샷·클립보드·자산·WebMCP·동시 에이전트 거절/독립 탭을 확인. WebMCP 테스트 플래그 명시. 공개 Google Docs PDF export 결과 `%PDF-1.4`, 19,032 bytes 확인.

### Test Command and Result

- `npm run build`: 성공
- `npm test`: 6 passed, 0 failed (Node 25.2.1)
- `PATH=/opt/homebrew/opt/node@22/bin:$PATH npm test`: 6 passed, 0 failed (Node 22.21.1)
- `node scripts/live-audit.mjs`: 로컬 Chrome 94/94 시험 통과
- `node scripts/live-extra.mjs`: 추가 32/32 시험 통과. 예상 정책/URL 거절을 포함
- `node scripts/live-external.mjs`: Google Docs PDF export 성공, YouTube 영상은 자막 없음 오류, beforeunload는 자동 승인 후 다음 페이지 도착
- 확장 옵션 변경 후 재연결: 연결 브라우저1개와 AX 조회 재확인 (`reconnect-live-result.json`)
- `node scripts/build-coverage.mjs`: CALL_VERIFIED 129, EXTERNAL_NO_TRANSCRIPT 1, UNAVAILABLE_AUTO_ACCEPT 1

호출 검증은 모든 옵션/사이트에서의 완전 동등성 보증이 아닙니다. 원시 결과는 `docs/validation/`.

### Decisions

원격 SDK는 MV3 확장 내부가 아니라 신뢰하는 로컬 Node에서 실행. OpenAI 계정/권한 서비스를 연결하거나 인증을 위조하지 않음. 원본 보관과 자체 transport를 분리. 단순 loopback HTTP와 bearer token을 사용하며 웹스토어 패키징/공개 배포는 범위 밖. 원본 앱의 승인 UI·IAB·자동 턴 정리까지 복제했다고 표시하지 않음.

### Next Actions

실제 사용자 Chrome에서 확장을 개발자 모드로 로드하고 브릿지 토큰을 옵션에 등록하면 됩니다. 환경별 추가 호환성은 기록된 시험과 구분하여 진행합니다.

## 2026-10-15 HTTP·stdio 통합 (0.2.0)

### Plan Input

사용자 요청: “두방식 모두 지원하게 깔끔하게 만들어봐”. 기존 HTTP 구현을 유지하고 stdio에서는 에이전트가 실행하는 MCP 자식 프로세스가 확장 연결을 함께 제공한다.

### Implemented

- `mcp-server.mjs` 공통 팩토리로 툴·입출력·JS 세션을 공유. `cli.mjs --transport http|stdio`로 선택.
- SDK 기본값을 bundled JS/WASM으로 변경. 파일/HTTP(S) manifest 해시 검증, 선택적 Python/원격 SDK 유지.
- `--pair` 토큰 준비, 동시 시작의 원자적 토큰 생성, stdio 포트29652–29660 자동 선택. HTTP 기본29651 예약.
- 확장 연결 pool, 로컬 자동 발견, nonce·포트 HMAC으로 확인 후 연결. 여러 프로세스 요청/응답 라우팅.
- 확장의 전역 `(connectionId, sessionId)` 탭 lease. reset/EOF/disconnect 반납과 처리 중 단절 시 미반납 방지.
- stdout 프로토콜 전용, Worker 출력 stderr 분리. stdin 종료·SIGTERM 및 선연결/hello 없는 소켓까지 정리.
- 설치·설정·혼용 시험 절차와 원시 결과 기록.

### Test Coverage

HTTP·stdio `listTools()` 전체 동일, 실제 stdio 자식 프로세스의 변수 유지/reset/EOF/포트 해제, stdout 오염 방지, bundled/원격 SDK, 잘못된 해시/경로, 토큰 동시 생성, 발견 주소 중복/설정, HMAC 인증, 다중 연결 라우팅, 전역 lease·연결 중 탭 생성·잔여 소켓 정리, 기존 원본 prefix/WASM 검증.

실제 Chrome 155의 별도 프로필에서 HTTP 하나와 stdio 두 프로세스를 동시에 연결. Python 미실행. AX·locator 입력·이미지·WebMCP, stdio 간/HTTP 간 예상 거절, reset/EOF 후 재획득, 포트 재사용 확인.

### Test Command and Result

- `npm run build`: 성공
- `npm test`: 16 passed, 0 failed (Node 25.2.1)
- `PATH=/opt/homebrew/opt/node@22/bin:$PATH npm test`: 16 passed, 0 failed (Node 22.21.1)
- `node scripts/live-dual-transport.mjs`: 12/12 케이스 통과, 예상 거절2건 포함
- `node bridge/cli.mjs --help`, `node bridge/daemon.mjs --help`: 기존 진입점 포함 정상 종료

원시 증거: `docs/validation/dual-transport-live.json`, `dual-unit-tests*.txt`.

### Decisions

MCP transport를 공통 실행부에서 분리하고 Node 프로세스 자체에 확장 endpoint를 포함. stdio 전용 실행은 HTTP `/mcp`를 노출하지 않음. 원본 브라우저 로직은 변경하지 않음. 기본 포트 범위를 한정하며 더 많은 프로세스는 명시적 포트/주소를 사용. Python·원격 SDK는 선택 사항.

### Next Actions

확장을 새로고침하고 `--pair` 토큰을 저장한 뒤 README의 HTTP 또는 stdio MCP 설정을 적용한다. 추가 앱/브라우저 버전 호환성은 별도 시험으로 기록한다.
