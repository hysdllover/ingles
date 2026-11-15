# 연필 영어노트

토픽별 현지인 표현 · 사전식 발음기호 · 발음 분석 · 단어장 앱. 버전이 두 가지입니다.

| | claude.ai 버전 (`index.html`) | GitHub Pages 버전 (`docs/`) |
|---|---|---|
| Claude 생성 | 내 claude.ai 계정 | 내 Anthropic API 키 (사용량 과금) |
| 저장 | 계정 동기화 | 기기별 저장 + 백업 파일 |
| 앱 안 마이크 | 키보드 받아쓰기 | Safari 음성 인식 버튼 |

## GitHub 버전 빌드

`index.html`을 고친 뒤:

```bash
python3 web/build.py   # web/ + index.html → docs/
```

- `web/shim.js`: claude.ai 기능(`window.claude.use`)을 브라우저 기능으로 대신하는 런타임
- `web/anthropic-sdk.js`: `@anthropic-ai/sdk@1.3.0` 브라우저 번들 (esbuild)

## 배포

GitHub 저장소 › Settings › Pages › Source: **Deploy from a branch** › 브랜치 선택 › 폴더 **/docs** › Save
