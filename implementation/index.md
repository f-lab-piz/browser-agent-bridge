# 구현 상태

2026-10-16: 서버 0.3.1의 help는 자체 가이드를 제거하고 원본 문서만 제공합니다. Chrome 확장과 MCP 프로그램에서 HTTP·stdio를 함께 지원합니다. 기본 실행에는 별도 중계/Python 프로세스가 필요 없습니다.

- HTTP MCP endpoint: `http://127.0.0.1:29651/mcp`
- stdio: `node bridge/cli.mjs --transport stdio`, 에이전트 앱이 자동 실행
- 툴: `browser_js`, `browser_js_reset`, `browser_help`
- 원본 Markdown 28개를 수정·요약 없이 조회하고 원본 manifest 기반 API 색인/상세 제공. 서버 metadata는 조회 경로만 안내
- help는 JS Worker·Chrome 없이 실행하며 기존 변수·탭 사용권을 변경하지 않음
- 세션별 persistent JS, top-level await, 여러 에이전트 독립 상태, 탭 lease
- 원본 SDK/핸들러/WASM과 직접 작성한 Chrome transport 구분
- 현재 자동 테스트22개로 원문 응답·SHA-256·세션·HTTP/stdio 회귀 확인. 이전 help 예제 Chrome22케이스와 HTTP·stdio 혼용12케이스는 역사적 기록으로 유지
- 실제 캡처가 JPEG인데 PNG로 표시하던 MIME 불일치를 공통 MCP 응답에서 보정
- 초기 HTTP 카탈로그129 API 호출 확인. 원본 브라우저 로직은 그대로 재사용
- YouTube 자막 없음, beforeunload 자동 승인, Codex 앱 전용 기능 차이는 [호환성 문서](../docs/compatibility.md)에 기록

[기록](log.md) · [사용법](../README.md) · [원시 증거](../docs/validation/coverage.json)

0.3.1 Node 22 테스트 출력은 [original-help-unit-node22.txt](../docs/validation/original-help-unit-node22.txt)에 있습니다. [help-live.json](../docs/validation/help-live.json)과 [help-unit-node22.txt](../docs/validation/help-unit-node22.txt)는 자체 가이드 제거 전 기록입니다. 이번 원문 조회 변경으로 실제 Chrome 시험을 새로 수행하지 않았습니다. 모델·호스트별 작업 성공률 평가는 아직 수행하지 않았습니다. MCP 프로그램을 재시작하고 클라이언트의 도구 목록을 새로 읽으면 변경이 반영됩니다.
