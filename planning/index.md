# 구현 범위

1. 확장에서 실제 Chrome API/CDP를 실행한다.
2. 로컬 브릿지에서 에이전트별 지속 JavaScript 세션과 MCP Streamable HTTP와 stdio를 같은 실행부로 제공한다.
3. SDK는 기본적으로 패키지에서 로드한다. Python 정적 호스팅과 원격 SDK는 선택 사항이다.
4. 확보한 원본 JavaScript·WASM을 private 저장소에 포함한다.
5. 기존 조사131항목을 대조하고 브라우저API 전체를 원본 클라이언트/핸들러로 노출한다.
6. 완료 여부는 API 존재, transport 연결, 실제 브라우저 검증을 구분해 기록한다.

7. stdio 프로세스가 확장 연결을 함께 제공하며 복수 stdio·HTTP 혼용을 지원한다.
