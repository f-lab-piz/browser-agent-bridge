# 원본 보관

`openai/26.928.21956/`은 사용자가 설치한 ChatGPT 데스크톱의 브라우저 런타임에서 확보한 파일입니다. 직접 작성한 구현과 구분합니다.

- 원본 `browser-client.mjs`, `browser-service.mjs`, `browser-accessibility.wasm.br`, `bind_tab.js`, 문서·API manifest를 보관합니다.
- `ORIGIN.json`은 복사본의 SHA-256·크기와 출처를 기록합니다.
- `sdk/original-*.mjs`는 원본 파일 전체 뒤에 export만 추가한 생성 파일입니다. 원본 business logic을 수정하지 않습니다.
- 원본에 대한 새로운 라이선스·권리를 부여하는 표시는 하지 않습니다. 이 저장소는 private 연구용으로 유지합니다.
- 직접 작성한 코드는 `bridge/`, `extension/`, `sdk/browser.mjs`, `server/`, `scripts/`, `tests/`에 있습니다.

`openai/chrome-extension-1.26.901.11451/`에는 설치된 원본 확장의 `background.js`, manifest와 파일 해시도 보관합니다. 실행되는 확장은 저장소 루트의 자체 `extension/`입니다.
