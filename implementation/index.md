# 구현 상태

2026-10-15: Chrome 확장 + Streamable HTTP MCP 브릿지 + Python SDK 정적 호스트 구현과 검증을 완료했습니다.

- MCP endpoint: `http://127.0.0.1:29651/mcp`
- 툴: `browser_js`, `browser_js_reset`
- 세션별 persistent JS, top-level await, 여러 에이전트 독립 상태, 탭 lease
- 원본 SDK/핸들러/WASM과 직접 작성한 Chrome transport 구분
- 자동 테스트 6개 통과, 카탈로그129 API 호출 확인
- YouTube 자막 없음, beforeunload 자동 승인, Codex 앱 전용 기능 차이는 [호환성 문서](../docs/compatibility.md)에 기록

[기록](log.md) · [사용법](../README.md) · [원시 증거](../docs/validation/coverage.json)
