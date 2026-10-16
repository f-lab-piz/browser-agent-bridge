# 범용 에이전트를 위한 MCP help 보완 계획

작성일: 2026-10-15

2026-10-16 변경: 아래는 0.3.0의 이전 계획이다. 사용자 요청에 따라 0.3.1에서는 자체 사용 가이드·예제·facade 설명·오류 복구 안내를 제거하고 보관된 원본 Markdown만 그대로 제공한다. 원본 manifest 기반 API 조회와 최소 문서 선택 metadata는 유지한다. 현재 방향은 `planning/index.md`, 결과는 `implementation/log.md` 참조.

상태: 2026-10-15 사용자 시작 지시 후 구현·프로토콜·실제 Chrome 예제 검증 완료. 외부 에이전트별 작업 성공률 평가는 후속 작업. 상세 결과는 `implementation/log.md` 참조.

## Problem

현재 MCP는 `browser_js`, `browser_js_reset`을 제공하지만, 처음 연결한 에이전트가 브라우저 사용 순서와 정확한 API를 발견하기 어렵다. 특정 모델의 사전 지식, Codex 기본 브라우저 지침, 이전 대화에 의존하지 않는 안내가 필요하다.

현재 확인한 사실:

- `createBrowserMcp()`의 MCP 초기화 응답에 서버 `instructions`가 없다.
- `browser_js` 설명은 실행 환경을 설명하지만 시작 예제나 문서 조회 순서를 안내하지 않는다.
- 첫 `agent.browsers.list()` 실행 결과에는 자동 사용 안내가 붙지 않는다.
- `browser.documentation()`은 현재 원본 API 명세 24,305자를 반환한다. 자체 facade인 `getAXState()`와 `cua.*` 및 사용 절차 안내는 이 명세에 포함되지 않는다.
- 같은 MCP 세션에서는 변수가 유지되지만 별도 세션에서는 유지되지 않는다.
- HTTP·stdio는 공통 MCP 서버 팩토리를 사용하므로 안내도 한 곳에서 제공할 수 있다.

근거: `bridge/mcp-server.mjs`, `bridge/js-worker.mjs`, `sdk/browser.mjs`, 로컬 진단 `output/agent-usability-audit/current-interface.json`. 해당 진단은 실제 모델의 작업 성공률을 측정한 것이 아니다.

해석: 안내 부족이 다른 에이전트의 실패를 설명할 가능성이 있다. 개별 실패 로그와 통제된 비교가 없으므로 안내 부족만이 원인이라고 확정하지 않는다.

## Target User

- 브라우저 작업을 수행하는 임의의 MCP 지원 에이전트.
- 별도 스킬이나 프로젝트 지침을 설치하지 않은 사용자.
- HTTP·stdio 중 어느 방식으로 연결하든 같은 안내를 받아야 하는 클라이언트.

## User Value

- 연결 후 에이전트가 시작 방법, 지원 API, 관찰과 조작 순서를 스스로 조회한다.
- 오류가 발생했을 때 reset이나 재시도를 추측하기 전에 원인에 맞는 복구 절차를 찾는다.
- 브라우저 미연결 상태에서도 사용법과 연결 점검 방법을 확인한다.
- 기존 브라우저 실행 코드와 세션을 유지하면서 안내만 점진적으로 보완한다.

## Use Cases

1. 새 세션에서 도구 설명을 읽고 `browser_help()`를 호출해 시작한다.
2. 브라우저 목록에서 실제 ID를 확인하고, 선택한 브라우저에서 탭을 열어 AX를 읽는다.
3. `browser_help({topic:"ax"})`로 full/diff/unchanged, 요소 인덱스와 재관찰 방법을 확인한다.
4. `browser_help({api:"tab.getAXState"})`로 정확한 인자, 반환형, 자동 출력 여부와 실행 예제를 확인한다.
5. 변수 소실, 시간 초과, stale 요소, 확장 미연결 문제를 help로 구분한다.
6. 스크린샷을 이미지 content로 반환하는 방법과 클라이언트의 이미지 표시 제한을 확인한다.

