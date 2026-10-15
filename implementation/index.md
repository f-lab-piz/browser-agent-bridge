# 구현 상태

2026-10-15: 서버 0.2.0. Chrome 확장과 MCP 프로그램에서 HTTP·stdio를 함께 지원합니다. 기본 실행에는 별도 중계/Python 프로세스가 필요 없습니다.

- HTTP MCP endpoint: `http://127.0.0.1:29651/mcp`
- stdio: `node bridge/cli.mjs --transport stdio`, 에이전트 앱이 자동 실행
- 툴: `browser_js`, `browser_js_reset`
- 세션별 persistent JS, top-level await, 여러 에이전트 독립 상태, 탭 lease
- 원본 SDK/핸들러/WASM과 직접 작성한 Chrome transport 구분
- 현재 자동 테스트16개 통과, 실제 HTTP·stdio 혼용12케이스 통과
- 초기 HTTP 카탈로그129 API 호출 확인. 원본 브라우저 로직은 그대로 재사용
- YouTube 자막 없음, beforeunload 자동 승인, Codex 앱 전용 기능 차이는 [호환성 문서](../docs/compatibility.md)에 기록

[기록](log.md) · [사용법](../README.md) · [원시 증거](../docs/validation/coverage.json)
