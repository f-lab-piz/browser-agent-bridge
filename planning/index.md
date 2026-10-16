# 구현 범위

1. 확장에서 실제 Chrome API/CDP를 실행한다.
2. 로컬 브릿지에서 에이전트별 지속 JavaScript 세션과 MCP Streamable HTTP와 stdio를 같은 실행부로 제공한다.
3. SDK는 기본적으로 패키지에서 로드한다. Python 정적 호스팅과 원격 SDK는 선택 사항이다.
4. 확보한 원본 JavaScript·WASM과 출처·해시를 저장소에 포함한다. 최초 계획은 private 연구용이었으며, 현재 GitHub 저장소는 사용자 요청에 따라 public이다.
5. 기존 조사131항목을 대조하고 브라우저API 전체를 원본 클라이언트/핸들러로 노출한다.
6. 완료 여부는 API 존재, transport 연결, 실제 브라우저 검증을 구분해 기록한다.

7. stdio 프로세스가 확장 연결을 함께 제공하며 복수 stdio·HTTP 혼용을 지원한다.

## 2026-10-15 선택 방향: 범용 에이전트 help

스킬 설치를 필수로 하지 않고 `browser_help`와 짧은 초기 안내로 에이전트 사용성을 보완한다. 기존 `browser_js`, `browser_js_reset`과 실행·세션 계약을 유지한다. 첫 자동 출력 배너와 호스트별 스킬은 후속 검토다.

- 상세 계획: [범용 에이전트 help 보완](spec-agent-help.md)
- 상태: 구현 및 자동·실제 Chrome 예제 검증 완료. 외부 에이전트별 성공률 평가는 후속 작업.

## 2026-10-16 변경 방향: 원본 가이드만 제공

사용자 요청에 따라 0.3.1부터 위 help의 자체 workflow·예제·facade 설명·오류 복구 안내를 제거한다. help는 원본 문서 28개를 그대로 반환하고 API 선언은 원본 manifest만 조회한다. 서버 metadata와 README에는 문서 선택 방법만 남긴다. 원문에 이미 있는 AX 우선·다른 API 선택 기준을 다시 요약하지 않는다. [이슈 #7](https://github.com/f-lab-piz/browser-agent-bridge/issues/7).
