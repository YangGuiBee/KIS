// AI Study(https://yangguibee.github.io/paper.html)의 논문 수집 구글시트를 KIS 카드로
// 영구 아카이브한다. paper.html 쪽은 최신 20건만 보여주고 시트는 회전 캡이 있어 오래되면
// 지워지므로, 이 스크립트가 매일(GitHub Actions) 시트 전량을 받아 아직 카드가 없는 것만
// cards/*.md로 떠서 커밋한다.
//
// 무-지어내기 원칙: summary는 논문 자체의 abstract를 그대로(잘라서만) 쓰고,
// tags도 시트에 이미 있는 category/source 같은 사실 필드만 사용한다 — 사람이 안 읽고
// 해석·핵심키포인트를 새로 지어내지 않는다(TODO로 남겨 사람이 나중에 보강 가능).
//
// 실행: node tools/sync-papers.js
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwgpUNaWOqH3Cb4Pl9y2VwLfoVbzeammArSCdFoFgyntAmTuR9oLLEfmIHPIODFwHN2HA/exec';
const CARDS_DIR = path.join(__dirname, '..', 'cards');

function fetchJsonp(url, redirectsLeft) {
  if (redirectsLeft === undefined) redirectsLeft = 5;
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      // Apps Script 웹앱(script.google.com/.../exec)은 실제 콘텐츠를
      // script.googleusercontent.com으로 302 리다이렉트한다 — https.get은 자동으로
      // 따라가지 않으므로 직접 처리해야 한다.
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirectsLeft > 0) {
        res.resume();
        return resolve(fetchJsonp(res.headers.location, redirectsLeft - 1));
      }
      let body = '';
      res.on('data', c => (body += c));
      res.on('end', () => {
        // doGet은 항상 cb(...)로 감싸서 반환한다(callback 파라미터 생략 시 기본값 'cb').
        const m = body.match(/^\s*cb\((.*)\)\s*$/s);
        if (!m) return reject(new Error('예상치 못한 응답 형식(상태 ' + res.statusCode + '): ' + body.slice(0, 200)));
        try { resolve(JSON.parse(m[1])); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function existingPaperLinks() {
  const links = new Set();
  if (!fs.existsSync(CARDS_DIR)) return links;
  for (const f of fs.readdirSync(CARDS_DIR)) {
    if (!f.endsWith('.md')) continue;
    const txt = fs.readFileSync(path.join(CARDS_DIR, f), 'utf8');
    const m = txt.match(/^paper:\s*(\S+)/m);
    if (m) links.add(m[1].trim());
  }
  return links;
}

function slugify(title) {
  return String(title || '')
    .replace(/[\\/:*?"<>|[\]()!,."'’]/g, '')
    .replace(/\s+/g, '')
    .slice(0, 24) || 'paper';
}

function hash6(s) {
  return crypto.createHash('sha1').update(s).digest('hex').slice(0, 6);
}

// 2026-07-05 이전 수집분은 시트 컬럼 순서가 달라(레거시) title/authors/link/abstract가
// 밀려서 들어있다 — link가 URL 형태가 아니면 레거시로 보고 제자리로 되돌린다.
// (getNews()가 쓰는 최근 20건에는 영향 없어 paper.html에선 드러나지 않던 문제)
function normalizeItem(item) {
  if (/^https?:\/\//.test(item.link || '')) return item;
  return {
    collectedAt: item.collectedAt,
    category: item.link,
    title: item.category,
    publishedAt: item.collectedAt,
    authors: item.title,
    source: item.source,
    link: item.authors,
    stars: item.stars,
    abstract: item.publishedAt,
  };
}

function toCard(rawItem) {
  const item = normalizeItem(rawItem);
  const title = String(item.title || '').replace(/\r?\n/g, ' ').trim();
  const abstract = (item.abstract || '').trim();
  const summary = abstract ? abstract.slice(0, 300) : '(초록 없음 — 원문에서 직접 확인)';
  const tags = [item.category, item.source].filter(Boolean);
  const date = (item.publishedAt || item.collectedAt || '').slice(0, 10) || item.collectedAt;
  return `---
title: ${title}
paper: ${item.link}
date: ${date}
tags: [${tags.join(', ')}]
summary: ${summary.replace(/\r?\n/g, ' ')}
---
## 메타
- **출처**: ${item.source || 'TODO'}
- **저자**: ${item.authors || 'TODO'}
- **발행일**: ${item.publishedAt || 'TODO'}
- **수집일**: ${item.collectedAt || 'TODO'}
- **지표**: ${item.stars || '0'}

## 초록
${abstract || '(초록 없음 — 원문에서 직접 확인)'}

---
*이 카드는 [paper.html](https://yangguibee.github.io/paper.html) 수집 데이터를 매일 자동 동기화한 것입니다. 원문을 직접 검토해 태그·핵심 키포인트를 보강할 수 있습니다.*
`;
}

async function main() {
  console.log('[1/3] 구글시트 전량 조회...');
  const url = `${SCRIPT_URL}?action=getAllNews`;
  const res = await fetchJsonp(url);
  if (!res.ok) throw new Error('getAllNews 실패: ' + (res.msg || JSON.stringify(res)));
  const items = (res.data || []).map(normalizeItem);
  console.log(`  시트 전체 ${items.length}건`);

  console.log('[2/3] 이미 아카이브된 링크 확인...');
  const known = existingPaperLinks();
  console.log(`  기존 paper 카드 ${known.size}건`);

  const newItems = items.filter(it => it.link && !known.has(it.link));
  console.log(`[3/3] 신규 ${newItems.length}건 카드 생성`);

  if (!fs.existsSync(CARDS_DIR)) fs.mkdirSync(CARDS_DIR, { recursive: true });
  let created = 0;
  for (const it of newItems) {
    const fname = `${slugify(it.title)}_${hash6(it.link)}.md`;
    const fpath = path.join(CARDS_DIR, fname);
    if (fs.existsSync(fpath)) continue; // 방어적 재확인(해시 충돌 등)
    fs.writeFileSync(fpath, toCard(it), 'utf8');
    created++;
  }
  console.log(`완료: 카드 ${created}개 생성`);
  // GitHub Actions에서 커밋 여부를 판단할 수 있도록 종료 코드로 신호를 준다.
  process.exit(created > 0 ? 0 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
