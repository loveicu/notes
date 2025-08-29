// 文章页脚本（纯相对路径，兼容任意部署路径）
function getQuery(name) { try { return new URL(window.location.href).searchParams.get(name) } catch { return null } }

// 主题切换
function getStoredTheme() { return localStorage.getItem('theme') || '' }
function setTheme(t) { const b = document.body; b.classList.remove('light', 'dark'); if (t) { b.classList.add(t) }; localStorage.setItem('theme', t) }
function initTheme() { const saved = getStoredTheme(); if (saved) { setTheme(saved) } else { const prefers = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'; setTheme(prefers) }; const btn = document.getElementById('theme-toggle'); if (btn) { btn.onclick = () => { const now = document.body.classList.contains('light') ? 'dark' : 'light'; setTheme(now); btn.textContent = now === 'light' ? '☀️' : '🌙' }; btn.textContent = document.body.classList.contains('light') ? '☀️' : '🌙' } }

// 调色板（与首页一致）
function applyPalette(p) { const b = document.body;['pal-emerald', 'pal-rose', 'pal-amber', 'pal-violet'].forEach(c => b.classList.remove(c)); if (p && p !== 'default') { b.classList.add('pal-' + p) }; localStorage.setItem('palette', p || 'default') }
function initPaletteUI() { const saved = localStorage.getItem('palette') || 'default'; applyPalette(saved); const wrap = document.getElementById('palette-select'); if (!wrap) return; const chips = wrap.querySelectorAll('.palette-chip'); chips.forEach(btn => { const val = btn.getAttribute('data-palette'); if (val === saved) btn.classList.add('active'); btn.onclick = () => { chips.forEach(b => b.classList.remove('active')); btn.classList.add('active'); applyPalette(val) } }) }

// 简易 front-matter 解析（支持 key: value 与 [a,b]）
function parseFrontMatter(md) { if (!md.startsWith('---')) return { meta: {}, content: md }; const lines = md.split(/\r?\n/); let i = 1; const meta = {}; while (i < lines.length && lines[i].trim() !== '---') { const line = lines[i]; const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/); if (m) { const k = m[1]; let v = m[2].trim(); if (v.startsWith('[') && v.endsWith(']')) { v = v.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, '')) } meta[k] = v } i++ } const content = lines.slice(i + 1).join('\n'); return { meta, content } }

async function tryFetch(path) { try { const res = await fetch(path, { cache: 'no-cache' }); if (!res.ok) return null; return await res.text() } catch { return null } }

// 添加对 bundle.json 的回退支持
async function loadMarkdownWithFallback(slug) {
  const tried = []; const add = (s) => { if (s && !tried.includes(s)) tried.push(s) };
  const base = slug || ''; add(base); if (/-\d+$/.test(base)) add(base.replace(/-\d+$/, ''));
  const u2h = base.replace(/_/g, '-'); if (u2h !== base) add(u2h);
  const h2u = base.replace(/-/g, '_'); if (h2u !== base) add(h2u);
  const lc = base.toLowerCase(); if (lc !== base) add(lc);
  // 先尝试逐个 .md
  for (const s of tried) { const url = `./posts/${encodeURIComponent(s)}.md`; const text = await tryFetch(url); if (text != null) return { text, used: s, url } }
  // 若均失败，尝试一次性加载 bundle
  try {
    const res = await fetch('./posts/bundle.json', { cache: 'no-cache' });
    if (res.ok) {
      const bundle = await res.json();
      for (const s of tried) { if (bundle && typeof bundle[s] === 'string') { return { text: bundle[s], used: s, url: './posts/bundle.json' } } }
    }
  } catch {}
  return { error: true, tried: tried.map(s => `./posts/${s}.md`).concat(['./posts/bundle.json']) }
}

async function loadPost() {
  const yearEl = document.getElementById('year'); if (yearEl) yearEl.textContent = new Date().getFullYear(); initTheme(); initPaletteUI();
  const slug = getQuery('post'); const titleEl = document.getElementById('post-title'); const contentEl = document.getElementById('post-content');
  if (!slug) { if (titleEl) titleEl.textContent = '未指定文章'; if (contentEl) contentEl.innerHTML = '<p style="color:#fca5a5">URL 缺少 ?post= 参数</p>'; return }
  try {
    const r = await loadMarkdownWithFallback(slug); if (r.error) { throw new Error('未找到文章。已尝试：\n' + r.tried.join('\n')) }
    const { meta, content } = parseFrontMatter(r.text);
    const html = window.marked ? window.marked.parse(content) : content; contentEl.innerHTML = html;
    let title = meta.title; if (!title) { const m = content.match(/^#\s+(.+)$/m); title = m ? m[1].trim() : slug }
    document.title = `${title} · 记录`; titleEl.textContent = title;
    if (window.hljs) { window.requestAnimationFrame(() => window.hljs.highlightAll()) }
  } catch (err) { console.error(err); if (titleEl) titleEl.textContent = '加载失败'; if (contentEl) contentEl.innerHTML = `<pre style="white-space:pre-wrap;color:#fca5a5">${(err && err.message) || '文章不存在或无法加载'}</pre>` }
}

window.addEventListener('DOMContentLoaded', loadPost);