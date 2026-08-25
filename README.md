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

## 사전 준비 (홈·사무실 공통)
KIS 저장소와 **나란히(sibling)** 비공개 전문스크립트 저장소를 클론해둔다. 부모 폴더 이름은 PC마다 달라도 된다(홈은 `C:\AI`, 사무실은 `C:\ai-bok` 등) — 중요한 건 `KIS`와 `scripts`가 같은 부모 폴더 밑에 나란히 있어야 한다는 것뿐이다:
```
cd <KIS가 있는 부모 폴더>     # 예: C:\AI 또는 C:\ai-bok
git clone https://github.com/YangGuiBee/scripts.git
```
`scripts` 저장소는 프로젝트별 하위 폴더 구조(`KIS/YYYY-MM-DD/...`)를 쓴다 — KIS 외 다른 프로젝트의 전문자료도 같은 저장소 다른 폴더에 모을 예정.

## 카드 빠르게 추가하기
```
node tools/new-card.js https://youtu.be/XXXXXXXXXXX   # 자막 다운로드+정제 → scripts 저장소(../scripts/KIS/)에 저장+commit+push, 카드 스켈레톤 생성
# → 생성된 cards/*.md를 열어 전문 스크립트(../scripts/KIS/)를 읽고 핵심 키포인트·태그·요약(TODO)을 채운다
node build.js                                          # index.html 재생성
node tools/sync-wikilinks.js                           # 새 [[위키링크]]가 있으면 vault(C:\AX\obsidian\Raw\9.프로젝트(KIS)\)에 스텁 노트 자동 생성 (홈/가이아 PC 전용)
```
- `new-card.js`는 yt-dlp로 한국어 자동자막을 받아 정제하고, 카드 프론트matter만 채워둔다. **핵심 키포인트·요약 본문은 절대 자동 생성하지 않음**(무-지어내기 원칙) — 반드시 스크립트를 읽고 사람(또는 이 카드를 만드는 클로드 세션)이 채워야 한다.
- 이미 같은 영상 ID의 카드가 있으면 실행을 중단한다(중복 방지).
- 카드의 `source`는 **KIS 폴더 기준 상대경로**(`../scripts/KIS/...`)로 기록한다 — 절대경로(`C:/AI/...`)를 쓰면 부모 폴더 이름이 다른 PC(홈 `C:\AI` vs 사무실 `C:\ai-bok`)에서는 링크가 깨진다. `build.js`가 상대경로는 그대로, 레거시 절대경로는 `file://`로 변환해서 처리한다.
- 전문 스크립트는 `scripts`(private repo)에 자동 commit+push된다 — 홈/사무실 어느 쪽에서 만들었든 `git pull`만 하면 다른 쪽 PC에서도 같은 스크립트 파일을 받아볼 수 있고(상대경로 덕분에) 카드의 링크도 그대로 열린다.
- `sync-wikilinks.js`는 vault(`C:\AX\obsidian\Raw\9.프로젝트(KIS)\`)가 있는 PC(홈/가이아)에서만 동작한다. 사무실(루비)에서 만든 카드의 새 위키링크는, 다음에 홈에서 이 스크립트를 돌릴 때 자동으로 채워진다.
- yt-dlp가 PATH에 없으면 `python -m pip install --user yt-dlp`로 설치.

## 메모
- `source`가 상대경로면 KIS를 로컬 파일로 직접 열었을 때(`file:///.../KIS/index.html`) 어느 PC에서든 열린다. 절대경로(레거시 카드)는 그 PC에서만 열린다. 공개 사이트(`https://yangguibee.github.io/KIS/`)에서는 브라우저가 `file://` 이동 자체를 막기 때문에 상대/절대 무관하게 항상 비활성이다.
- 무-지어내기 원칙: 카드 요약·수치는 원 영상/자료 근거로만 작성.
- 전문 스크립트는 카피라이트 이슈로 KIS(공개 저장소)엔 절대 넣지 않고 `scripts`(비공개 저장소)에만 보관한다.
