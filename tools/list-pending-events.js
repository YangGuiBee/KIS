// Print locally collected Event candidates for administrator review.
// Run: node tools/list-pending-events.js
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PENDING_FILE = path.join(ROOT, 'data', 'events', 'pending-events.json');

function readPending() {
  if (!fs.existsSync(PENDING_FILE)) return [];
  return JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8'));
}

const items = readPending();
if (!items.length) {
  console.log('검토 대기 Event 후보가 없습니다.');
  process.exit(0);
}

console.log(`검토 대기 Event 후보 ${items.length}건\n`);
items.forEach((it, i) => {
  console.log(`${i + 1}. [${it.id}] ${it.title}`);
  console.log(`   출처: ${it.source}`);
  console.log(`   유형: ${it.event_type || '미확인'} / 일시: ${it.event_date || '미확인'} / 장소: ${it.place || '미확인'} / 비용: ${it.fee || '미확인'}`);
  console.log(`   URL : ${it.url}`);
  console.log(`   요약: ${it.summary || '(요약 없음)'}`);
  console.log('');
});

