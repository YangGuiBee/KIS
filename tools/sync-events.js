// AI/ICT event candidates are collected into a local pending queue.
// No candidate is published until an administrator approves it with approve-event.js.
//
// No-fabrication rule:
// - This script only stores text found on source pages.
// - Unknown date/place/fee/deadline fields stay "미확인".
// - The original URL and a short raw excerpt are kept for human review.
//
// Run: node tools/sync-events.js
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const CARDS_DIR = path.join(ROOT, 'cards');
const DATA_DIR = path.join(ROOT, 'data', 'events');
const SOURCES_FILE = path.join(__dirname, 'event-sources.json');
const PENDING_FILE = path.join(DATA_DIR, 'pending-events.json');
const APPROVED_FILE = path.join(DATA_DIR, 'approved-events.json');
const REJECTED_FILE = path.join(DATA_DIR, 'rejected-events.json');
const UA = 'Mozilla/5.0 (compatible; KIS-EventSync/1.0; +https://yangguibee.github.io/KIS)';

const DEFAULT_EVENT_KEYWORDS = [
  'AI', '인공지능', '생성형', 'LLM', 'GPT', 'AX', '데이터', '머신러닝', '딥러닝',
  '세미나', '컨퍼런스', '웨비나', '포럼', '교육', '특강', '사전등록', '참가신청', '전시'
];

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`${path.relative(ROOT, file)} 읽기 실패: ${e.message}`);
  }
}

