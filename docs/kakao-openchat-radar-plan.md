# Kakao OpenChat Radar Plan

## 운영 전제

- 매주 월요일 출근 후 카카오 오픈채팅방 2개의 전체 내보내기 ZIP 파일만 `data/` 폴더에 저장한다.
- 입력 예시는 `AX.zip`, `AIHR.zip`처럼 방별로 구분한다.
- 별도 텍스트 메시지 내보내기는 하지 않는다. 레이더는 ZIP 내부의 `KakaoTalkChats.txt`를 직접 읽는다.
- `data/`는 원본 대화, 닉네임, 이미지, 동영상, 첨부 파일을 포함할 수 있으므로 공개 저장소에 올리지 않는다.
- KIS 공개 반영은 자동 등록이 아니라 후보 검토 후 승인 방식으로 한다.

## 1차 목표

대량 오픈채팅 로그에서 매주 새로 올라온 URL을 추출하고, 양팀장님이 확인할 수 있는 News/Event 후보 목록으로 압축한다.

## 처리 흐름

1. `data/*.zip` 내부의 `KakaoTalkChats.txt`를 읽는다.
2. 메시지에서 URL을 추출한다.
3. URL을 정규화한다.
4. 이전에 처리한 URL과 중복 여부를 확인한다.
5. 도메인과 주변 키워드로 `News`, `Event`, `WWW`, `YouTube`, `Skip` 후보를 분류한다.
6. 공개하면 안 되는 작성자명, 닉네임, 소속, 원문 대화는 산출물에서 제거한다.
7. `data/pending/kakao-news-events.json` 또는 검토용 HTML에 후보만 저장한다.
8. 승인한 후보만 `cards/auto-news_*.md`, `cards/auto-event_*.md`로 승격한다.
9. `node build.js`로 `index.html`을 재생성한다.

## News 후보 기준

- 언론사 기사, 정부/공공기관 보도자료, 공식 블로그, 연구기관 발표를 우선한다.
- 키워드 예시: `AI`, `인공지능`, `LLM`, `생성형AI`, `공공AI`, `AX`, `정책`, `정부`, `보도`, `발표`, `보고서`, `거버넌스`, `보안`, `HR`.
- YouTube, GitHub, 소셜 공유글, 단순 설문/폼, 오픈채팅 초대 링크는 News 카드로 바로 올리지 않는다.

## Event 후보 기준

- 행사, 세미나, 컨퍼런스, 웨비나, 교육, 해커톤, 공모전, 참가신청, 모집, 마감 관련 링크를 우선한다.
- 일정과 장소가 명확하지 않으면 카드 생성 전 검토 대상으로 남긴다.
- 비용은 자동 확정하지 않고 기본값을 `원문 확인`으로 둔다.

## 주간 검토 산출물

매주 수집 결과는 먼저 다음 수준으로 요약한다.

- 전체 메시지 줄 수
- 전체 URL 수
- 신규 URL 수
- News 후보 수
- Event 후보 수
- WWW/YouTube 별도 후보 수
- 제외 사유별 수
- 상위 도메인
- 후보별 URL, 추정 분류, 근거 키워드, 점수

## 안전 원칙

- 원본 카카오톡 대화 파일과 첨부 ZIP은 `data/`에만 둔다.
- `data/`는 `.gitignore`로 제외한다.
- 공개 카드에는 작성자, 닉네임, 소속, 대화 원문을 넣지 않는다.
- URL과 공개 웹페이지에서 확인 가능한 제목/요약만 사용한다.
- 자동 수집 결과는 바로 공개하지 않고 검토 대기 상태로 둔다.

## 다음 구현 후보

- `tools/kakao-radar.js`: `data/*.txt`와 `data/*.zip`에서 URL 후보 추출
- `data/processed/kakao-links.json`: 이미 처리한 URL 기록
- `data/pending/kakao-news-events.json`: 검토 대기 후보
- `tools/approve-kakao-candidates.js`: 승인 후보를 KIS 카드로 변환
- 검토용 로컬 HTML: 후보를 사람이 빠르게 보고 승인/제외 표시