## Corner Cases

| 상황 | 계획한 동작 |
| --- | --- |
| Chrome·확장 미연결 | help는 정상 응답. 안내 조회를 위해 브라우저를 실행하지 않는다. |
| JavaScript Worker 또는 SDK 초기화 실패 | 기본 help는 패키지의 로컬 안내만 읽어 제공한다. Worker 초기화를 요구하지 않는다. |
| `topic`·`api` 모두 생략 | `quickstart` 반환. |
| `api`만 지정 | API 상세 조회로 해석. |
| `topic:"api"`, `api` 생략 | 기능별 API 색인 반환. 전체 상세 문서를 한꺼번에 반환하지 않는다. |
| `api`와 다른 topic을 동시에 지정 | `isError:true`와 올바른 호출 예제 반환. |
| 존재하지 않는 topic·API | 실행 없이 오류 및 지원 항목/관련 색인 조회 방법 반환. |
| 브라우저 여러 개 | 관찰한 ID로 선택하도록 안내. 무조건 `chrome` 별칭을 사용하지 않는다. |
| 반환 결과가 diff이고 이전 전체 상태를 잃음 | `disableDiffing:true`로 전체 상태를 다시 읽도록 안내. |
| stale 요소 | 새 AX에서 대상을 다시 찾는다. 예전 인덱스로 반복 실행하지 않는다. |
| timeout·연결 끊김 | 실행이 이미 발생했을 가능성과 세션 상태를 구분하고 재관찰한다. 조작을 자동 재시도하지 않는다. |
| 업로드·기록 조회 비활성화 | 실제 서버 옵션과 지원 범위를 설명한다. help가 옵션이나 권한을 바꾸지 않는다. |
| 클라이언트가 호출마다 새 MCP 세션 생성 | 현재 세션 유지 전제와 호환성 진단 방법을 안내. help가 클라이언트 동작을 고칠 수 있다고 주장하지 않는다. |
| 사용자 지정 `--sdk-url` | API 문서의 적용 대상이 설치된 bundled SDK임을 표시한다. 원격 SDK를 help 요청 중 자동 다운로드하지 않는다. |
| 이미지 미지원·결과 잘림 | 이미지 content 전달 확인과 전체 AX 재조회 방법을 안내. 호스트 표시 성공을 서버가 보장하지 않는다. |

## Behavior Spec

### 1. MCP 공개 도구

기존 도구의 이름과 입력 형식을 유지하고 `browser_help`를 추가한다.

```text
browser_js({ code, timeout_ms? })
browser_js_reset({})
browser_help({ topic?, api? })
```

`topic`은 `quickstart`, `ax`, `session`, `output`, `troubleshooting`, `api`를 지원한다. 생략 시 `api`가 있으면 API 상세, 없으면 `quickstart`다. 브라우저 조작 없이 로컬 안내를 반환하며 읽기 전용·멱등·비파괴 annotation을 적용한다. `browser_js`에 읽기 전용 annotation을 적용하지 않는다.

### 2. 첫 진입 안내

- 서버 `instructions`에 `browser_help()` → 브라우저 조회/선택 → 관찰 → 조작 → 결과 확인 순서를 간결하게 제공한다. 핵심 시작 방법은 첫 512자 안에 둔다.
- `browser_js` description에도 첫 사용 시 help를 읽는 경로를 넣는다. 서버 instructions를 모델에게 전달하지 않는 호스트에서도 발견 가능해야 한다.
- help 조회를 실행의 강제 선행 조건으로 만들지 않는다. 기존 클라이언트는 바로 `browser_js`를 호출할 수 있다.
- 기존 성공 응답에 자동 배너나 긴 문서를 붙이지 않는다. 최초 호출·reset 후 자동 안내는 별도 후속 검토다.

### 3. 가이드 내용

