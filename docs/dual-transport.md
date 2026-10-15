# HTTP·stdio 지원 검증

2026-10-15 · 서버 0.2.0 · Chrome for Testing 155.0.8059.79 / macOS arm64.

HTTP와 stdio는 같은 MCP 서버 팩토리, JS 실행기, 원본 SDK를 사용합니다. 자동 테스트에서 실제 HTTP와 stdio 클라이언트의 `listTools()` 결과 전체가 동일한지 확인합니다. 기본 SDK는 로컬 파일이며 Python 서버를 실행하지 않습니다. 원격 SDK 로딩은 별도 HTTP 서버 테스트에서 검증합니다.

## 실행

```bash
npm ci
npm run build
npm test
```

Chrome이 필요한 혼용 시험은 사용자의 실제 프로필과 분리합니다. 공식 Chrome for Testing 실행 파일을 준비하고 다음 명령으로 테스트용 확장 복사본을 만듭니다. 테스트 토큰은 운영 토큰과 별개이며 복사본은 Git에서 제외합니다.

```bash
TEST_CHROME='/absolute/path/Chrome for Testing executable' node scripts/prepare-live-test.mjs
node scripts/live-dual-transport.mjs
```

스크립트가 READY를 출력하면 Playwright CLI 등으로 `.local/cli.config.json`을 사용해 별도 테스트 프로필의 Chrome을 열고 `http://127.0.0.1:29661/`로 이동합니다. CLI 설정에는 테스트 확장 로드와 WebMCP 테스트 플래그가 포함됩니다. 예를 들어 사용 가능한 `playwright-cli`에서:

```bash
playwright-cli --session browser-bridge-dual open http://127.0.0.1:29661/ --config=.local/cli.config.json --persistent --profile=.local/test-profile-dual
```

완료 후 해당 테스트 브라우저를 닫습니다. 스크립트는 MCP 자식 프로세스·HTTP·fixture 서버를 종료합니다.

## 실제 Chrome 혼용 시험

| 시험                                           | 결과            |
| ---------------------------------------------- | --------------- |
| HTTP + stdio 두 프로세스가 같은 확장에 연결    | 성공            |
| Python 없이 bundled SDK로 HTTP/stdio AX 조회   | 성공            |
| stdio 호출 간 tab 객체 유지, locator 입력/읽기 | 성공            |
| stdio 스크린샷 MCP 이미지 반환                 | 성공            |
| stdio WebMCP 등록 도구 호출                    | 성공            |
| 다른 stdio 프로세스에서 같은 탭 조작           | 예상 lease 거절 |
| HTTP에서 stdio가 사용하는 탭 조작              | 예상 lease 거절 |
| 다른 탭의 독립 조작                            | 성공            |
| reset 후 다른 프로세스가 탭 획득               | 성공            |
| stdio 종료 후 HTTP에서 탭 획득                 | 성공            |
| 종료된 stdio 포트 재사용, 새 변수 상태         | 성공            |

원시 입력/출력: [dual-transport-live.json](validation/dual-transport-live.json). 총12개 케이스이며 예상 거절도 통과 기준에 포함합니다. 기존129 API 호출 검증은 이전 HTTP 버전의 기준이며 모든 API/옵션을 stdio에서 각각 재시험했다는 뜻이 아닙니다. 공통 실행부와 위 대표 기능/수명 주기를 검증했습니다.

자동 테스트 16개는 token 동시 생성, 상대 프로그램의 HMAC 확인, URL/발견 설정, 다중 소켓 라우팅, 프로세스를 넘는 lease, 연결 중단 중 탭 생성, HTTP·stdio 툴 동일성, 실제 stdio 자식 프로세스/변수/reset/EOF/포트 해제, stdout 오염 방지, bundled/remote SDK 및 기존 AX WASM을 확인합니다. 로그는 `validation/dual-unit-tests*.txt`를 참고하세요.

## 운영 범위

- 자동 발견 범위는 29651–29660, stdio 기본 할당은 29652–29660입니다. 그 외는 `--port`와 확장 옵션 주소를 명시합니다.
- 자동 연결에는 동일한 토큰과 새 버전 확장이 필요합니다. 여러 저장소 복사본은 토큰이 다를 수 있으므로 하나의 설치를 공유하거나 같은 토큰을 명시합니다.
- 확장이 잠든 동안에는 알람 또는 확장 재로딩까지 발견이 지연될 수 있습니다.
- WebMCP 시험은 `--enable-features=WebMCP --enable-blink-features=WebMCP`를 사용했습니다. 기능이 없는 Chrome에서 지원된다고 주장하지 않습니다.
- 에이전트 앱은 Chrome과 같은 컴퓨터에서 stdio 프로그램을 실행해야 로컬 확장에 자동 연결됩니다. 원격 에이전트는 HTTP와 터널을 사용합니다.
