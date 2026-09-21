// docs/20260828-news-autoregister-plan.html §2(파이프라인 A)의 확정 설계를 구현한다.
// AI 전문매체 RSS 10곳을 직접 구독해 신규 기사만 cards/*.md(news:)로 아카이브한다.
// 오픈채팅방(파이프라인 B, 방장 사전고지 필요)과는 완전히 별개 — 채팅방 내용은 이 스크립트가
// 전혀 건드리지 않는다.
//
// 무-지어내기 원칙: summary는 RSS description을 그대로(잘라서만) 쓴다. 핵심 키포인트나
// 해석은 새로 지어내지 않는다.
//
// 실행: node tools/sync-news.js
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const CARDS_DIR = path.join(__dirname, '..', 'cards');
const UA = 'Mozilla/5.0 (compatible; KIS-NewsSync/1.0; +https://yangguibee.github.io/KIS)';

// docs/20260828-news-autoregister-plan.html §2-1a "최종 확정 목록(10개 소스)" 그대로.
// needsFilter=true인 곳만 AI 관련 키워드 필터를 통과해야 카드로 만든다(종합매체이므로).
// IT조선은 접속 차단으로 등록정보 미확인 상태라 보류(추가 안 함) — 지어내지 않음.
// 연합뉴스는 RSS <copyright>에 "AI 학습 및 활용 금지" 명시돼 있어 제외.
const FEEDS = [
  { name: '인공지능신문', url: 'https://www.aitimes.kr/rss/allArticle.xml', format: 'rss', needsFilter: false },
  { name: '바이라인네트워크', url: 'https://byline.network/feed/', format: 'rss', needsFilter: true },
  { name: 'VentureBeat AI', url: 'https://venturebeat.com/category/ai/feed/', format: 'rss', needsFilter: false },
  { name: 'MIT Technology Review', url: 'https://www.technologyreview.com/feed/', format: 'rss', needsFilter: true },
  { name: 'AI타임스', url: 'https://www.aitimes.com/rss/allArticle.xml', format: 'rss', needsFilter: false },
  { name: '전자신문', url: 'https://rss.etnews.com/Section901.xml', format: 'rss', needsFilter: true },
  { name: 'ZDNet Korea', url: 'https://feeds.feedburner.com/zdkorea', format: 'rss', needsFilter: true },
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', format: 'rss', needsFilter: true },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', format: 'atom', needsFilter: true },
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', format: 'rss', needsFilter: true },
];

const AI_KEYWORD_RE = /AI|인공지능|생성형|LLM|GPT/i;

function fetchText(url, redirectsLeft) {
  if (redirectsLeft === undefined) redirectsLeft = 5;
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': UA } }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirectsLeft > 0) {
        res.resume();
        return resolve(fetchText(res.headers.location, redirectsLeft - 1));
      }
      if (res.statusCode >= 400) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}: ${url}`));
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', c => (body += c));
      res.on('end', () => resolve(body));
    }).on('error', reject);
  });
}

function decodeEntities(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&');
}

function stripTags(s) {
  return decodeEntities(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decodeEntities(m[1]).trim() : '';
}

// RSS <link>텍스트</link> 또는 Atom <link href="..."/> 둘 다 지원.
function linkOf(block) {
  const textLink = tag(block, 'link');
  if (textLink && /^https?:\/\//.test(textLink)) return textLink;
  const m = block.match(/<link[^>]*\shref="([^"]+)"[^>]*\/?>/i);
  return m ? decodeEntities(m[1]).trim() : '';
}

function toIsoDate(raw) {
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const d = new Date(raw);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function parseFeed(xml, format) {
  const itemTag = format === 'atom' ? 'entry' : 'item';
  const blocks = xml.match(new RegExp(`<${itemTag}[^>]*>[\\s\\S]*?</${itemTag}>`, 'gi')) || [];
  return blocks.map(block => {
    const title = tag(block, 'title');
    const link = linkOf(block);
    const dateRaw = format === 'atom'
      ? (tag(block, 'published') || tag(block, 'updated'))
      : (tag(block, 'pubDate') || tag(block, 'dc:date'));
    const descRaw = format === 'atom'
      ? (tag(block, 'summary') || tag(block, 'content'))
      : (tag(block, 'description') || tag(block, 'content:encoded'));
    return { title, link, date: toIsoDate(dateRaw), summary: stripTags(descRaw) };
  }).filter(it => it.title && /^https?:\/\//.test(it.link));
}

function existingNewsLinks() {
  const links = new Set();
  if (!fs.existsSync(CARDS_DIR)) return links;
  for (const f of fs.readdirSync(CARDS_DIR)) {
    if (!f.endsWith('.md')) continue;
    const txt = fs.readFileSync(path.join(CARDS_DIR, f), 'utf8');
    const m = txt.match(/^news:\s*(\S+)/m);
    if (m) links.add(m[1].trim());
  }
  return links;
}

function slugify(title) {
  return String(title || '')
    .replace(/[\\/:*?"<>|[\]()!,."'’]/g, '')
    .replace(/\s+/g, '')
    .slice(0, 24) || 'news';
}

function hash6(s) {
  return crypto.createHash('sha1').update(s).digest('hex').slice(0, 6);
}

function toCard(item, sourceName) {
  // 자동수집 카드는 제목 앞에 [auto]를 붙여 사람이 직접 등록요청한 카드와 구분한다.
  const title = `[auto] ${item.title.replace(/\r?\n/g, ' ').trim()}`;
  const summary = item.summary ? item.summary.slice(0, 300) : '(요약 없음 — 원문에서 직접 확인)';
  const date = item.date || new Date().toISOString().slice(0, 10);
  return `---
title: ${title}
news: ${item.link}
date: ${date}
tags: [RSS수집, ${sourceName}]
summary: ${summary}
---
## 메타
- 출처: ${sourceName}
- 발행일: ${date}
- 수집일: ${new Date().toISOString().slice(0, 10)}

## 요약
${summary}

---
*이 카드는 ${sourceName} RSS를 매일 자동 동기화한 것입니다.*
`;
}

async function main() {
  const known = existingNewsLinks();
  console.log(`기존 news 카드 ${known.size}건`);

  let created = 0;
  for (const feed of FEEDS) {
    console.log(`[${feed.name}] 수집 중...`);
    let items;
    try {
      const xml = await fetchText(feed.url);
      items = parseFeed(xml, feed.format);
    } catch (e) {
      console.error(`  실패: ${e.message}`);
      continue;
    }
    console.log(`  ${items.length}건 수신`);

    const passed = feed.needsFilter ? items.filter(it => AI_KEYWORD_RE.test(it.title + ' ' + it.summary)) : items;
    const fresh = passed.filter(it => !known.has(it.link));
    console.log(`  필터 통과 ${passed.length}건 / 신규 ${fresh.length}건`);

    if (!fs.existsSync(CARDS_DIR)) fs.mkdirSync(CARDS_DIR, { recursive: true });
    for (const it of fresh) {
      const fname = `${slugify(it.title)}_${hash6(it.link)}.md`;
      const fpath = path.join(CARDS_DIR, fname);
      if (fs.existsSync(fpath)) continue;
      fs.writeFileSync(fpath, toCard(it, feed.name), 'utf8');
      known.add(it.link);
      created++;
    }
  }
  console.log(`완료: 카드 ${created}개 생성`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