- `quickstart`: 사전 바인딩된 `agent`, `cua`, `nodeRepl`, top-level await와 상태 유지; 실제 브라우저 조회; 반환 ID 선택; 새 탭과 첫 AX 관찰. 실행 가능한 첫 예제는 브라우저 조회까지 완결하고, 실제 반환 ID를 사용하는 후속 예제를 분리한다.
- `ax`: 관찰 → 관찰된 요소 선택 → 조작 → 새 AX 확인. full/diff/unchanged, 인덱스 재사용 한계, `disableDiffing`, 이미 완료된 상태에서 반복 탐색하지 않는 종료 기준.
- `session`: 바인딩 재사용, 새 MCP 세션과 reset에 따른 변수 소실, 탭 사용권, timeout 후 재관찰, 외부 연결을 매번 재생성하는 호스트의 한계.
- `output`: `nodeRepl.write`, `nodeRepl.emitImage`, 자동 출력하는 API와 직접 출력해야 하는 API, 마지막 표현식이 출력과 함께 있을 때 생략되는 현재 동작. facade와 원본 API의 출력 차이는 실제 동작으로 확인한다.
- `troubleshooting`: 확장 미연결/빈 목록, stale 요소, 변수 없음, timeout/reset, 탭 lease, 비활성화된 기능과 지원하지 않는 기능을 구분한다.
- `api`: 원본 manifest를 사용한 API 색인 및 상세와 직접 작성한 facade 상세를 함께 제공한다. 존재하지 않는 API나 관찰하지 않은 요소 번호를 만들지 않는다.

### 4. API 정확성 및 문서 원본

- 직접 작성할 `bridge/help.mjs`가 help 입력 처리, 렌더링, 오류 안내 조회를 담당한다.
- 직접 작성할 `bridge/help-content.mjs`가 공통 사용 규칙, 주제별 설명, facade API 설명 및 예제를 관리한다.
- 원본 API의 이름·인자·반환형은 `sdk/api.json`에서 조회해 설명 중복을 줄인다. 자체 facade 설명만 별도 관리한다.
- `README.md`의 시작 안내와 툴 metadata는 같은 가이드 원본에서 생성하거나 공통 상수로 조합한다. 생성 구역만 교체하고 다른 설명은 유지한다.
- 원본 문서를 그대로 복제하지 않고 현재 브릿지 동작에 맞는 안내를 직접 작성한다. 지원 범위가 다른 IAB, 네이티브 앱, 앱 전용 승인 UI와 자동 탭 정리 동작을 약속하지 않는다.
- 기존 `browser.documentation()`은 원본 API 참고 명세로 유지하고 README/help에 그 역할을 명시한다. 이번 범위에서는 SDK의 반환 형식이나 원격 SDK 패키지 구조를 변경하지 않는다. 자체 API 발견 문제는 새 help의 색인·상세에서 해결한다.
- help는 문서가 설명하는 서버·bundled SDK 버전을 함께 표시한다. 임의 원격 SDK와 같다고 주장하지 않는다.

### 5. help 응답과 분량

- 사람이자 모델이 읽을 수 있는 짧은 `content`를 반드시 반환한다. `structuredContent`나 숨겨진 metadata만으로 안내하지 않는다.
- `structuredContent`에는 문서 버전, 요청한 topic/API, 관련 help 호출을 제공한다. text와 의미가 일치해야 한다.
- 기본 quickstart 응답은 최대 5,000 Unicode code point를 계획상 상한으로 둔다. 언어와 토크나이저에 따라 달라지므로 토큰 수와 동일시하지 않는다.
- 전체 API 상세를 한 번에 출력하지 않고 기능별 색인과 항목별 조회로 나눈다. 잘라낸 내용을 완전한 문서처럼 표시하지 않는다.
- help는 JS 코드나 브라우저 호출을 실행하지 않고 세션 변수와 탭 사용권도 변경하지 않는다.

### 6. 실행 오류의 복구 안내

- 알려진 브라우저·세션 오류에는 관련 help 호출을 짧게 추가한다. 원본 오류 설명과 `isError`를 유지한다.
- 원래 오류 텍스트를 담은 첫 content 항목을 유지하고 복구 안내는 별도 text 항목으로 추가한다. 기존 코드가 첫 오류 내용을 읽는 동작을 보존한다.
- 알 수 없는 오류는 원본을 유지한다. 무조건 reset하거나 브라우저 조작을 자동 재시도하지 않는다.
- 실패 전 실행된 동작을 되돌리거나 권한을 바꾸는 기능을 오류 안내에 섞지 않는다.

