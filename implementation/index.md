# 구현 상태

2026-10-16: 서버 0.3.0으로 범용 에이전트 help 보완과 검증 기록을 정리했습니다. Chrome 확장과 MCP 프로그램에서 HTTP·stdio를 함께 지원합니다. 기본 실행에는 별도 중계/Python 프로세스가 필요 없습니다.

- HTTP MCP endpoint: `http://127.0.0.1:29651/mcp`
- stdio: `node bridge/cli.mjs --transport stdio`, 에이전트 앱이 자동 실행
- 툴: `browser_js`, `browser_js_reset`, `browser_help`
- 스킬 없이 사용하는 6개 help 주제·API 색인/상세, 서버 instructions·툴 설명·오류별 복구 안내
- help는 JS Worker·Chrome 없이 실행하며 기존 변수·탭 사용권을 변경하지 않음
- 세션별 persistent JS, top-level await, 여러 에이전트 독립 상태, 탭 lease
- 원본 SDK/핸들러/WASM과 직접 작성한 Chrome transport 구분
- 현재 자동 테스트22개 통과(Node 25·22), help 예제 실제 Chrome22케이스 통과. 기존 HTTP·stdio 혼용12케이스 기록 유지
- 실제 캡처가 JPEG인데 PNG로 표시하던 MIME 불일치를 공통 MCP 응답에서 보정
- 초기 HTTP 카탈로그129 API 호출 확인. 원본 브라우저 로직은 그대로 재사용
- YouTube 자막 없음, beforeunload 자동 승인, Codex 앱 전용 기능 차이는 [호환성 문서](../docs/compatibility.md)에 기록

[기록](log.md) · [사용법](../README.md) · [원시 증거](../docs/validation/coverage.json)

help 보완의 실제 Chrome 입력/결과는 [help-live.json](../docs/validation/help-live.json), Node 22 테스트 출력은 [help-unit-node22.txt](../docs/validation/help-unit-node22.txt)에 있습니다. 모델·호스트별 작업 성공률 평가는 아직 수행하지 않았습니다. 새 도움말은 MCP 프로그램 재시작과 클라이언트의 도구 목록 새로 읽기 후 사용할 수 있습니다.
