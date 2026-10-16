# 변경 기록

## 0.3.0 — 2026-10-16

- `browser_help({topic?, api?})` 추가: quickstart·ax·session·output·troubleshooting·api와 API 색인·상세를 Chrome·Worker 없이 조회한다.
- 서버 instructions와 도구 설명에 시작 경로를 안내하고, 알려진 실행 오류에 관련 help 호출을 추가한다. 기존 JS 도구 입력·성공 출력·세션 유지 동작은 보존한다.
- 실제 JPEG·PNG 바이트에 맞게 MCP 이미지 MIME을 보정한다.
- 공통 가이드에서 README 시작 안내를 생성하고 자동 테스트에서 일치 여부를 확인한다.
- 패키지 버전을 0.3.0으로 맞추고 설계·구현 문서를 정리한다. 원본 SDK·WASM·확장 소스와 출처·해시 기록은 유지한다.

검증: Node 25.2.1 및 Node 22.21.1에서 자동 테스트 22개 통과. HTTP·stdio의 도구 목록·instructions·help 응답 일치, 세션 유지·reset·EOF·탭 lease·SDK 무결성 회귀를 포함한다. README 생성 검사와 diff 공백 검사를 통과했다.

실제 Chrome for Testing 155.0.8059.79의 가이드 흐름 22개는 2026-10-15의 버전 변경 전 구현에서 검증했다. 원시 결과의 서버 버전 0.2.0은 당시 값을 그대로 보존한다. [실제 Chrome 입력·응답](docs/validation/help-live.json) · [Node 22 최종 테스트](docs/validation/help-unit-node22.txt) · [구현 기록](implementation/log.md).

적용: MCP 프로그램을 재시작하고 클라이언트에서 도구 목록과 instructions를 새로 읽는다. 이번 변경만으로 확장 재설치는 필요 없다. 외부 에이전트·모델별 작업 성공률 평가는 아직 수행하지 않았다.

## 0.2.0 — 2026-10-15

HTTP·stdio가 같은 브라우저 실행부를 사용하도록 통합했다. bundled SDK, 복수 프로세스 자동 발견, 전역 탭 lease와 종료 정리를 추가했다. [검증 기록](docs/dual-transport.md).
