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

## 2026-10-15 범용 에이전트 help 보완

### Plan Input

`planning/spec-agent-help.md`, `planning/index.md`, `planning/log.md`. 사용자 요청: 범용 help 중심 보완 계획을 구현하라는 “시작해”. 구현 도중 help의 출처를 질문받아, 기존 안내를 그대로 복제하지 않고 실제 브릿지 동작에 맞게 작성하며 API 선언만 기존 manifest에서 조회함을 설명했다.

### Implemented

- `browser_help({topic?, api?})`: quickstart·ax·session·output·troubleshooting·api. 인자 없는 시작 안내, namespace 색인과 정확한 API 조회, 잘못된 topic/API와 입력 충돌 안내.
- `help-content.mjs`의 공통 가이드·facade 설명·실행 예제를 직접 작성. 원본 `sdk/api.json`의 공개 extension API 선언과 매개변수 참조형은 그대로 조회한다. 앱 전용 동작과 다른 부분은 해당 API 조회에도 보충한다.
- help는 SDK 코드를 실행하지 않고 Worker·브라우저 없이 로컬 문서를 반환한다. 서버·bundled SDK 버전과 원격 SDK 적용 범위를 명시한다.
- 공통 MCP 팩토리에 서버 instructions와 도구 description을 연결하고 알려진 오류에 별도 help 연결 text를 추가. 기존 성공 text·변수·reset 계약과 원본 오류 설명을 유지한다.
- `scripts/update-help-readme.mjs`로 동일 원본에서 README 구역을 생성하고 테스트에서 일치 여부를 확인한다.
- `scripts/live-help.mjs`로 실제 가이드 예제를 격리된 Chrome 확장에서 검증하고 생성한 탭만 정리한다.
- 이미지 예제 검증 중 JPEG 바이트(`ffd8ff`)를 `image/png`로 내보내던 기존 불일치를 발견했다. 원본 SDK/WASM은 변경하지 않고 공통 MCP 경계에서 JPEG·PNG 서명을 확인하여 정확한 MIME으로 반환한다.

### Test Coverage

- Chrome·원격 SDK 연결 없이 help 호출 및 Worker 미기동, 모든 topic·버전 표시·quickstart 분량 상한.
- 오류/누락/충돌 입력과 유효한 다음 호출 안내, 원본 manifest 및 자체 facade API의 문서 범위, 매개변수 참조형과 실제 구현 차이 설명.
- help 전후 변수·Worker 유지, 출력이 있으면 마지막 표현식 생략, 원본 오류·선행 출력 보존, unknown 오류 무변경, timeout/reset 뒤 help 및 SDK 로딩 실패 뒤 help.
- JPEG/PNG의 MCP MIME 보정, README 생성 일치, HTTP·stdio 도구·instructions·help 응답 동일.
- 기존 인증·발견·탭 lease·세션 격리·EOF·SDK 해시/경로·원본 prefix/WASM 검증 유지.
- 실제 Chrome for Testing 155.0.8059.79에서 22개 가이드 흐름 확인: 시작 조회, 로컬 fixture AX·입력·diff/full·이미지, facade의 출력 차이, help 전후 변수·탭 유지, reset 후 기존 탭 재연결, 네이버의 관찰된 검색창에 입력 후 검색 결과 URL·검색어 확인.

### Test Command and Result

- `npm test`: 22 passed, 0 failed (Node 25.2.1).
- `PATH=/opt/homebrew/opt/node@22/bin:$PATH npm test`: 22 passed, 0 failed. 출력: `docs/validation/help-unit-node22.txt`.
- `node scripts/update-help-readme.mjs --check`: 성공.
- `BROWSER_BRIDGE_LIVE_TOKEN=<격리된 테스트 토큰> node scripts/live-help.mjs`: 22/22 흐름 통과. 원시 입력/응답과 이미지 MIME·바이트 서명: `docs/validation/help-live.json`.
- `git diff --check`: 통과.

테스트용 Chrome은 이전 AX 측정에서 생성한 별도 프로필을 재사용했으며 개인 Chrome 프로필은 조작하지 않았다. 첫 이미지 검증에서 발견된 MIME 문제를 수정한 뒤 전체 실제 흐름을 다시 완료했다. 성공한 예제 실행은 다른 모델의 작업 성공률 측정과 구분한다.

### Decisions

추가 의존성·스킬·새 조작 도구·자동 안내 배너를 도입하지 않았다. SDK·vendor·확장 소스는 변경하지 않았으므로 SDK 빌드를 불필요하게 재생성하지 않았다. help는 임의 원격 SDK까지 설명한다고 주장하지 않는다. 계획 외 MIME 보정은 실제 이미지 예제가 유효한 MCP content를 반환하도록 필요한 최소 수정으로 포함했다. 소스와 검증 기록을 로컬에 남겼으며 커밋·push·릴리스는 실행하지 않았다.

### Next Actions

기존 MCP 프로그램을 재시작하고 클라이언트에서 도구 목록과 instructions를 다시 읽으면 된다. 확장 재설치는 필요 없다. 외부 호스트가 준비되면 새 대화·스킬 없음 조건에서 사용 성공률, 잘못된 API 호출, 복구 횟수, 호출 수와 호스트의 세션/출력 전달을 별도 평가한다.

## 2026-10-16 0.3.0 정리 및 GitHub 반영 준비

### Plan Input

