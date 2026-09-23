// Reject one pending Event candidate so it will not be shown again.
// Run: node tools/reject-event.js <candidate-id> [reason]
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data', 'events');
const PENDING_FILE = path.join(DATA_DIR, 'pending-events.json');
const REJECTED_FILE = path.join(DATA_DIR, 'rejected-events.json');

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, data) {
  if (!fs.existsSync(path.dirname(file))) fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

const id = process.argv[2];
const reason = process.argv.slice(3).join(' ') || '관리자 제외';
if (!id) {
  console.error('사용법: node tools/reject-event.js <candidate-id> [reason]');
  process.exit(1);
}

const pending = readJson(PENDING_FILE, []);
const idx = pending.findIndex(it => it.id === id);
if (idx < 0) {
  console.error(`후보를 찾을 수 없습니다: ${id}`);
  process.exit(1);
}

const item = {
  ...pending[idx],
  status: 'rejected',
  rejected_at: new Date().toISOString(),
  reject_reason: reason
};
pending.splice(idx, 1);
const rejected = readJson(REJECTED_FILE, []);
rejected.push(item);
writeJson(PENDING_FILE, pending);
writeJson(REJECTED_FILE, rejected);

console.log(`제외 완료: ${item.title}`);
console.log(`사유: ${reason}`);

