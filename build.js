// KM 지식정보 사이트 빌더 — cards/*.md(프론트matter+본문) → 자체완결 index.html
// 무의존(Node stdlib). 실행: node build.js  → index.html 생성(검색·태그필터·카드).
'use strict';
const fs = require('fs');
const path = require('path');
const CARDS = path.join(__dirname, 'cards');
const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const enc = p => encodeURI('file:///' + String(p || '').replace(/\\/g, '/'));

function parse(md) {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) return null;
  const fm = {}, body = m[2];
  m[1].split(/\r?\n/).forEach(line => {
    const kv = line.match(/^(\w+):\s*(.*)$/); if (!kv) return;
    let v = kv[2].trim();
    if (v.startsWith('[') && v.endsWith(']')) v = v.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
    fm[kv[1]] = v;
  });
  return { fm, body };
}
function renderBody(b) { // 가벼운 md→html
  const out = []; let inUl = false;
  for (let line of b.split(/\r?\n/)) {
    line = line.replace(/\[\[([^\]]+)\]\]/g, (_, x) => `<span class="wl">${esc(x)}</span>`);
    line = esc(line).replace(/&lt;span class="wl"&gt;/g, '<span class="wl">').replace(/&lt;\/span&gt;/g, '</span>');
    line = line.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\[(\d{1,2}:\d{2})\]/g, '<code class="ts">[$1]</code>');
    if (/^##\s+/.test(line)) { if (inUl) { out.push('</ul>'); inUl = false; } out.push(`<h4>${line.replace(/^##\s+/, '')}</h4>`); }
    else if (/^-\s+/.test(line)) { if (!inUl) { out.push('<ul>'); inUl = true; } out.push(`<li>${line.replace(/^-\s+/, '')}</li>`); }
    else if (line.trim() === '') { if (inUl) { out.push('</ul>'); inUl = false; } }
    else out.push(`<p>${line}</p>`);
  }
  if (inUl) out.push('</ul>');
  return out.join('\n');
}

const files = fs.existsSync(CARDS) ? fs.readdirSync(CARDS).filter(f => f.endsWith('.md')) : [];
const cards = files.map(f => { const p = parse(fs.readFileSync(path.join(CARDS, f), 'utf8')); return p ? { file: f, ...p } : null; }).filter(Boolean);
const allTags = [...new Set(cards.flatMap(c => c.fm.tags || []))].sort();