## Cost and Complexity

- 낮은 비용: 공통 metadata 보강, 기본 도움말, 주제별 가이드. 확장·브라우저 transport 변경은 필요하지 않다.
- 중간 비용: 원본 manifest와 facade를 합친 API 색인/상세, 실행 예제 검증, HTTP·stdio의 metadata 및 오류 응답 대조.
- 추가 운영 비용: API 변경 시 가이드와 예제를 갱신하고, 실제 호스트에서 전달·출력·세션 유지가 정상인지 확인한다.
- 도움말 조회를 위해 외부 모델 API, 네트워크 서비스, 별도 검색 인덱스, 스킬 설치를 도입하지 않는다.
- 더 저렴한 대안은 `browser_js` 설명에 예제 하나만 추가하는 것이다. 시작 문제 일부는 해결하지만 세션·diff·오류 복구를 설명하기 어렵고 설명이 계속 길어지므로 help 중심안을 선택한다.

## Usability

- 에이전트가 정확한 topic 이름을 미리 몰라도 인자 없는 help로 시작한다.
- 시작 예제는 결과를 확인하는 지점에서 끝나며, 모르는 페이지의 요소 번호로 조작하는 예제를 사용하지 않는다.
- 기능 선택의 기본 경로는 하나로 제시한다. 처음부터 원본 `tab.ax.*`, facade, Playwright의 모든 대안을 한꺼번에 가르치지 않는다. 일상 작업은 facade/AX, 별도 이점이 있는 경우에만 다른 경로를 설명한다.
- tool-facing 안내는 짧고 일관된 영어로 작성하고 프로젝트 README의 한국어 시작 설명을 맞춘다. 다국어 선택 기능은 이번 범위에 넣지 않는다.
- 툴 namespace는 호스트가 붙일 수 있으므로 클라이언트별 접두사를 예제의 고정 API 이름으로 가정하지 않는다.

## Risks and Mitigations

| 위험 | 대응 |
| --- | --- |
| 호스트가 instructions를 전달하지 않음 | description에도 짧은 help 진입 경로를 제공하고 실제 전달 여부를 점검한다. |
| help 자체를 호출하지 않음 | 시작 경로를 명확히 표시하되 강제 게이트는 두지 않는다. 실제 평가 후 필요하면 첫 실행 안내를 검토한다. |
| 가이드가 원본 또는 facade와 불일치 | manifest 기반 색인과 자체 API 목록 대조, 예제 실행 확인을 완료 기준으로 둔다. |
| 긴 문서로 인한 context 낭비 | quickstart 분량 상한, 주제별/항목별 조회로 제한한다. |
| 성공 응답 형식 변경으로 기존 클라이언트 파손 | 성공 경로를 유지하고 기존 `42` 반환·변수 유지·reset 검증을 그대로 통과시킨다. |
| 세션을 보존하지 않는 호스트 | 모델 안내 문제와 transport 문제를 구분하고 세션 진단 결과를 기록한다. |
| 문서 테스트 통과를 모델 성공률로 오해 | 프로토콜·예제 검증과 실제 에이전트 작업 평가를 별도로 보고한다. |

## Decision

스킬 설치를 필수로 하지 않고, 표준 MCP 도구인 `browser_help`와 짧은 metadata 안내를 중심으로 보완한다. 기존 JS 실행 구조와 Chrome 기능은 유지한다. help, description, 오류 안내가 하나의 가이드 원본을 공유하게 한다.

## MVP Scope

포함:

1. `browser_help`와 여섯 topic, API 색인/항목 조회.
2. 서버 instructions와 두 기존 툴 설명의 시작·reset 안내 보강.
3. 현재 facade와 세션·출력 동작에 맞춘 자체 가이드.
4. 알려진 실행 오류의 help 연결.
5. HTTP·stdio와 예제의 회귀 검증, README 갱신.

