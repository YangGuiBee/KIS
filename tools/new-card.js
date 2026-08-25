// YouTube URL 하나로 (1) 자동자막 다운로드 (2) 정제해서 전문 스크립트 txt 저장
// (3) cards/ 에 프론트matter가 채워진 카드 스켈레톤 생성까지 자동화한다.
// 핵심 키포인트/요약 "본문"은 절대 자동 생성하지 않는다 — 무-지어내기 원칙상
// 반드시 스크립트를 실제로 읽은 사람(또는 이 스크립트를 실행한 클로드 세션)이 채워야 한다.
// 실행: node tools/new-card.js https://youtu.be/XXXXXXXXXXX
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const url = process.argv[2];
if (!url) {
  console.error('사용법: node tools/new-card.js <youtube-url>');
  process.exit(1);
}
const idMatch = url.match(/(?:v=|youtu\.be\/)([\w-]{11})/);
if (!idMatch) { console.error('YouTube 영상 ID를 URL에서 못 찾았습니다.'); process.exit(1); }
const videoId = idMatch[1];

const cardsDirCheck = path.join(__dirname, '..', 'cards');
const dupCard = fs.readdirSync(cardsDirCheck).find(f =>
  fs.readFileSync(path.join(cardsDirCheck, f), 'utf8').includes(videoId));
if (dupCard) {
  console.error(`이미 이 영상의 카드가 있습니다: cards/${dupCard}`);
  process.exit(1);
}

const YTDLP_CANDIDATES = [
  'yt-dlp',
  'C:/Users/BOK/AppData/Roaming/Python/Python312/Scripts/yt-dlp.exe'
];
function runYtDlp(args) {
  const env = Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' });
  for (const bin of YTDLP_CANDIDATES) {
    const r = spawnSync(bin, args, { encoding: 'utf8', env });
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
const tmpPrefix = path.join(__dirname, '..', `_tmp_${videoId}`);

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

const safeTitle = title.replace(/[\\/:*?"<>|]/g, '').slice(0, 40);
const scriptDir = path.join(__dirname, '..', 'scripts', today);
fs.mkdirSync(scriptDir, { recursive: true });
const scriptPath = path.join(scriptDir, `${safeTitle}_전문스크립트.txt`);
fs.writeFileSync(scriptPath, cleaned + '\n', 'utf8');
console.log(`  저장: ${scriptPath} (${cleaned.length}자, 로컬 전용·gitignore)`);

console.log('[4/4] 카드 스켈레톤 생성');
const slugBase = title.replace(/[\\/:*?"<>|[\]()!]/g, '').replace(/\s+/g, '').slice(0, 20);
const slug = `${slugBase}_${videoId.slice(0, 6)}`;
const cardPath = path.join(__dirname, '..', 'cards', `${slug}.md`);
if (fs.existsSync(cardPath)) {
  console.log(`  이미 카드가 있습니다: ${cardPath} (건너뜀)`);
} else {
  const scriptRelForSource = scriptPath.replace(/\\/g, '/');
  const skeleton = `---
title: ${title} — ${uploader}
video: ${url}
source: ${scriptRelForSource}
date: ${today}
tags: [TODO]
summary: TODO — 아래 전문 스크립트를 읽고 채울 것(원 영상 근거 없이 요약 금지)
---
## 핵심 키포인트
- TODO(스크립트 읽고 채우기)

## 우리 업무 적용점
- TODO

## 참고
- 채널: ${uploader} / 업로드일: ${uploadDate || '확인 필요'}
- 본 카드는 YouTube 자동생성 한국어 자막을 근거로 정리 예정
`;
  fs.writeFileSync(cardPath, skeleton, 'utf8');
  console.log(`  생성: ${cardPath}`);
}

console.log('\n다음 단계: 전문 스크립트를 읽고 카드의 TODO(핵심 키포인트/업무적용점/tags/summary)를 채운 뒤,');
console.log('node build.js 로 재빌드하고, node tools/sync-wikilinks.js 로 새 [[위키링크]]가 있으면 vault 노트도 채우세요.');
