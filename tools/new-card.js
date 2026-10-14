// YouTube URL 하나로 (1) 자동자막 다운로드 (2) 정제해서 OS 임시 폴더에 작업용 txt로 저장
// (3) cards/ 에 프론트matter가 채워진 카드 스켈레톤 생성까지 자동화한다.
// 핵심 키포인트/요약 "본문"은 절대 자동 생성하지 않는다 — 무-지어내기 원칙상
// 반드시 자막을 실제로 읽은 사람(또는 이 스크립트를 실행한 클로드 세션)이 채워야 한다.
// 저작권: 자막 전문은 어떤 저장소에도 보관하지 않는다(2026-10-14 결정). 임시 txt는 카드 작성용이며
// 카드를 다 채운 뒤 `node tools/new-card.js --purge <videoId>`로 지운다. 카드에는 요약·키포인트만 남긴다.
// 실행: node tools/new-card.js https://youtu.be/XXXXXXXXXXX
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const tmpTextPath = id => path.join(os.tmpdir(), `kis_${id}_자막.txt`);

if (process.argv[2] === '--purge') {
  const id = process.argv[3];
  if (!id) { console.error('사용법: node tools/new-card.js --purge <videoId>'); process.exit(1); }
  const p = tmpTextPath(id);
  if (fs.existsSync(p)) { fs.unlinkSync(p); console.log(`삭제: ${p}`); } else { console.log(`없음(이미 삭제됨): ${p}`); }
  process.exit(0);
}

const url = process.argv[2];
if (!url) {
  console.error('사용법: node tools/new-card.js <youtube-url>   |   node tools/new-card.js --purge <videoId>');
  process.exit(1);
}
const idMatch = url.match(/(?:v=|youtu\.be\/|\/shorts\/)([\w-]{11})/);
if (!idMatch) { console.error('YouTube 영상 ID를 URL에서 못 찾았습니다.'); process.exit(1); }
const videoId = idMatch[1];

