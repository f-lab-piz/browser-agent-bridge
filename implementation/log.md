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
