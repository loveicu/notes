// 工具：格式化日期为 YYYY-MM-DD
function formatDate(iso){
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

function groupByYear(posts){
  const map = new Map();
  for(const p of posts){
    const y = new Date(p.date).getFullYear() || '未知';
    if(!map.has(y)) map.set(y, []);
    map.get(y).push(p);
  }
  return Array.from(map.entries())
    .sort((a,b)=> b[0]-a[0]) // 年份倒序
    .map(([y,list])=>({year:y, list:list.sort((a,b)=> new Date(b.date)-new Date(a.date))}));
}

// 主题切换
function getStoredTheme(){return localStorage.getItem('theme')||''}
function setTheme(t){const b=document.body; b.classList.remove('light','dark'); if(t){b.classList.add(t)}; localStorage.setItem('theme',t)}
function initTheme(){const saved=getStoredTheme(); if(saved){setTheme(saved)} else {const prefers=window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'; setTheme(prefers)}
  const btn=document.getElementById('theme-toggle'); if(btn){btn.onclick=()=>{const now=document.body.classList.contains('light')?'dark':'light'; setTheme(now); btn.textContent= now==='light'?'☀️':'🌙';}; btn.textContent=document.body.classList.contains('light')?'☀️':'🌙';}}

const state={posts:[], filtered:[], selectedTags:new Set(), search:'', page:1, pageSize:10}

function buildAllTags(posts){const s=new Set(); posts.forEach(p=>{(p.tags||[]).forEach(t=>s.add(t))}); return Array.from(s).sort()}

// 调色板
function applyPalette(p){ const b=document.body; ['pal-emerald','pal-rose','pal-amber','pal-violet'].forEach(c=>b.classList.remove(c)); if(p&&p!=='default'){ b.classList.add('pal-'+p); } localStorage.setItem('palette', p||'default'); }
function initPaletteUI(){ const saved=localStorage.getItem('palette')||'default'; applyPalette(saved); const wrap=document.getElementById('palette-select'); if(wrap){ const chips=wrap.querySelectorAll('.palette-chip'); chips.forEach(btn=>{ const val=btn.getAttribute('data-palette'); if(val===saved) btn.classList.add('active'); btn.onclick=()=>{ chips.forEach(b=>b.classList.remove('active')); btn.classList.add('active'); applyPalette(val); }; }); } }

// 全文索引
const contentIndex={}; let indexBuilt=false; let indexBuilding=false;
function updateSearchStatus(msg){ const el=document.getElementById('search-status'); if(el) el.textContent=msg||''; }
function stripMd(s){ return s
  .replace(/^---[\s\S]*?---\s*/,'') // front-matter
  .replace(/```[\s\S]*?```/g,' ')     // 代码块
  .replace(/`([^`]+)`/g,' $1 ')         // 行内代码
  .replace(/!\[[^\]]*\]\([^\)]*\)/g,' ') // 图片
  .replace(/\[[^\]]*\]\([^\)]*\)/g,' ')  // 链接
  .replace(/[#>*_\-`~]/g,' ')
  .replace(/<[^>]+>/g,' ')              // 简单去HTML
  .replace(/\s+/g,' ')                 // 多空白
}
async function ensureContentIndex(){ if(indexBuilt||indexBuilding) return; indexBuilding=true; updateSearchStatus('正在构建全文索引...');
  await Promise.allSettled(state.posts.map(async p=>{ try{ const res=await fetch(`posts/${p.slug}.md`,{cache:'no-cache'}); if(!res.ok) return; let md=await res.text(); md=md.slice(0,50000); contentIndex[p.slug]=stripMd(md).toLowerCase(); }catch(e){} }));
  indexBuilt=true; indexBuilding=false; updateSearchStatus(''); }

// 覆盖 applyFilters 以支持全文
function applyFilters(){ const kw=(state.search||'').trim().toLowerCase(); const chosen=state.selectedTags; let list=state.posts.filter(p=> chosen.size===0 || (p.tags||[]).some(t=>chosen.has(t)) );
  if(kw){
    // 如未构建索引，先按标题/摘要过滤并触发索引构建
    if(!indexBuilt && !indexBuilding){ ensureContentIndex().then(()=> applyFilters()); }
    list=list.filter(p=> (p.title||'').toLowerCase().includes(kw) || (p.excerpt||'').toLowerCase().includes(kw) || (indexBuilt && contentIndex[p.slug] && contentIndex[p.slug].includes(kw)) );
  }
  state.filtered=list; state.page=1; renderAll(); }

