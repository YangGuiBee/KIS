// KM 지식정보 사이트 빌더 — cards/*.md(프론트matter+본문) → 자체완결 index.html
// 무의존(Node stdlib). 실행: node build.js  → index.html 생성(검색·태그필터·카드).
'use strict';
const fs = require('fs');
const path = require('path');
const CARDS = path.join(__dirname, 'cards');
const SITE_TITLE = '놓치면 안되는 정말 중요한 AI 지식정보사이트(KIS)';
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

function sourceMtime(source) {
  if (!source) return 0;
  try {
    return fs.existsSync(source) ? fs.statSync(source).mtimeMs : 0;
  } catch {
    return 0;
  }
}

const files = fs.existsSync(CARDS) ? fs.readdirSync(CARDS).filter(f => f.endsWith('.md')) : [];
const cards = files.map(f => {
  const p = parse(fs.readFileSync(path.join(CARDS, f), 'utf8'));
  if (!p) return null;
  const dateMs = Date.parse(p.fm.date || '');
  return {
    file: f,
    sortDate: Number.isFinite(dateMs) ? dateMs : 0,
    sortSource: sourceMtime(p.fm.source),
    ...p
  };
}).filter(Boolean).sort((a, b) =>
  (b.sortDate - a.sortDate) ||
  (b.sortSource - a.sortSource) ||
  a.file.localeCompare(b.file, 'ko')
);
const allTags = [...new Set(cards.flatMap(c => c.fm.tags || []))].sort();