후속 검토:

- 첫 호출·reset 후의 자동 안내 배너.
- 호스트별 스킬·플러그인 배포.
- 별도 `browser_status` 등 진단 도구, 작은 조작 도구로의 분리.
- 검색형 help, 다국어, 사용자 지정 원격 SDK에 맞춘 동적 문서 생성.
- AX 포맷, 보안 정책, 확장 권한, transport·탭 수명 구조의 변경.

## Success Metrics

### 기능 및 프로토콜 완료 기준

- HTTP·stdio의 공개 도구 목록에 동일한 세 도구와 안내 metadata가 나타난다.
- `initialize` 응답에서 간결한 서버 instructions를 읽을 수 있다.
- 연결된 Chrome이 없어도 모든 기본 topic과 bundled API 도움말이 응답한다.
- 도움말 호출 전후 JS 변수가 보존되고, 도움말만 호출하면 Worker가 시작되지 않는다.
- 기존 성공 응답·변수 유지·세션 격리·reset·EOF·탭 lease 검증을 유지한다.
- 입력 오류, API 없는 경우, topic 충돌 시 다음 유효 호출이 안내된다.
- facade의 공개 API마다 help 설명이 있으며 필수 인자·반환형·출력 동작이 구현과 맞는다.
- quickstart 분량 상한을 지키고 설치된 패키지 버전을 표시한다.

### 예제 및 실제 작업 검증

- 로컬 fixture에서 quickstart, 요소 조작 후 새 AX 확인, full/diff, 이미지 출력, reset 후 복구 예제를 검증한다.
- 네이버에서 브라우저 조회 → 새 탭 → AX 관찰 → 검색 → 결과 관찰의 대표 흐름을 확인한다. 광고·추천 항목이나 고정 AX 번호로 성공을 판단하지 않는다.
- 외부 에이전트 평가가 가능해지면 새 대화에서 스킬·과거 대화·Codex 기본 브라우저 도구의 도움을 제외하고 비교한다. 현재판과 help 보완판의 완료율, 잘못된 API 호출 수, 복구 횟수, 총 호출 수를 기록한다.
- 서로 다른 모델·호스트에서의 성공률 목표는 아직 근거가 없으므로 숫자로 확약하지 않는다. 모델과 호스트 조건을 나눠 결과를 보고한다.

## Open Questions

- 구현을 막는 미결정 항목은 없다. 현재 SDK·facade를 기준으로 진행할 수 있다.
- 실제 외부 호스트에서 instructions 수신, 이미지 전달, 결과 잘림, 세션 유지가 정상인지 아직 확인하지 않았다. 대상 호스트가 확보되면 호환성 평가로 확인한다.
- 자동 첫 실행 안내의 추가 효과는 현재 검증하지 않았다. 기존 출력 계약을 바꾸지 않는 MVP 후에 판단한다.

## Next Actions

1. `bridge/help-content.mjs`의 quickstart·사용 규칙·facade 목록과 manifest 조회 방식을 작성한다.
2. `bridge/help.mjs`를 만들고 `bridge/mcp-server.mjs`에 help와 초기 안내를 연결한다.
3. 기존 성공 반환을 유지하면서 알려진 오류에 관련 help 호출을 추가한다.
4. `tests/help.test.mjs`와 기존 HTTP·stdio 테스트에 도움말 독립성, 세션 보존, metadata 일치, 오류 및 문서 정확성 검증을 추가한다.
5. README 시작 안내를 갱신하고 `npm test` 및 필요한 예제 실행을 완료한다. SDK 변경이 없다면 빌드 결과를 불필요하게 갱신하지 않는다.
6. 실제 Chrome 대표 흐름을 확인하고, 구현 완료와 실제 외부 에이전트 평가 완료를 구분해 보고한다.

최초 계획 요청에서는 위 문서만 작성했다. 이후 사용자 “시작해” 지시로 구현과 검증을 진행했다. 커밋·push·릴리스는 실행하지 않았다.
