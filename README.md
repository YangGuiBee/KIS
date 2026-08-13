# KIS — 지식정보사이트 (Knowledge Information Site)

통근 시간 등에 시청한 영상·자료를 **지식카드**로 정리해 검색·태그·갤러리로 보는 자체완결 정적 사이트.

## 구성
- `cards/*.md` — 지식카드(프론트matter: `title/video/source/images/date/tags/summary` + 본문)
- `build.js` — 카드들을 파싱해 **자체완결 `index.html`** 생성(검색·태그 필터·이미지 갤러리). Node 무의존.
- `index.html` — 빌드 산출물(그대로 브라우저로 열어 사용)
- `img/` — 카드에 첨부하는 캡처 이미지

## 빌드
```
node build.js      # cards/ → index.html 재생성
```

## 메모
- 카드의 `images`/`source`가 로컬 절대경로(file://)인 경우, 그 링크는 해당 PC에서만 열립니다(공유 시 상대경로/자산 포함으로 전환 필요).
- 무-지어내기 원칙: 카드 요약·수치는 원 영상/자료 근거로만 작성.