const cardsDirCheck = path.join(__dirname, '..', 'cards');
// sparse-checkout으로 cards/를 로컬에서 뺀 PC(홈)에서는 폴더가 없으므로 git HEAD에서 중복을 찾는다.
let dupCard;
if (fs.existsSync(cardsDirCheck)) {
  dupCard = fs.readdirSync(cardsDirCheck).find(f =>
    fs.readFileSync(path.join(cardsDirCheck, f), 'utf8').includes(videoId));
} else {
  const g = spawnSync('git', ['grep', '-l', videoId, 'HEAD', '--', 'cards'], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
  dupCard = g.stdout.trim().split('\n')[0].replace(/^HEAD:cards\//, '') || undefined;
  fs.mkdirSync(cardsDirCheck, { recursive: true });
}
if (dupCard) {
  console.error(`이미 이 영상의 카드가 있습니다: cards/${dupCard}`);
  process.exit(1);
}

// PC마다 yt-dlp가 PATH에 잡혀있는지, python -m으로만 되는지 다를 수 있어 순서대로 시도한다.
const YTDLP_CANDIDATES = [
  { bin: 'yt-dlp', pre: [] },
  { bin: 'python', pre: ['-m', 'yt_dlp'] },
  { bin: 'py', pre: ['-m', 'yt_dlp'] },
  { bin: 'C:/Users/BOK/AppData/Roaming/Python/Python312/Scripts/yt-dlp.exe', pre: [] } // 이 PC(홈) 전용 최후 fallback
];
function runYtDlp(args) {
  const env = Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' });
  for (const { bin, pre } of YTDLP_CANDIDATES) {
    // 최신 yt-dlp는 JS 런타임 없이 YouTube 추출 시 자막 요청이 429로 막히는 경우가 있어 node를 지정한다.
    const r = spawnSync(bin, [...pre, '--js-runtimes', 'node', ...args], { encoding: 'utf8', env });
    if (!r.error) return r;
  }
  throw new Error('yt-dlp를 찾을 수 없습니다. `python -m pip install --user yt-dlp` 로 설치하세요.');
}

console.log(`[1/4] 메타데이터 조회: ${videoId}`);
const meta = runYtDlp(['--print', '%(title)s\t%(uploader)s\t%(upload_date)s', url]);
if (meta.status !== 0) { console.error(meta.stderr); process.exit(1); }
const [title, uploader, uploadDate] = meta.stdout.trim().split('\t');
console.log(`  제목: ${title}\n  채널: ${uploader}`);

const today = new Date().toISOString().slice(0, 10);
const tmpPrefix = path.join(os.tmpdir(), `kis_${videoId}`);

console.log('[2/4] 한국어 자동자막 다운로드(yt-dlp)');
const sub = runYtDlp(['--write-auto-sub', '--sub-lang', 'ko', '--skip-download', '--sub-format', 'vtt', '-o', tmpPrefix, url]);
const vttPath = `${tmpPrefix}.ko.vtt`;
if (!fs.existsSync(vttPath)) {
  console.error('자막을 받지 못했습니다(비공개 자막 없음일 수 있음). stderr:\n' + sub.stderr);
  process.exit(1);
}

console.log('[3/4] 자막 정제(중복 롤링캡션 제거)');
function cleanVtt(vttText) {
  const blocks = vttText.split(/\n\n+/);
  const out = [];
  let prev = null;
  for (const b of blocks) {
    if (!b.includes('-->')) continue;
    const textLines = b.split('\n').filter(l =>
      !l.includes('-->') && l.trim() && !l.startsWith('WEBVTT') && !l.startsWith('Kind:') && !l.startsWith('Language:'));
    for (const tl of textLines) {
      const clean = tl.replace(/<[^>]+>/g, '').trim();
      if (clean && clean !== prev) { out.push(clean); prev = clean; }
    }
  }
  return out.join(' ')
    .replace(/&gt;&gt;/g, '\n>>').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}
const cleaned = cleanVtt(fs.readFileSync(vttPath, 'utf8'));
fs.unlinkSync(vttPath);

// 자막 전문은 저장소에 보관하지 않는다 — OS 임시 폴더에 카드 작성용으로만 둔다(작성 후 --purge).
const textPath = tmpTextPath(videoId);
fs.writeFileSync(textPath, cleaned + '\n', 'utf8');
console.log(`  임시 저장: ${textPath} (${cleaned.length}자) — 저장소에는 올리지 않음`);

console.log('[4/4] 카드 스켈레톤 생성');
const slugBase = title.replace(/[\\/:*?"<>|[\]()!]/g, '').replace(/\s+/g, '').slice(0, 20);
const slug = `${slugBase}_${videoId.slice(0, 6)}`;
const cardPath = path.join(__dirname, '..', 'cards', `${slug}.md`);
if (fs.existsSync(cardPath)) {
  console.log(`  이미 카드가 있습니다: ${cardPath} (건너뜀)`);
} else {
  // KIS 유튜브 카드 원칙: date는 등록일이 아니라 실제 영상 게시일(upload_date, YYYYMMDD → YYYY-MM-DD)
  const videoDate = /^\d{8}$/.test(uploadDate || '')
    ? `${uploadDate.slice(0, 4)}-${uploadDate.slice(4, 6)}-${uploadDate.slice(6, 8)}`
    : today;
  const skeleton = `---
title: ${title} — ${uploader}
video: ${url}
date: ${videoDate}
tags: [TODO]
summary: TODO — 임시 자막 txt를 읽고 채울 것(원 영상 근거 없이 요약 금지, 원문 장문 인용 금지)
---
## 핵심 키포인트
- TODO(자막 읽고 채우기)

## 우리 업무 적용점
- TODO

## 참고
- 채널: ${uploader} / 업로드일: ${uploadDate || '확인 필요'}
- 본 카드는 YouTube 자동생성 한국어 자막을 근거로 정리(자막 전문은 저작권상 보관하지 않음)
`;
  fs.writeFileSync(cardPath, skeleton, 'utf8');
  console.log(`  생성: ${cardPath}`);
}

console.log(`\n다음 단계: 임시 자막(${textPath})을 읽고 카드의 TODO(핵심 키포인트/업무적용점/tags/summary)를 채운 뒤,`);
console.log('제목(title)은 낚시성 원제목 대신 내용을 직시한 제목으로 바꾸고(원제목은 참고란에 남김),');
console.log('node build.js 로 재빌드하고, node tools/sync-wikilinks.js 로 새 [[위키링크]]가 있으면 vault 노트도 채우세요.');
console.log(`마지막으로 임시 자막 삭제: node tools/new-card.js --purge ${videoId}`);
