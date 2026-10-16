# 계획 기록

2026-10-15: 사용자 승인 — f-lab-piz private, 원본 포함, 전체 브라우저API 호환, JS스크립트 방식 MCP.

사용자 추가 요구: MCP HTTP endpoint를 여러 에이전트가 공유하되 각 JavaScript 세션을 분리한다.

2026-10-15: Streamable HTTP 구현 및 세션별 JavaScript 실행, 원본 SDK 연결, 실제 Chrome 검증 결과를 implementation/과 docs/compatibility.md에 기록.

2026-10-15: 사용자 승인 — HTTP·stdio 모두 지원. 공통 MCP 실행부, bundled SDK 기본값, 확장 복수 연결/발견 및 전역 탭 사용권, 자식 프로세스 종료 정리를 구현한다.

## 2026-10-15: 범용 에이전트 help 보완 계획

사용자 요청: 특정 에이전트·모델에 종속하지 않고 스킬 없이 help를 중심으로 사용성을 보완할 계획을 작성한다.

- 기존 JavaScript 실행 도구를 유지하고 `browser_help`, 서버 instructions, 도구 설명, 오류별 복구 안내를 추가하는 방향을 선택했다.
- 기본 도움말은 Chrome·Worker 없이 응답하며 현재 자체 facade API, AX 사용 순서, 세션·출력 동작을 설명한다.
- 기존 성공 응답을 유지하기 위해 자동 첫 실행 배너는 MVP에서 제외하고 후속 검토로 남겼다.
- 프로토콜·예제 검증과 실제 외부 모델의 작업 성공률 평가는 별도로 기록한다.
- [상세 계획](spec-agent-help.md)을 작성했다. 실행 코드 변경·구현·배포는 진행하지 않았다.

## 2026-10-15: help 보완 구현·검증 완료

사용자 추가 “시작해” 지시 후 계획을 구현했다. `browser_help`, 공통 안내, 오류 복구 경로와 README를 추가하고 자동 테스트22개 및 격리된 Chrome의 가이드 흐름22개를 검증했다. 실제 이미지 검증에서 발견한 JPEG/PNG MIME 불일치는 원본 SDK를 변경하지 않고 MCP 응답에서 바로잡았다. 결과는 `implementation/log.md`와 `docs/validation/help-live.json`에 기록했다. 외부 모델·호스트별 성공률 평가는 수행하지 않았다.

## 2026-10-16: 0.3.0 정리 및 GitHub 반영

사용자 “지금까지한 버전으로 정리해서 깃헙 푸시해줘” 요청에 따라 현재 help 구현과 검증 기록을 0.3.0으로 묶는다. [이슈 #5](https://github.com/f-lab-piz/browser-agent-bridge/issues/5), milestone `v0.3.0`, `feat/5-agent-help` 브랜치로 관리하고 PR을 통해 main에 반영한 뒤 같은 버전 태그를 push한다. 원본 출처·해시·과거 시험 결과를 유지하며, 현재 공개 상태와 버전 문서만 맞춘다. 새 브라우저 기능이나 외부 모델 평가는 범위에 넣지 않는다.