// 在 loadTimeline 完成初始化
function renderTagChips(tags){const wrap=document.getElementById('tag-filters'); if(!wrap) return; wrap.innerHTML=''; tags.forEach(tag=>{const btn=document.createElement('button'); btn.className='tag-chip'; btn.textContent=tag; btn.onclick=()=>{ if(state.selectedTags.has(tag)) state.selectedTags.delete(tag); else state.selectedTags.add(tag); btn.classList.toggle('active'); applyFilters(); }; wrap.appendChild(btn); })}

function paginate(list){const total=list.length; const pages=Math.max(1, Math.ceil(total/state.pageSize)); const start=(state.page-1)*state.pageSize; const end=start+state.pageSize; return {total,pages,items:list.slice(start,end)} }

function renderPagination(pages){const nav=document.getElementById('pagination'); if(!nav) return; nav.innerHTML=''; if(pages<=1) return; const prev=document.createElement('button'); prev.className='page-btn'; prev.textContent='上一页'; prev.disabled=state.page<=1; prev.onclick=()=>{ if(state.page>1){state.page--; renderAll()} };
  nav.appendChild(prev);
  for(let i=1;i<=pages;i++){const b=document.createElement('button'); b.className='page-btn'+(i===state.page?' active':''); b.textContent=String(i); b.onclick=()=>{state.page=i; renderAll()}; nav.appendChild(b)}
  const next=document.createElement('button'); next.className='page-btn'; next.textContent='下一页'; next.disabled=state.page>=pages; next.onclick=()=>{ if(state.page<pages){state.page++; renderAll()} }; nav.appendChild(next); }

function renderTimeline(list){const timeline=document.getElementById('timeline'); if(!timeline) return; const grouped=groupByYear(list); const frag=document.createDocumentFragment();
  grouped.forEach(g=>{ const group=document.createElement('div'); group.className='year-group';
    const yearTitle=document.createElement('div'); yearTitle.className='timeline-year'; yearTitle.textContent=g.year; let collapsed=false; yearTitle.onclick=()=>{collapsed=!collapsed; yearTitle.classList.toggle('collapsed',collapsed); items.classList.toggle('collapsed',collapsed)}; group.appendChild(yearTitle);
    const items=document.createElement('div'); items.className='year-items';
    g.list.forEach(post=>{ const item=document.createElement('div'); item.className='timeline-item';
      const row=document.createElement('div'); row.className='timeline-row';
      const date=document.createElement('span'); date.className='timeline-date'; date.textContent=formatDate(post.date);
      const title=document.createElement('a'); title.className='post-title'; title.href=`post.html?post=${encodeURIComponent(post.slug)}`; title.textContent=post.title;
      row.appendChild(date); row.appendChild(title); item.appendChild(row);
      if(post.excerpt){const ex=document.createElement('p'); ex.className='excerpt'; ex.textContent=post.excerpt; item.appendChild(ex)}
      items.appendChild(item);
    });
    group.appendChild(items); frag.appendChild(group);
  });
  timeline.innerHTML=''; timeline.appendChild(frag);
}

function renderAll(){const {items,total,pages}=paginate(state.filtered); renderTimeline(items); renderPagination(pages)}

// ... existing code ...

  function debounce(fn, delay){ let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn.apply(null,args), delay); } }
  async function loadTimeline(){
    const yearEl=document.getElementById('year'); if(yearEl) yearEl.textContent=new Date().getFullYear();
    initTheme();
    initPaletteUI();
    const timeline=document.getElementById('timeline'); if(!timeline) return;
    try{
      const res=await fetch('posts/index.json',{cache:'no-cache'}); if(!res.ok) throw new Error('无法加载文章列表');
      const posts=await res.json(); posts.sort((a,b)=> new Date(b.date)-new Date(a.date)); state.posts=posts; state.filtered=posts;
      renderTagChips(buildAllTags(posts));
      const input=document.getElementById('search'); if(input){ input.addEventListener('input', debounce((e)=>{state.search=e.target.value||''; applyFilters();}, 120)); }
      renderAll();
    }catch(err){ console.error(err); timeline.innerHTML=`<p style="color:#fca5a5">加载失败：${err.message}</p>`; }
  }

window.addEventListener('DOMContentLoaded', loadTimeline);

  function runRebuildIndex(){
    const btn = document.getElementById('rebuild-index');
    if(!btn) return;
    btn.addEventListener('click', async ()=>{
      btn.disabled = true; btn.textContent = '更新中...';
      try {
        // 在浏览器中无法直接运行本地脚本，这里给出提示与命令复制
        alert('请在终端运行：\n\npython scripts/generate_index.py\n\n完成后刷新页面。');
      } finally {
        btn.disabled = false; btn.textContent = '更新索引';
      }
    });
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    runRebuildIndex();
  });