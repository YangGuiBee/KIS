// 카드(cards/*.md)에 쓰인 [[위키링크]]를 전수 조사해서, C:\AX\obsidian\Raw\9.프로젝트(KIS)\ 안에
// 아직 없는 노트가 있으면 스텁 파일을 자동 생성한다. 이미 있는 노트는 절대 덮어쓰지 않는다.
// 실행: node tools/sync-wikilinks.js  (홈/가이아 PC 전용 — 사무실엔 이 vault가 없음)
'use strict';
const fs = require('fs');
const path = require('path');

const CARDS_DIR = path.join(__dirname, '..', 'cards');
const VAULT_DIR = 'C:/AX/obsidian/Raw/9.프로젝트(KIS)';
const today = new Date().toISOString().slice(0, 10);

if (!fs.existsSync(VAULT_DIR)) {
  console.log(`[안내] vault 폴더가 없습니다: ${VAULT_DIR}`);
  console.log('이 스크립트는 홈(가이아) PC 전용입니다. 사무실에서는 실행하지 마세요.');
  process.exit(0);
}

const files = fs.readdirSync(CARDS_DIR).filter(f => f.endsWith('.md'));

// name -> [{card, line}]
const refs = new Map();
for (const f of files) {
  const text = fs.readFileSync(path.join(CARDS_DIR, f), 'utf8');
  text.split(/\r?\n/).forEach(line => {
    const m = line.match(/\[\[([^\]]+)\]\]/g);
    if (!m) return;
    m.forEach(tok => {
      const name = tok.slice(2, -2);
      if (!refs.has(name)) refs.set(name, []);
      refs.get(name).push({ card: f, line: line.trim() });
    });
  });
}

let created = 0, skipped = 0;
for (const [name, uses] of [...refs.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  const notePath = path.join(VAULT_DIR, `${name}.md`);
  if (fs.existsSync(notePath)) { skipped++; continue; }

  const contextLines = uses.map(u => `- (${u.card}) ${u.line}`).join('\n');
  const body = `${name}\n\n` +
    `${contextLines}\n\n` +
    `※ ${today} sync-wikilinks.js가 카드 인용 문맥만으로 자동 생성한 초안 스텁입니다. 내용 보강은 직접.\n`;
  fs.writeFileSync(notePath, body, 'utf8');
  console.log(`[생성] ${name}.md (인용 ${uses.length}건)`);
  created++;
}

console.log(`완료: 신규 ${created}개, 기존 유지 ${skipped}개 (총 ${refs.size}개 위키링크)`);
