function getQuery(name) {
  const u = new URL(window.location.href);
  return u.searchParams.get(name);
}

function getStoredTheme() { return localStorage.getItem('theme') || '' }
function setTheme(t) { const b = document.body; b.classList.remove('light', 'dark'); if (t) { b.classList.add(t) }; localStorage.setItem('theme', t) }
function initTheme() {
  const saved = getStoredTheme(); if (saved) { setTheme(saved) } else { const prefers = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'; setTheme(prefers) }
  const btn = document.getElementById('theme-toggle'); if (btn) { btn.onclick = () => { const now = document.body.classList.contains('light') ? 'dark' : 'light'; setTheme(now); btn.textContent = now === 'light' ? '☀️' : '🌙'; }; btn.textContent = document.body.classList.contains('light') ? '☀️' : '🌙'; }
}

function parseFrontMatter(md) {
  if (!md.startsWith('---')) return { meta: {}, content: md };
  const lines = md.split(/\r?\n/);
  let i = 1; const meta = {};
  while (i < lines.length && lines[i].trim() !== '---') {
    const line = lines[i];
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (m) {
      const k = m[1]; let v = m[2].trim();
      if (v.startsWith('[') && v.endsWith(']')) { v = v.slice(1, -1).split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')); }
      meta[k] = v;
    }
    i++;
  }
  const content = lines.slice(i + 1).join('\n');
  return { meta, content };
}

function applyPalette(p) { const b = document.body;['pal-emerald', 'pal-rose', 'pal-amber', 'pal-violet'].forEach(c => b.classList.remove(c)); if (p && p !== 'default') { b.classList.add('pal-' + p); } localStorage.setItem('palette', p || 'default'); }
function initPalette() { const saved = localStorage.getItem('palette') || 'default'; applyPalette(saved); const wrap = document.getElementById('palette-select'); if (wrap) { const chips = wrap.querySelectorAll('.palette-chip'); chips.forEach(btn => { const val = btn.getAttribute('data-palette'); if (val === saved) btn.classList.add('active'); btn.onclick = () => { chips.forEach(b => b.classList.remove('active')); btn.classList.add('active'); applyPalette(val); } }); } }

async function loadPost() {
  const yearEl = document.getElementById('year'); if (yearEl) yearEl.textContent = new Date().getFullYear();
  initTheme();
  initPalette();

  const slug = getQuery('post');
  const titleEl = document.getElementById('post-title');
  const contentEl = document.getElementById('post-content');

  if (!slug) { titleEl.textContent = '未指定文章'; contentEl.innerHTML = '<p style="color:#fca5a5">URL 缺少 ?post= 参数</p>'; return; }

  try {
    const res = await fetch(`${window.location.pathname.includes('github.io') ? '' : './'}posts/${slug}.md`, { cache: 'no-cache' }); if (!res.ok) throw new Error('文章不存在或无法加载');
    const md = await res.text();
    const { meta, content } = parseFrontMatter(md);

    const html = window.marked ? window.marked.parse(content) : content;
    contentEl.innerHTML = html;

    let title = meta.title; if (!title) { const m = content.match(/^#\s+(.+)$/m); title = m ? m[1].trim() : slug; }
    let excerpt = meta.excerpt || '';
    if (!excerpt) { const p = content.split(/\n\n+/).find(blk => !blk.trim().startsWith('#')); if (p) excerpt = p.replace(/\s+/g, ' ').slice(0, 120); }

    document.title = `${title} · 我的生活记录`; titleEl.textContent = title;

    if (window.hljs) { window.requestAnimationFrame(() => window.hljs.highlightAll()); }
  } catch (err) { console.error(err); titleEl.textContent = '加载失败'; contentEl.innerHTML = `<p style="color:#fca5a5">${err.message}</p>`; }
}

window.addEventListener('DOMContentLoaded', loadPost);