const cardHtml = cards.map((c, i) => {
  const tags = (c.fm.tags || []).map(t => `<span class="tag" data-tag="${esc(t)}">${esc(t)}</span>`).join('');
  const YT = '<svg class="ci" viewBox="0 0 24 24" aria-hidden="true"><path fill="#FF0000" d="M23.5 6.2a3 3 0 0 0-2.11-2.12C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.39.58A3 3 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.8 3 3 0 0 0 2.11 2.12C4.5 20.5 12 20.5 12 20.5s7.5 0 9.39-.58A3 3 0 0 0 23.5 17.8 31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.8z"/><path fill="#fff" d="M9.6 15.6V8.4l6.2 3.6z"/></svg>';
  const WEB = '<svg class="ci" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.2" fill="none" stroke="#0891b2" stroke-width="1.7"/><path d="M2.8 12h18.4M12 2.8c2.6 2.5 4.1 5.9 4.1 9.2s-1.5 6.7-4.1 9.2c-2.6-2.5-4.1-5.9-4.1-9.2S9.4 5.3 12 2.8z" fill="none" stroke="#0891b2" stroke-width="1.7"/></svg>';
  const hasYt = /^https?:/.test(c.fm.video || '');
  const hasWww = /^https?:/.test(c.fm.link || '');
  const links = [];
  if (hasYt) links.push(`<a class="lnk" href="${esc(c.fm.video)}" target="_blank">${YT}YouTube</a>`);
  if (hasWww) links.push(`<a class="lnk" href="${esc(c.fm.link)}" target="_blank">${WEB}WWW</a>`);
  const vid = links.join('') || `<span class="muted">${esc(c.fm.video || '')}</span>`;
  const srcLink = c.fm.source ? `<a href="${enc(c.fm.source)}" target="_blank">📄 스크립트 전문</a>` : '';
  let gallery = '';
  if (c.fm.images && fs.existsSync(c.fm.images)) {
    const imgs = fs.readdirSync(c.fm.images).filter(f => /\.(png|jpe?g)$/i.test(f)).sort();
    if (imgs.length) gallery = `<h4>🖼 캡처 이미지 (${imgs.length})</h4><div class="gal">` +
      imgs.map(im => { const u = enc(c.fm.images.replace(/\\/g, '/') + '/' + im); return `<a href="${u}" target="_blank"><img loading="lazy" src="${u}" title="${esc(im)}"></a>`; }).join('') + `</div>`;
  }
  return `<article class="card" data-yt="${hasYt ? 1 : 0}" data-www="${hasWww ? 1 : 0}" data-tags="${esc((c.fm.tags || []).join('|'))}" data-text="${esc((c.fm.title + ' ' + c.fm.summary + ' ' + (c.fm.tags || []).join(' ')).toLowerCase())}">
    <div class="chd" onclick="this.parentNode.classList.toggle('open')">
      <div><div class="ct">${esc(c.fm.title)}</div><div class="cs">${esc(c.fm.summary)}</div><div class="tags">${tags}</div></div>
      <div class="meta">${vid}<span class="muted">${esc(c.fm.date || '')}</span><span class="exp">▾</span></div>
    </div>
    <div class="cbody">${renderBody(c.body)}${gallery}<div class="src muted">${srcLink}</div></div>
  </article>`;
}).join('\n');

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${SITE_TITLE}</title><style>
:root{--ink:#1f2937;--mut:#6b7280;--line:#e5e7eb;--blue:#2563eb;--bg:#f8fafc;--card:#fff;--tagbg:#ecfeff;--tagink:#0e7490;--tagline:#cffafe}
body.dark{--ink:#e5e7eb;--mut:#9ca3af;--line:#334155;--blue:#38bdf8;--bg:#0f172a;--card:#1e293b;--tagbg:#0e3a44;--tagink:#67e8f9;--tagline:#155e63}
*{box-sizing:border-box}body{margin:0;font-family:'Malgun Gothic','맑은 고딕',sans-serif;color:var(--ink);background:var(--bg);transition:background .2s,color .2s}
header{background:linear-gradient(135deg,#0f766e,#0891b2);color:#fff;padding:24px 30px;display:flex;justify-content:space-between;align-items:center;gap:12px}
.tgl{cursor:pointer;border:1px solid rgba(255,255,255,.55);background:rgba(255,255,255,.14);color:#fff;border-radius:999px;padding:7px 14px;font-size:13px;font-weight:700;white-space:nowrap}.tgl:hover{background:rgba(255,255,255,.26)}
header h1{margin:0;font-size:22px}header .s{opacity:.9;font-size:13px;margin-top:5px}
.wrap{max-width:1000px;margin:0 auto;padding:20px 30px 60px}
.bar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:6px 0 14px}
#q{flex:1;min-width:220px;padding:10px 12px;border:1px solid var(--line);border-radius:8px;font-size:14px;background:var(--card);color:var(--ink)}
.chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px}
.chip{padding:5px 11px;border:1px solid var(--line);border-radius:999px;font-size:12px;cursor:pointer;background:var(--card);color:var(--ink)}
.chip.on{background:var(--blue);color:#fff;border-color:var(--blue)}
.card{background:var(--card);border:2px solid #7dd3fc;border-radius:12px;margin-bottom:12px;overflow:hidden;transition:transform .18s ease,box-shadow .18s ease,border-color .18s}
.card:hover{transform:translateY(-3px);box-shadow:0 8px 22px rgba(8,145,178,.20)}
.card.open{border-color:#38bdf8}
.chd{display:flex;justify-content:space-between;gap:12px;padding:14px 16px;cursor:pointer}
.ct{font-weight:800;font-size:15px}.cs{color:var(--mut);font-size:13px;margin-top:4px;line-height:1.5}
.tags{margin-top:8px}.tag{display:inline-block;background:var(--tagbg);color:var(--tagink);border:1px solid var(--tagline);border-radius:6px;padding:1px 7px;font-size:11px;margin:2px 4px 0 0;cursor:pointer}
.meta{text-align:right;white-space:nowrap;font-size:12px;display:flex;flex-direction:column;gap:4px;align-items:flex-end}
.meta a{color:var(--blue);text-decoration:none;font-weight:700}
.lnk{display:inline-flex;align-items:center;gap:5px}.ci{width:16px;height:16px;flex:0 0 auto}
.exp{color:#7dd3fc;font-size:22px;font-weight:900;line-height:1;transition:transform .15s}.card.open .exp{transform:rotate(180deg);color:#38bdf8}
.cbody{display:none;padding:0 18px 16px;border-top:1px solid var(--line)}.card.open .cbody{display:block}
.cbody h4{margin:14px 0 6px;font-size:14px;color:#0e7490}.cbody ul{margin:6px 0;padding-left:20px}.cbody li{font-size:13.5px;line-height:1.7;margin:3px 0}
.cbody p{font-size:13.5px;line-height:1.7}.ts{background:#f1f5f9;padding:0 5px;border-radius:4px;font-size:12px;color:#334155}
.wl{background:#eef2ff;color:#4338ca;border-radius:4px;padding:0 5px;font-size:12px}
.muted{color:var(--mut)}.src{margin-top:12px;font-size:12px;word-break:break-all}.src a{color:var(--blue);font-weight:700;text-decoration:none}
.gal{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin:8px 0 4px}
.gal img{width:100%;height:100px;object-fit:cover;border:1px solid var(--line);border-radius:6px;cursor:pointer;transition:.15s}.gal img:hover{transform:scale(1.03);box-shadow:0 2px 8px rgba(0,0,0,.15)}
.count{color:var(--mut);font-size:13px}
</style></head><body>
<header><h1>📚 ${SITE_TITLE}</h1><button class="tgl" id="tgl">다크모드</button></header>
<div class="wrap">
  <div class="bar"><input id="q" placeholder="🔍 제목·요약·태그 검색"><span class="count" id="cnt"></span></div>
  <div class="chips" id="chips">${allTags.map(t => `<span class="chip" data-tag="${esc(t)}">${esc(t)}</span>`).join('')}</div>
  <div id="list">${cardHtml || '<p class="muted">카드가 없습니다. cards/ 에 .md를 추가하고 node build.js 재실행.</p>'}</div>
</div>
<script>
const _tgl=document.getElementById('tgl');
function _setTheme(d){document.body.classList.toggle('dark',d);_tgl.textContent=d?'라이트모드':'다크모드';}
_setTheme(localStorage.getItem('kis-theme')==='dark');
_tgl.onclick=()=>{const d=!document.body.classList.contains('dark');localStorage.setItem('kis-theme',d?'dark':'light');_setTheme(d);};
const cards=[...document.querySelectorAll('.card')]; const sel=new Set();
function apply(){const q=document.getElementById('q').value.toLowerCase().trim();let n=0,ny=0,nw=0;
  cards.forEach(c=>{const okQ=!q||c.dataset.text.includes(q);const ct=c.dataset.tags.split('|');const okT=sel.size===0||[...sel].every(t=>ct.includes(t));
    const show=okQ&&okT;c.style.display=show?'':'none';if(show){n++;if(c.dataset.yt==='1')ny++;if(c.dataset.www==='1')nw++;}});
  document.getElementById('cnt').textContent='총 '+n+' 건(YouTube '+ny+'건, WWW '+nw+'건)';}
document.getElementById('q').addEventListener('input',apply);
document.querySelectorAll('#chips .chip').forEach(ch=>ch.onclick=()=>{const t=ch.dataset.tag;if(sel.has(t)){sel.delete(t);ch.classList.remove('on');}else{sel.add(t);ch.classList.add('on');}apply();});
document.querySelectorAll('.card .tag').forEach(tg=>tg.onclick=e=>{e.stopPropagation();const t=tg.dataset.tag;const ch=[...document.querySelectorAll('#chips .chip')].find(c=>c.dataset.tag===t);if(ch)ch.click();});
apply();
</script></body></html>`;
fs.writeFileSync(path.join(__dirname, 'index.html'), html, 'utf8');
console.log(`빌드 완료: index.html (카드 ${cards.length}개, 태그 ${allTags.length}종)`);