const cardHtml = cards.map((c, i) => {
  const tags = (c.fm.tags || []).map(t => `<span class="tag" data-tag="${esc(t)}">${esc(t)}</span>`).join('');
  const vid = /^https?:/.test(c.fm.video || '') ? `<a href="${esc(c.fm.video)}" target="_blank">▶ 영상</a>` : `<span class="muted">${esc(c.fm.video || '')}</span>`;
  const srcLink = c.fm.source ? `<a href="${enc(c.fm.source)}" target="_blank">📄 스크립트 전문</a>` : '';
  let gallery = '';
  if (c.fm.images && fs.existsSync(c.fm.images)) {
    const imgs = fs.readdirSync(c.fm.images).filter(f => /\.(png|jpe?g)$/i.test(f)).sort();
    if (imgs.length) gallery = `<h4>🖼 캡처 이미지 (${imgs.length})</h4><div class="gal">` +
      imgs.map(im => { const u = enc(c.fm.images.replace(/\\/g, '/') + '/' + im); return `<a href="${u}" target="_blank"><img loading="lazy" src="${u}" title="${esc(im)}"></a>`; }).join('') + `</div>`;
  }
  return `<article class="card" data-tags="${esc((c.fm.tags || []).join('|'))}" data-text="${esc((c.fm.title + ' ' + c.fm.summary + ' ' + (c.fm.tags || []).join(' ')).toLowerCase())}">
    <div class="chd" onclick="this.parentNode.classList.toggle('open')">
      <div><div class="ct">${esc(c.fm.title)}</div><div class="cs">${esc(c.fm.summary)}</div><div class="tags">${tags}</div></div>
      <div class="meta">${vid}<span class="muted">${esc(c.fm.date || '')}</span><span class="exp">▾</span></div>
    </div>
    <div class="cbody">${renderBody(c.body)}${gallery}<div class="src muted">${srcLink}</div></div>
  </article>`;
}).join('\n');

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>지식정보사이트(KIS)</title><style>
:root{--ink:#1f2937;--mut:#6b7280;--line:#e5e7eb;--blue:#2563eb;--bg:#f8fafc}
*{box-sizing:border-box}body{margin:0;font-family:'Malgun Gothic','맑은 고딕',sans-serif;color:var(--ink);background:var(--bg)}
header{background:linear-gradient(135deg,#0f766e,#0891b2);color:#fff;padding:24px 30px}
header h1{margin:0;font-size:22px}header .s{opacity:.9;font-size:13px;margin-top:5px}
.wrap{max-width:1000px;margin:0 auto;padding:20px 30px 60px}
.bar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:6px 0 14px}
#q{flex:1;min-width:220px;padding:10px 12px;border:1px solid var(--line);border-radius:8px;font-size:14px}
.chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px}
.chip{padding:5px 11px;border:1px solid var(--line);border-radius:999px;font-size:12px;cursor:pointer;background:#fff}
.chip.on{background:var(--blue);color:#fff;border-color:var(--blue)}
.card{background:#fff;border:1px solid var(--line);border-radius:12px;margin-bottom:12px;overflow:hidden}
.chd{display:flex;justify-content:space-between;gap:12px;padding:14px 16px;cursor:pointer}
.ct{font-weight:800;font-size:15px}.cs{color:var(--mut);font-size:13px;margin-top:4px;line-height:1.5}
.tags{margin-top:8px}.tag{display:inline-block;background:#ecfeff;color:#0e7490;border:1px solid #cffafe;border-radius:6px;padding:1px 7px;font-size:11px;margin:2px 4px 0 0}
.meta{text-align:right;white-space:nowrap;font-size:12px;display:flex;flex-direction:column;gap:4px;align-items:flex-end}
.meta a{color:var(--blue);text-decoration:none;font-weight:700}
.exp{color:var(--mut)}.card.open .exp{transform:rotate(180deg)}
.cbody{display:none;padding:0 18px 16px;border-top:1px solid var(--line)}.card.open .cbody{display:block}
.cbody h4{margin:14px 0 6px;font-size:14px;color:#0e7490}.cbody ul{margin:6px 0;padding-left:20px}.cbody li{font-size:13.5px;line-height:1.7;margin:3px 0}
.cbody p{font-size:13.5px;line-height:1.7}.ts{background:#f1f5f9;padding:0 5px;border-radius:4px;font-size:12px;color:#334155}
.wl{background:#eef2ff;color:#4338ca;border-radius:4px;padding:0 5px;font-size:12px}
.muted{color:var(--mut)}.src{margin-top:12px;font-size:12px;word-break:break-all}.src a{color:var(--blue);font-weight:700;text-decoration:none}
.gal{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin:8px 0 4px}
.gal img{width:100%;height:100px;object-fit:cover;border:1px solid var(--line);border-radius:6px;cursor:pointer;transition:.15s}.gal img:hover{transform:scale(1.03);box-shadow:0 2px 8px rgba(0,0,0,.15)}
.count{color:var(--mut);font-size:13px}
</style></head><body>
<header><h1>📚 지식정보사이트(KIS)</h1></header>
<div class="wrap">
  <div class="bar"><input id="q" placeholder="🔍 제목·요약·태그 검색"><span class="count" id="cnt"></span></div>
  <div class="chips" id="chips">${allTags.map(t => `<span class="chip" data-tag="${esc(t)}">${esc(t)}</span>`).join('')}</div>
  <div id="list">${cardHtml || '<p class="muted">카드가 없습니다. cards/ 에 .md를 추가하고 node build.js 재실행.</p>'}</div>
</div>
<script>
const cards=[...document.querySelectorAll('.card')]; const sel=new Set();
function apply(){const q=document.getElementById('q').value.toLowerCase().trim();let n=0;
  cards.forEach(c=>{const okQ=!q||c.dataset.text.includes(q);const ct=c.dataset.tags.split('|');const okT=sel.size===0||[...sel].every(t=>ct.includes(t));
    const show=okQ&&okT;c.style.display=show?'':'none';if(show)n++;});
  document.getElementById('cnt').textContent=n+' / '+cards.length+' 카드';}
document.getElementById('q').addEventListener('input',apply);
document.querySelectorAll('#chips .chip').forEach(ch=>ch.onclick=()=>{const t=ch.dataset.tag;if(sel.has(t)){sel.delete(t);ch.classList.remove('on');}else{sel.add(t);ch.classList.add('on');}apply();});
document.querySelectorAll('.card .tag').forEach(tg=>tg.onclick=e=>{e.stopPropagation();const t=tg.dataset.tag;const ch=[...document.querySelectorAll('#chips .chip')].find(c=>c.dataset.tag===t);if(ch)ch.click();});
apply();
</script></body></html>`;
fs.writeFileSync(path.join(__dirname, 'index.html'), html, 'utf8');
console.log(`빌드 완료: index.html (카드 ${cards.length}개, 태그 ${allTags.length}종)`);