function writeJson(file, data) {
  ensureDataDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function normalizeUrl(url, base) {
  try {
    return new URL(decodeEntities(url || '').trim(), base).toString();
  } catch {
    return '';
  }
}

function fetchText(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const client = /^https:/i.test(url) ? https : http;
    const req = client.get(url, { headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml' } }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirectsLeft > 0) {
        res.resume();
        return resolve(fetchText(new URL(res.headers.location, url).toString(), redirectsLeft - 1));
      }
      if (res.statusCode >= 400) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}: ${url}`));
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', c => (body += c));
      res.on('end', () => resolve(body));
    });
    req.setTimeout(20000, () => req.destroy(new Error(`timeout: ${url}`)));
    req.on('error', reject);
  });
}

function decodeEntities(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function stripTags(s) {
  return decodeEntities(String(s || ''))
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactText(s, max = 220) {
  const t = stripTags(s);
  return t.length > max ? t.slice(0, max - 1).trim() + '…' : t;
}

function hashId(s) {
  return crypto.createHash('sha1').update(String(s || '')).digest('hex').slice(0, 12);
}

function hasAny(text, words) {
  const t = String(text || '').toLowerCase();
  return words.some(w => t.includes(String(w).toLowerCase()));
}

function extractAnchors(html, baseUrl) {
  const anchors = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1] || '';
    const hrefMatch = attrs.match(/\bhref\s*=\s*["']?([^"'\s>]+)["']?/i);
    if (!hrefMatch) continue;
    const url = normalizeUrl(hrefMatch[1], baseUrl);
    if (!/^https?:\/\//i.test(url)) continue;
    const title = compactText(m[2], 140);
    if (!title || title.length < 3) continue;
    if (/^(#|javascript:|mailto:|tel:)/i.test(hrefMatch[1])) continue;
    anchors.push({ title, url, raw: m[0] });
  }
  return anchors;
}

function existingEventLinks() {
  const links = new Set();
  if (!fs.existsSync(CARDS_DIR)) return links;
  for (const f of fs.readdirSync(CARDS_DIR)) {
    if (!f.endsWith('.md')) continue;
    const txt = fs.readFileSync(path.join(CARDS_DIR, f), 'utf8');
    const m = txt.match(/^event:\s*(\S+)/m);
    if (m) links.add(m[1].trim());
  }
  return links;
}

function classifyEventType(source, text) {
  if (/웨비나|온라인/i.test(text)) return '웨비나';
  if (/교육|과정|수강|academy|아카데미/i.test(text)) return '교육';
  if (/전시|expo|참관/i.test(text)) return '전시';
  if (/컨퍼런스|conference|summit/i.test(text)) return '컨퍼런스';
  if (/포럼|forum/i.test(text)) return '포럼';
  if (/세미나|seminar/i.test(text)) return '세미나';
  if (source.type === 'education') return '교육';
  if (source.type === 'conference') return '컨퍼런스';
  if (source.type === 'forum') return '포럼';
  return '이벤트';
}

function guessDate(text) {
  const t = String(text || '');
  const patterns = [
    /20\d{2}[.\-\/년]\s*\d{1,2}[.\-\/월]\s*\d{1,2}일?/,
    /\d{1,2}[.\-\/월]\s*\d{1,2}일?\s*(?:\([^)]+\))?/,
    /20\d{2}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일/
  ];
  for (const p of patterns) {
    const m = t.match(p);
    if (m) return m[0].replace(/\s+/g, ' ').trim();
  }
  return '미확인';
}

function toCandidate(source, anchor) {
  const text = `${anchor.title} ${stripTags(anchor.raw)}`;
  const id = hashId(`${source.id}|${anchor.url}`);
  return {
    id,
    source: source.name,
    source_id: source.id,
    source_url: source.url,
    title: anchor.title,
    url: anchor.url,
    summary: anchor.title,
    event_type: classifyEventType(source, text),
    event_date: guessDate(text),
    place: /온라인|웨비나/i.test(text) ? '온라인' : '미확인',
    fee: /무료/i.test(text) ? '무료' : '미확인',
    host: source.name,
    deadline: '미확인',
    tags: Array.isArray(source.tags) ? source.tags : ['AI행사'],
    status: 'pending',
    collected_at: new Date().toISOString().slice(0, 10),
    evidence: {
      raw_excerpt: compactText(anchor.raw, 400)
    },
    notes: []
  };
}

function filterCandidates(source, anchors) {
  const include = source.includeKeywords || DEFAULT_EVENT_KEYWORDS;
  const exclude = source.excludeKeywords || [];
  const urlIncludes = source.urlIncludes || [];
  const urlExcludes = source.urlExcludes || [];
  const titleExcludes = source.titleExcludes || [];
  const globalTitleExcludes = ['LOGIN', 'JOIN', 'ENG', '공지사항', '뉴스레터', '갤러리'];
  const seen = new Set();
  return anchors.filter(a => {
    const text = `${a.title} ${a.url}`;
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    if (urlIncludes.length && !urlIncludes.some(x => a.url.includes(x))) return false;
    if (urlExcludes.length && urlExcludes.some(x => a.url.includes(x))) return false;
    if (globalTitleExcludes.includes(a.title.trim())) return false;
    if (titleExcludes.length && titleExcludes.some(x => a.title.includes(x))) return false;
    if (!hasAny(text, include)) return false;
    if (exclude.length && hasAny(text, exclude)) return false;
    return true;
  }).map(a => toCandidate(source, a));
}

function extractPageTitle(html, fallback) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return compactText(m ? m[1] : fallback, 140) || fallback;
}

function singlePageCandidate(source, html) {
  const title = source.title || extractPageTitle(html, source.name);
  const anchor = {
    title,
    url: source.url,
    raw: `<a href="${source.url}">${title}</a>`
  };
  return toCandidate(source, anchor);
}

async function main() {
  ensureDataDir();
  const sources = readJson(SOURCES_FILE, []);
  const pending = readJson(PENDING_FILE, []);
  const approved = readJson(APPROVED_FILE, []);
  const rejected = readJson(REJECTED_FILE, []);
  const knownLinks = existingEventLinks();
  for (const item of pending.concat(approved, rejected)) {
    if (item.url) knownLinks.add(item.url);
  }

  console.log(`출처 ${sources.length}개 / 기존 Event 카드 ${existingEventLinks().size}건 / 대기 ${pending.length}건`);
  const nextPending = pending.slice();
  let added = 0;

  for (const source of sources) {
    if (source.enabled === false) {
      console.log(`[${source.name}] 건너뜀: ${source.disabledReason || '비활성화'}`);
      continue;
    }
    console.log(`[${source.name}] 수집 중...`);
    let html = '';
    try {
      html = await fetchText(source.url);
    } catch (e) {
      console.error(`  실패: ${e.message}`);
      continue;
    }
    const anchors = extractAnchors(html, source.url);
    const rawCandidates = source.mode === 'singlePage'
      ? [singlePageCandidate(source, html)]
      : filterCandidates(source, anchors);
    const candidates = rawCandidates.filter(c => !knownLinks.has(c.url));
    console.log(`  링크 ${anchors.length}개 / 후보 ${candidates.length}개`);
    for (const c of candidates) {
      nextPending.push(c);
      knownLinks.add(c.url);
      added++;
    }
  }

  writeJson(PENDING_FILE, nextPending);
  console.log(`완료: 신규 후보 ${added}건, 전체 대기 ${nextPending.length}건`);
}

main().catch(err => { console.error(err); process.exit(1); });
