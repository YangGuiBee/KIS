// Approve one pending Event candidate and publish it as cards/event_*.md.
// Run: node tools/approve-event.js <candidate-id>
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const CARDS_DIR = path.join(ROOT, 'cards');
const DATA_DIR = path.join(ROOT, 'data', 'events');
const PENDING_FILE = path.join(DATA_DIR, 'pending-events.json');
const APPROVED_FILE = path.join(DATA_DIR, 'approved-events.json');

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, data) {
  if (!fs.existsSync(path.dirname(file))) fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function hash6(s) {
  return crypto.createHash('sha1').update(String(s || '')).digest('hex').slice(0, 6);
}

function slugify(title) {
  return String(title || '')
    .replace(/[\\/:*?"<>|[\]()!,."'’]/g, '')
    .replace(/\s+/g, '')
    .slice(0, 24) || 'event';
}

function yamlValue(v) {
  const s = String(v || '').replace(/\r?\n/g, ' ').trim();
  return s.replace(/"/g, '\\"');
}

function tagsValue(tags) {
  const xs = Array.isArray(tags) ? tags : [];
  const clean = xs.map(t => String(t || '').trim()).filter(Boolean);
  if (!clean.includes('자동수집후보')) clean.unshift('자동수집후보');
  return clean.join(', ');
}

function isSameText(a, b) {
  return String(a || '').replace(/\s+/g, ' ').trim() === String(b || '').replace(/\s+/g, ' ').trim();
}

function cardSummary(item) {
  const raw = String(item.summary || '').trim();
  if (raw && !isSameText(raw, item.title)) return raw;
  const type = item.event_type || '이벤트';
  const source = item.source || '수집 출처';
  return `${source}에서 수집한 ${type} 후보입니다. 세부 정보는 원문에서 확인하세요.`;
}

function toCard(item) {
  const today = new Date().toISOString().slice(0, 10);
  const summary = cardSummary(item);
  return `---
title: "${yamlValue(item.title)}"
event: ${item.url}
date: ${today}
tags: [${tagsValue(item.tags)}]
summary: "${yamlValue(summary)}"
etype: "${yamlValue(item.event_type || '이벤트')}"
edate: "${yamlValue(item.event_date || '미확인')}"
eplace: "${yamlValue(item.place || '미확인')}"
efee: "${yamlValue(item.fee || '미확인')}"
ehost: "${yamlValue(item.host || item.source || '미확인')}"
edeadline: "${yamlValue(item.deadline || '미확인')}"
---
## 행사 정보
- 출처: ${item.source || '미확인'}
- 수집일: ${item.collected_at || '미확인'}
- 승인일: ${today}
- 원문: ${item.url}

## 요약
${summary}

## 검토 메모
- 일시, 장소, 비용, 마감은 원문 기준으로 확인 필요
- 원문에 없는 정보는 지어내지 않고 "미확인"으로 둠

---
*이 카드는 Event 자동수집 후보를 관리자가 승인해 게시한 것입니다.*
`;
}

function main() {
  const id = process.argv[2];
  if (!id) {
    console.error('사용법: node tools/approve-event.js <candidate-id>');
    process.exit(1);
  }
  const pending = readJson(PENDING_FILE, []);
  const idx = pending.findIndex(it => it.id === id);
  if (idx < 0) {
    console.error(`후보를 찾을 수 없습니다: ${id}`);
    process.exit(1);
  }

  const item = { ...pending[idx], status: 'approved', approved_at: new Date().toISOString() };
  const filename = `event_${slugify(item.title)}_${hash6(item.url)}.md`;
  const cardPath = path.join(CARDS_DIR, filename);
  if (!fs.existsSync(CARDS_DIR)) fs.mkdirSync(CARDS_DIR, { recursive: true });
  if (fs.existsSync(cardPath)) {
    console.error(`이미 카드가 있습니다: ${path.relative(ROOT, cardPath)}`);
    process.exit(1);
  }

  fs.writeFileSync(cardPath, toCard(item), 'utf8');
  pending.splice(idx, 1);
  const approved = readJson(APPROVED_FILE, []);
  approved.push({ ...item, card: path.relative(ROOT, cardPath).replace(/\\/g, '/') });
  writeJson(PENDING_FILE, pending);
  writeJson(APPROVED_FILE, approved);

  console.log(`승인 완료: ${item.title}`);
  console.log(`카드 생성: ${path.relative(ROOT, cardPath)}`);
}

main();