사용자 “지금까지한 버전으로 정리해서 깃헙 푸시해줘”. 기존 `planning/spec-agent-help.md` 구현과 검증 결과를 배포 가능한 저장소 버전으로 정리한다. [이슈 #5](https://github.com/f-lab-piz/browser-agent-bridge/issues/5), milestone `v0.3.0`, 브랜치 `feat/5-agent-help`.

### Implemented

- package.json·lockfile 버전을 0.3.0으로 맞추고 CHANGELOG를 추가했다.
- README·설계·구현 현황에 세 MCP 도구와 help 동작을 반영했다.
- GitHub 저장소의 현재 PUBLIC 상태를 확인하여 현재 상태 설명을 맞췄다. 원본 출처·권리 문구와 ORIGIN.json의 당시 확보 목적·해시는 보존했다.
- 이전 실제 Chrome 결과의 서버 버전 0.2.0은 측정 당시 값으로 유지하고, CHANGELOG에서 버전 변경 전 help 구현의 검증임을 명시했다.
- 브라우저 실행 코드·SDK·WASM·확장에는 이번 정리 작업으로 추가 변경을 하지 않았다.

### Test Coverage

help 독립성·오류·API 문서·세션 유지·출력·MIME 및 README 생성 일치, HTTP·stdio metadata 일치, 기존 인증·발견·lease·EOF·SDK 무결성 회귀를 재검증했다. 실제 Chrome 시험은 2026-10-15의 22/22 기록을 보존한다.

### Test Command and Result

- `npm test`: 22 passed, 0 failed (Node 25.2.1, 서버 0.3.0).
- `PATH=/opt/homebrew/opt/node@22/bin:$PATH npm test`: 22 passed, 0 failed (Node 22.21.1, 서버 0.3.0). `docs/validation/help-unit-node22.txt` 갱신.
- `node scripts/update-help-readme.mjs --check`: 성공.
- `git diff --check`: 통과.
- `ssh -T git@f-lab-piz`: f-lab-piz 계정 인증 성공 메시지 확인. GitHub shell 미지원에 따른 종료 코드 1.

### Decisions

기존 구현 전체와 필요한 문서·버전 정리만 한 PR에 포함한다. 새 의존성, 원본 라이선스 부여, 출처 삭제, 외부 모델 성공률 주장은 추가하지 않는다. 위 검증 후 SSH alias remote로 브랜치를 push하고 PR 병합·v0.3.0 태그 반영 결과는 GitHub에서 확인한다.

### Next Actions

PR을 main에 병합하고 연결 이슈·milestone을 닫은 뒤 v0.3.0 태그를 push한다. 사용자는 MCP 프로그램을 재시작하고 클라이언트의 도구 목록·instructions를 새로 읽는다.

## 2026-10-16 0.3.1 원본 가이드만 제공

### Plan Input

사용자 “너가 넣은건 빼줘.. 그냥 원래 있던것만 넣어줘 가이드는”. 0.3.0은 PR #6으로 main에 병합되고 태그도 push된 상태였으므로 기존 이력을 바꾸지 않고 0.3.1로 수정한다. `planning/index.md`, `planning/log.md`, [이슈 #7](https://github.com/f-lab-piz/browser-agent-bridge/issues/7).

### Implemented

- 자체 workflow·quickstart 예제·Playwright 선택 요약·facade 설명·API 보충 설명을 help에서 제거했다. 실행 오류에 붙이던 자체 복구 안내도 제거했다.
- help 본문은 보관된 원본 Markdown 28개를 수정·요약·문구 추가 없이 반환한다. 기본 응답은 `accessibility.md`이고 문서명별 조회와 `documents` 색인을 제공한다.
- 기존 topic은 원본 문서에 대한 별칭으로 유지한다. 서버 metadata와 README는 조회 경로만 안내하며 API 상세는 원본 manifest의 선언·참조형만 반환한다.
- 자체 facade API는 실행에서 유지한다. 원본 명세에 없는 이름의 API help는 새 설명을 만들지 않고 원본 API 색인으로 연결한다.
- 버전·설계·구현 현황을 갱신하고 이전 자체 가이드 검증 기록은 과거 결과로 표시했다. live 회귀 스크립트의 테스트 입력은 에이전트 가이드와 분리했다.

### Test Coverage

원본 문서 28개 전체의 help content와 원문 문자 단위 일치, ORIGIN SHA-256 일치, 기본/별칭 문서 선택, 잘못된 이름·경로·prototype 이름 거절, 원본 API 및 참조형, Worker 미기동·변수 유지·SDK 실패 후 help, 오류 원문 유지·추가 가이드 없음, JPEG/PNG MIME, README 조회 경로 일치, HTTP·실제 stdio 응답 일치와 기존 회귀를 확인했다.

### Test Command and Result

- `npm test`: 22 passed, 0 failed (Node 25.2.1, 서버 0.3.1).
- `PATH=/opt/homebrew/opt/node@22/bin:$PATH npm test`: 22 passed, 0 failed (Node 22.21.1). `docs/validation/original-help-unit-node22.txt`.
- `node scripts/update-help-readme.mjs --check`: 성공.
- `node --check scripts/live-help.mjs`: 성공.
- `git diff --check`: 통과.
- `git diff --name-only -- sdk extension vendor/openai`: 변경 없음.

### Decisions

문서 전달 장치와 호출 metadata는 유지하고 사용 가이드의 본문만 원본에 한정한다. 원본 앱 전용 설명을 브릿지 신규 기능으로 주장하지 않으며 기존 호환성 문서에서 실제 지원 범위를 구분한다. 추가 의존성·원본 수정·새 모델 평가는 없다. Chrome 실행 코드는 바뀌지 않았으므로 이번 변경에 Chrome 시험을 반복하지 않았다.

### Next Actions

PR 병합 후 v0.3.1 태그를 push한다. 사용자는 MCP 프로그램을 재시작하고 도구 목록·instructions를 새로 읽는다. 원본 문서의 AX 우선 기준은 그대로 전달된다.
