// ==================== GLOBAL STATE ====================
const MOVIES_KEY = 'treehole_movies_v2';
let currentTheme = 'ocean';
let currentPage = 'home';
let currentRating = 0;
let mTags = [];
let uploadedCoverData = '';
let watchFilter = '全部';
let homeTypeFilter = '全部';
let watchTypeFilter = '全部';
let archivePickerMode = 'journal';
let currentJournalMovieId = null;
let currentJournalPageIdx = 0;
let selectedElements = new Set();
let journalPaperMode = (()=>{try{return localStorage.getItem('treehole-paper-mode')||'lined';}catch(e){return'lined';}})();
let journalHistory = [];
let journalHistoryIndex = -1;
const JOURNAL_HISTORY_MAX = 50;

// Review & Chat state
const REVIEWS_CHAT_KEY = 'treehole_reviews_chat_v1';
let editingReviewId = null;
let editingReviewMovieId = null;
let reviewRatingVal = 0;
let aiChatReviewId = null;
let aiChatMovieId = null;
let aiChatMessages = [];
let aiChatLoading = false;

// ==================== UTILS ====================
function esc(s){return(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function showToast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2500);}
function nowISO(){return new Date().toISOString();}
function fmtDate(d){if(!d)return'';const x=new Date(d);return x.getFullYear()+'.'+String(x.getMonth()+1).padStart(2,'0')+'.'+String(x.getDate()).padStart(2,'0');}
function genId(){return Date.now().toString(36)+Math.random().toString(36).slice(2,8);}
function statusLabel(m){if(!m)return'';if(m.type==='书籍'){if(m.status==='已看')return'已读';if(m.status==='在看')return'在读';if(m.status==='想看')return'想读';}return m.status;}
function progressPercent(m){if(!m||m.type!=='书籍')return 0;if(m.pageCount>0)return Math.min(100,Math.round((m.currentPage/m.pageCount)*100));if(m.chapterCount>0)return Math.min(100,Math.round((m.currentChapter/m.chapterCount)*100));return 0;}
function openModal(id){document.getElementById(id).classList.add('show');}
function closeModal(id){document.getElementById(id).classList.remove('show');}

// ==================== MOBILE SAVE HELPER ====================
function saveFile(blob, filename) {
  // Try Web Share API first (mobile friendly)
  if (navigator.share && navigator.canShare) {
    const file = new File([blob], filename, { type: blob.type || 'image/png' });
    if (navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: filename }).then(() => {
        showToast('已分享/保存 ✓');
      }).catch(() => {
        // User cancelled or not supported, fallback to download
        fallbackDownload(blob, filename);
      });
      return;
    }
  }
  fallbackDownload(blob, filename);
}
function fallbackDownload(blob, filename) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(function() {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 200);
  showToast('文件已保存 ✓ (长按图片可保存到相册)');
}
// Canvas to blob + save helper
function saveCanvas(canvas, filename) {
  if (canvas.toBlob) {
    canvas.toBlob(function(blob) {
      saveFile(blob, filename);
    }, 'image/png');
  } else {
    // Fallback for older browsers
    var dataUrl = canvas.toDataURL('image/png');
    var a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
    showToast('图片已生成 ✓');
  }
}

// ==================== THEME ====================
let bgParticles=[],bgCtx,bgW,bgH,bgAnimId;
function switchTheme(t){
  currentTheme=t;document.body.setAttribute('data-theme',t);
  document.querySelectorAll('.theme-dot').forEach(d=>d.classList.toggle('active',d.dataset.theme===t));
  localStorage.setItem('treehole-theme',t);initBgCanvas();
}
function loadTheme(){switchTheme(localStorage.getItem('treehole-theme')||'ocean');}
function initBgCanvas(){
  const c=document.getElementById('bgCanvas');if(!c)return;
  bgCtx=c.getContext('2d');function r(){bgW=c.width=window.innerWidth;bgH=c.height=window.innerHeight;}r();
  window.addEventListener('resize',r);if(bgAnimId)cancelAnimationFrame(bgAnimId);
  bgParticles=[];const count=currentTheme==='starry'?100:currentTheme==='spring'?45:currentTheme==='rain'?60:currentTheme==='polar'?40:currentTheme==='autumn'?25:currentTheme==='forest'?20:12;
  for(let i=0;i<count;i++)bgParticles.push(createBg());
  drawBg();
}
function createBg(){
  const th=currentTheme;
  if(th==='starry')return{x:Math.random()*bgW,y:Math.random()*bgH,r:Math.random()*2+0.5,vx:(Math.random()-0.5)*0.15,vy:(Math.random()-0.5)*0.15,alpha:Math.random(),pulse:Math.random()*0.015+0.005};
  if(th==='spring')return{x:Math.random()*bgW,y:-20-Math.random()*100,r:3+Math.random()*4,vx:(Math.random()-0.5)*0.6,vy:0.4+Math.random()*0.5,rot:Math.random()*360,rs:(Math.random()-0.5)*2,color:`hsl(${330+Math.random()*40},${65+Math.random()*30}%,${78+Math.random()*15}%)`};
  if(th==='rain')return{x:Math.random()*bgW,y:-Math.random()*bgH,vy:2+Math.random()*5,len:8+Math.random()*20,alpha:0.15+Math.random()*0.25};
  if(th==='forest')return{x:Math.random()*bgW,y:Math.random()*bgH,r:4+Math.random()*8,vx:(Math.random()-0.5)*0.2,vy:(Math.random()-0.5)*0.1,alpha:0.06+Math.random()*0.08,green:120+Math.random()*40};
  if(th==='polar')return{x:Math.random()*bgW,y:Math.random()*bgH,r:2+Math.random()*3,vx:Math.random()*0.4-0.2,vy:Math.random()*0.2-0.1,alpha:0.2+Math.random()*0.3};
  if(th==='autumn')return{x:Math.random()*bgW,y:-30-Math.random()*100,r:3+Math.random()*6,vx:(Math.random()-0.5)*0.8,vy:0.3+Math.random()*0.6,rot:Math.random()*360,rs:(Math.random()-0.5)*3,color:`hsl(${15+Math.random()*40},${70+Math.random()*30}%,${55+Math.random()*25}%)`};
  return{x:Math.random()*bgW,y:Math.random()*bgH,vx:(Math.random()-0.5)*0.5,vy:(Math.random()-0.5)*0.25,size:5+Math.random()*14,hue:175+Math.random()*30,tail:0,ts:2+Math.random()*3};
}
function drawBg(){
  bgCtx.clearRect(0,0,bgW,bgH);const th=currentTheme;
  bgParticles.forEach(p=>{
    if(th==='starry'){p.alpha+=p.pulse;if(p.alpha>1||p.alpha<0.2)p.pulse*=-1;p.x+=p.vx;p.y+=p.vy;if(p.x<0)p.x=bgW;if(p.x>bgW)p.x=0;if(p.y<0)p.y=bgH;if(p.y>bgH)p.y=0;bgCtx.beginPath();bgCtx.arc(p.x,p.y,p.r,0,Math.PI*2);bgCtx.fillStyle=`rgba(200,180,255,${p.alpha})`;bgCtx.fill();}
    else if(th==='spring'){p.x+=p.vx;p.y+=p.vy;p.rot+=p.rs;if(p.y>bgH+30){p.y=-30;p.x=Math.random()*bgW;}bgCtx.save();bgCtx.translate(p.x,p.y);bgCtx.rotate(p.rot*Math.PI/180);bgCtx.fillStyle=p.color;bgCtx.beginPath();bgCtx.ellipse(0,0,p.r,p.r*0.55,0,0,Math.PI*2);bgCtx.fill();bgCtx.restore();}
    else if(th==='rain'){p.y+=p.vy;if(p.y>bgH+10){p.y=-10;p.x=Math.random()*bgW;}bgCtx.strokeStyle=`rgba(120,160,220,${p.alpha})`;bgCtx.lineWidth=1;bgCtx.beginPath();bgCtx.moveTo(p.x,p.y);bgCtx.lineTo(p.x-2,p.y-p.len);bgCtx.stroke();}
    else if(th==='forest'){p.x+=p.vx;p.y+=p.vy;if(p.x<-30)p.x=bgW+30;if(p.x>bgW+30)p.x=-30;if(p.y<-30)p.y=bgH+30;if(p.y>bgH+30)p.y=-30;const g=bgCtx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r);g.addColorStop(0,`hsla(${p.green},60%,45%,${p.alpha})`);g.addColorStop(1,`hsla(${p.green},60%,45%,0)`);bgCtx.fillStyle=g;bgCtx.beginPath();bgCtx.arc(p.x,p.y,p.r,0,Math.PI*2);bgCtx.fill();}
    else if(th==='polar'){p.x+=p.vx;p.y+=p.vy;if(p.x<-20)p.x=bgW+20;if(p.x>bgW+20)p.x=-20;if(p.y<-20)p.y=bgH+20;if(p.y>bgH+20)p.y=-20;bgCtx.beginPath();bgCtx.arc(p.x,p.y,p.r,0,Math.PI*2);bgCtx.fillStyle=`rgba(255,255,255,${p.alpha})`;bgCtx.fill();}
    else if(th==='autumn'){p.x+=p.vx;p.y+=p.vy;p.rot+=p.rs;if(p.y>bgH+40){p.y=-40;p.x=Math.random()*bgW;}bgCtx.save();bgCtx.translate(p.x,p.y);bgCtx.rotate(p.rot*Math.PI/180);bgCtx.fillStyle=p.color;bgCtx.beginPath();bgCtx.ellipse(0,0,p.r,p.r*0.7,0,0,Math.PI*2);bgCtx.fill();bgCtx.restore();}
    else{p.x+=p.vx;p.y+=p.vy;p.tail+=p.ts*0.1;if(p.x<-30)p.x=bgW+30;if(p.x>bgW+30)p.x=-30;if(p.y<-30)p.y=bgH+30;if(p.y>bgH+30)p.y=-30;if(Math.random()<0.005){p.vx+=(Math.random()-0.5)*0.4;p.vy+=(Math.random()-0.5)*0.2;}const angle=Math.atan2(p.vy,p.vx);bgCtx.save();bgCtx.translate(p.x,p.y);bgCtx.rotate(angle);bgCtx.fillStyle=`hsla(${p.hue},65%,55%,0.5)`;bgCtx.beginPath();bgCtx.ellipse(0,0,p.size,p.size*0.45,0,0,Math.PI*2);bgCtx.fill();const tw=Math.sin(p.tail)*p.size*0.5;bgCtx.beginPath();bgCtx.moveTo(-p.size*0.8,0);bgCtx.lineTo(-p.size*1.6,tw);bgCtx.lineTo(-p.size*1.6,-tw);bgCtx.closePath();bgCtx.fill();bgCtx.restore();}
  });
  bgAnimId=requestAnimationFrame(drawBg);
}

// ==================== DATA ====================
function loadMovies(){try{return JSON.parse(localStorage.getItem(MOVIES_KEY))||[];}catch(e){return[];}}
function saveMovies(m){localStorage.setItem(MOVIES_KEY,JSON.stringify(m));}
function getMovie(id){return loadMovies().find(m=>m.id===id);}
function updateMovie(id,updates){const ms=loadMovies();const i=ms.findIndex(m=>m.id===id);if(i>=0){ms[i]={...ms[i],...updates};saveMovies(ms);return ms[i];}return null;}
function deleteMovie(id){let ms=loadMovies();ms=ms.filter(m=>m.id!==id);saveMovies(ms);}
function ensureMovie(id){let ms=loadMovies();let m=ms.find(x=>x.id===id);if(!m){m={id,title:'新作品',type:'电影',watchDate:'',rating:0,status:'已看',cover:'',review:'',tags:[],pages:[{id:genId(),elements:[]}],quotes:[],createdAt:nowISO(),author:'',publisher:'',publishYear:'',pageCount:0,currentPage:0,chapterCount:0,currentChapter:0,txtContent:''};ms.push(m);saveMovies(ms);}return m;}

// ==================== NAVIGATION ====================
function toggleSidebar(){
  const nav = document.getElementById('sideNav');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (nav.classList.contains('open')) {
    closeSidebar();
  } else {
    nav.classList.add('open');
    if (backdrop) backdrop.classList.add('show');
  }
}
function closeSidebar(){
  document.getElementById('sideNav').classList.remove('open');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (backdrop) backdrop.classList.remove('show');
}
function showPage(p){
  currentPage=p;document.querySelectorAll('.page-section').forEach(s=>s.classList.remove('active'));
  document.getElementById('page-'+p).classList.add('active');
  document.querySelectorAll('.nav-link').forEach(l=>l.classList.toggle('active',l.dataset.page===p));
  // Close sidebar on mobile after navigation
  closeSidebar();
  if(p==='home')renderHome();if(p==='journal')renderJournalList();
  if(p==='shelf')renderShelf();if(p==='bookshelf')renderBookshelf();if(p==='checklist')renderChecklist();
  if(p==='watchlist')renderWatchlist();if(p==='quotations')renderQuotations();
  if(p==='settings')renderSettings();
  if(p==='search'){checkMainProxy();}
  if(p==='archive')renderArchive();
  if(p==='reviews')renderReviews();
  if(p==='readingReport')renderReadingReport();
}

// ==================== TOP TYPE FILTER ====================
function setTopTypeFilter(f, btn) {
  homeTypeFilter = f;
  // Update top bar buttons
  document.querySelectorAll('.top-filter-bar button[data-type]').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  // Re-render current page content if on home
  if (currentPage === 'home') renderHome();
}

// Keep setHomeTypeFilter for backward compatibility, but sync with top bar
function setHomeTypeFilter(f, btn) {
  setTopTypeFilter(f, btn);
}
function renderHome(){
  const ms=loadMovies();
  const totalMovies=ms.filter(m=>m.type==='电影').length;
  const totalTV=ms.filter(m=>m.type==='电视剧').length;
  const totalAnime=ms.filter(m=>m.type==='动漫').length;
  const totalBooks=ms.filter(m=>m.type==='书籍').length;
  const watched=ms.filter(m=>m.status==='已看').length;
  const watching=ms.filter(m=>m.status==='在看').length;
  const want=ms.filter(m=>m.status==='想看').length;
  const totalQuotes=ms.reduce((s,m)=>s+(m.quotes||[]).length,0);
  const avgRating=ms.filter(m=>m.rating>0).length?(ms.reduce((s,m)=>s+(m.rating||0),0)/ms.filter(m=>m.rating>0).length).toFixed(1):'0';
  document.getElementById('homeStats').innerHTML=`
    <div class="stat-card" onclick="showPage('shelf')"><span class="stat-icon">📚</span><div class="stat-num">${ms.length}</div><div class="stat-label">作品总数</div><div class="stat-sub">🎬${totalMovies} 📺${totalTV} 🎨${totalAnime} 📖${totalBooks}</div></div>
    <div class="stat-card"><span class="stat-icon">✅</span><div class="stat-num">${watched}</div><div class="stat-label">已看</div><div class="stat-sub">平均评分 ${avgRating}★</div></div>
    <div class="stat-card"><span class="stat-icon">▶</span><div class="stat-num">${watching}</div><div class="stat-label">在看</div><div class="stat-sub">进行中</div></div>
    <div class="stat-card"><span class="stat-icon">📌</span><div class="stat-num">${want}</div><div class="stat-label">想看</div><div class="stat-sub">待观影清单</div></div>
    <div class="stat-card"><span class="stat-icon">💬</span><div class="stat-num">${totalQuotes}</div><div class="stat-label">摘录</div><div class="stat-sub">经典语录收集</div></div>
  `;
  renderTimeline(ms);
}
function renderTimeline(ms){
  const d=document.getElementById('homeTimeline');
  let filtered=homeTypeFilter==='全部'?ms:ms.filter(m=>m.type===homeTypeFilter);
  filtered=filtered.slice().sort((a,b)=>new Date(b.watchDate||0)-new Date(a.watchDate||0));
  if(!filtered.length){d.innerHTML='<div class="timeline-empty"><span style="font-size:36px;display:block;margin-bottom:8px;">📋</span><p>暂无记录，点击「新增作品」开始吧</p></div>';return;}
  d.innerHTML='<div class="timeline">'+filtered.map((m,i)=>{
    const sb=m.status==='想看'?'want':m.status==='在看'?'watching':'watched';
    const stIcons={want:'📌',watching:'🔵',watched:'🟢'};
    const st=(stIcons[sb]||'')+' '+m.status;
    const stars='★'.repeat(m.rating||0)+'☆'.repeat(5-(m.rating||0));
    const tagsHtml=(m.tags||[]).length?`<div class="ti-tags">${m.tags.map(t=>`<span class="ti-tag" onclick="event.stopPropagation();filterByTag('${esc(t)}')">${esc(t)}</span>`).join('')}</div>`:'';
    return `<div class="timeline-item" style="animation-delay:${i*0.05}s" onclick="openDetail('${m.id}')">
      <div class="ti-date">${fmtDate(m.watchDate)}</div>
      <div class="ti-poster">${m.cover?`<img src="${esc(m.cover)}" onerror="this.style.display='none';this.parentElement.innerHTML='🎬'" alt="" style="width:100%;height:100%;object-fit:cover;">`:'🎬'}</div>
      <div class="ti-body">
        <div class="ti-title">${esc(m.title)}</div>
        <div class="ti-meta">${esc(m.type)} · <span class="ti-status ${sb}">${st}</span></div>
        <div class="ti-stars">${stars}</div>
        ${tagsHtml}
        ${m.review?`<div class="ti-review">"${esc(m.review)}"</div>`:''}
        <div class="ti-actions">
          <button onclick="event.stopPropagation();openDetail('${m.id}')">📋 详情</button>
          <button onclick="event.stopPropagation();openJournalForMovie('${m.id}')">📒 手帐</button>
        </div>
      </div>
    </div>`;
  }).join('')+'</div>';
}

// ==================== GLOBAL SEARCH ====================
function globalSearch(){
  const q=document.getElementById('globalSearchInput').value.trim().toLowerCase();
  const ms=loadMovies();
  if(!q){renderTimeline(ms);return;}
  const filtered=ms.filter(m=>{
    return (m.title||'').toLowerCase().includes(q)||
           (m.review||'').toLowerCase().includes(q)||
           (m.tags||[]).some(t=>t.toLowerCase().includes(q))||
           (m.type||'').toLowerCase().includes(q);
  });
  renderTimeline(filtered);
  if(filtered.length===0)showToast('没有搜索到匹配作品');
}
function toggleAdvSearch(){
  const el=document.getElementById('advSearchOverlay');
  el.style.display=el.style.display==='none'?'block':'none';
  doAdvSearch();
}
function doAdvSearch(){
  const el=document.getElementById('advSearchOverlay');
  if(el.style.display==='none')return;
  const ms=loadMovies();
  let q=document.getElementById('globalSearchInput').value.trim().toLowerCase();
  const dateFrom=document.getElementById('advSearchDateFrom').value;
  const dateTo=document.getElementById('advSearchDateTo').value;
  const minRating=parseInt(document.getElementById('advSearchRating').value)||0;
  const status=document.getElementById('advSearchStatus').value;
  let filtered=ms.filter(m=>{
    if(dateFrom&&(!m.watchDate||m.watchDate<dateFrom))return false;
    if(dateTo&&(!m.watchDate||m.watchDate>dateTo))return false;
    if(minRating>0&&(m.rating||0)<minRating)return false;
    if(status!=='全部'&&m.status!==status)return false;
    if(q&&!(m.title||'').toLowerCase().includes(q)&&
           !(m.review||'').toLowerCase().includes(q)&&
           !(m.tags||[]).some(t=>t.toLowerCase().includes(q))&&
           !(m.type||'').toLowerCase().includes(q))return false;
    return true;
  });
  renderTimeline(filtered);
}
function clearAdvSearch(){
  document.getElementById('advSearchDateFrom').value='';
  document.getElementById('advSearchDateTo').value='';
  document.getElementById('advSearchRating').value='0';
  document.getElementById('advSearchStatus').value='全部';
  document.getElementById('globalSearchInput').value='';
  renderHome();
}

function makeMovieCard(m){
  const sb=m.status==='想看'?'want':m.status==='在看'?'watching':'watched';
  const stIcons={want:'📌',watching:'🔵',watched:'🟢'};
  const sLabel=statusLabel(m);
  const sIcon=stIcons[sb]||'🟢';
  const st=sIcon+' '+sLabel;
  const stars='★'.repeat(m.rating||0)+'☆'.repeat(5-(m.rating||0));
  const tagsHtml=(m.tags||[]).length?`<div class="mc-tags">${m.tags.map(t=>`<span class="mc-tag" onclick="event.stopPropagation();filterByTag('${esc(t)}')">${esc(t)}</span>`).join('')}</div>`:'';
  // Book progress bar
  var progressHtml='';
  if(m.type==='书籍'&&(m.pageCount>0||m.chapterCount>0)){
    const pct=progressPercent(m);
    const detail=m.pageCount>0?`${m.currentPage||0} / ${m.pageCount} 页`:(m.chapterCount>0?`第${m.currentChapter||0} / ${m.chapterCount} 章`:''); 
    progressHtml=`<div class="mc-progress"><div class="mc-progress-bar"><div class="mc-progress-fill" style="width:${pct}%;"></div></div><div class="mc-progress-text">${detail} · ${pct}%</div></div>`;
  }
  // Book author info
  var authorHtml='';
  if(m.type==='书籍'&&m.author)authorHtml=`<div class="mc-meta" style="color:var(--accent);font-size:0.72rem;">✍ ${esc(m.author)}</div>`;
  return `<div class="movie-card" onclick="${m.type==='书籍'?'openBookActions(\''+m.id+'\')':'openJournalForMovie(\''+m.id+'\')'}">
    <div class="mc-poster">${m.cover?`<img src="${esc(m.cover)}" onerror="this.parentElement.innerHTML='🎬'">`:'🎬'}</div>
    <div class="mc-body">
      <div class="mc-title">${esc(m.title)}</div>
      ${authorHtml}
      <div class="mc-meta">${esc(m.type)} · ${fmtDate(m.watchDate)}</div>
      <div style="color:var(--star-color);font-size:0.78rem;">${stars}</div>
      <div class="mc-status ${sb}">${st}</div>
      ${progressHtml}
      ${tagsHtml}
      <div class="mc-actions">
        <button class="btn sm" onclick="event.stopPropagation();openEditMovie('${m.id}')">编辑</button>
        <button class="btn sm" onclick="event.stopPropagation();${m.type==='书籍'?'openBookActions(\''+m.id+'\')':'openJournalForMovie(\''+m.id+'\')'}">${m.type==='书籍'?'阅读':'手帐'}</button>
      </div>
    </div>
  </div>`;
}

// ==================== DETAIL MODAL ====================
function openDetail(mid){
  const m=getMovie(mid);if(!m){showToast('作品不存在');return;}
  const sb=m.status==='想看'?'want':m.status==='在看'?'watching':'watched';
  const stIcons={want:'📌',watching:'🔵',watched:'🟢'};
  const stLabel=statusLabel(m);
  const st=(stIcons[sb]||'')+' '+stLabel;
  const stars='★'.repeat(m.rating||0)+'☆'.repeat(5-(m.rating||0));
  const defaultIcon=m.type==='书籍'?'📖':'🎬';
  // Build book-specific info block
  let bookInfoHtml='';
  if(m.type==='书籍'){
    let bookRows=[];
    if(m.author) bookRows.push(`<span class="di-book-label">✍ 作者</span><span>${esc(m.author)}</span>`);
    if(m.publisher||m.publishYear){
      const pubInfo=[m.publisher,m.publishYear].filter(Boolean).join(' · ');
      bookRows.push(`<span class="di-book-label">📚 出版</span><span>${esc(pubInfo)}</span>`);
    }
    // Progress
    const pct=progressPercent(m);
    if(m.pageCount>0||m.chapterCount>0){
      const progText=m.pageCount>0
        ? `${m.currentPage||0} / ${m.pageCount} 页 · ${pct}%`
        : `第${m.currentChapter||0} / ${m.chapterCount} 章 · ${pct}%`;
      bookInfoHtml+=`<div class="di-book-row">${bookRows.join('')}</div>`;
      bookInfoHtml+=`<div class="di-book-progress">
        <div class="di-book-progress-bar"><div class="di-book-progress-fill" style="width:${pct}%;"></div></div>
        <div class="di-book-progress-text">📖 进度：${progText}</div>
      </div>`;
    }else if(bookRows.length){
      bookInfoHtml+=`<div class="di-book-row">${bookRows.join('')}</div>`;
    }
    if(bookInfoHtml) bookInfoHtml=`<div class="di-book-info">${bookInfoHtml}</div>`;
  }
  const card=document.getElementById('detailCard');
  card.innerHTML=`
    <div class="detail-cover-area" style="background:var(--tag-bg);">
      ${m.cover?`<img src="${esc(m.cover)}" onerror="this.parentElement.innerHTML='<span style=font-size:4rem>${defaultIcon}</span>'">`:`<span style="font-size:4rem;">${defaultIcon}</span>`}
      <div class="detail-gradient"></div>
      <div class="detail-type-badge">${esc(m.type)}</div>
      <button class="detail-close-btn" onclick="closeDetail()">✕</button>
    </div>
    <div class="detail-info-area">
      <div class="di-header">
        <div class="di-title">${esc(m.title)}</div>
        <div class="di-rating">${stars}</div>
      </div>
      <div class="di-meta-row">
        <div class="di-meta-item">📅 ${fmtDate(m.watchDate)}</div>
        <div class="di-meta-item"><span class="di-status ${sb}">${st}</span></div>
        ${m.type?`<div class="di-meta-item">🏷 ${esc(m.type)}</div>`:''}
      </div>
      ${bookInfoHtml}
      ${(m.tags||[]).length?`<div class="di-section"><div class="di-section-label">标签</div><div class="di-tags">${m.tags.map(t=>`<span class="di-tag">${esc(t)}</span>`).join('')}</div></div>`:''}
      ${m.review?`<div class="di-section"><div class="di-section-label">短评</div><div class="di-review">${esc(m.review)}</div></div>`:''}
      ${(m.quotes||[]).length?`<div class="di-section"><div class="di-section-label">摘录 (${m.quotes.length}条)</div><div class="di-review" style="white-space:pre-wrap;">${m.quotes.map(q=>`"${esc(q.content)}"`).join('\n')}</div></div>`:''}
      <div class="di-actions">
        <button onclick="event.stopPropagation();${m.type==='书籍'?`openBookActions('${m.id}')`:`openJournalForMovie('${m.id}')`}">${m.type==='书籍'?'📖 打开阅读':'📒 手帐编辑'}</button>
        <button onclick="event.stopPropagation();openEditMovie('${m.id}');closeDetail()">✏️ 编辑信息</button>
      </div>
    </div>`;
  document.getElementById('detailOverlay').classList.add('show');
  document.getElementById('detailOverlay').addEventListener('click',function(e){if(e.target===this)closeDetail();});
}
function closeDetail(){document.getElementById('detailOverlay').classList.remove('show');}

// ==================== ADD/EDIT MOVIE ====================
let editingMovieId=null;
function openAddMovie(){editingMovieId=null;document.getElementById('movieModalTitle').textContent='新增影片';fillMovieForm();openModal('addMovieModal');}
function openEditMovie(id){editingMovieId=id;document.getElementById('movieModalTitle').textContent='编辑影片';fillMovieForm(getMovie(id));openModal('addMovieModal');}
function openAddBook(){editingMovieId=null;document.getElementById('mType').value='书籍';onTypeChange();document.getElementById('movieModalTitle').textContent='新增书籍';fillMovieForm();openModal('addMovieModal');}
function fillMovieForm(m){
  document.getElementById('mTitle').value=m?m.title||'':'';
  document.getElementById('mType').value=m?m.type||'电影':'电影';
  // Call onTypeChange first to set up the correct status options
  onTypeChange();
  document.getElementById('mDate').value=m?m.watchDate||'':'';
  // Map book statuses for display
  var st=m?m.status||'已看':'已看';
  if(m&&m.type==='书籍'){if(st==='已看')st='已读';else if(st==='在看')st='在读';}
  document.getElementById('mStatus').value=st;
  document.getElementById('mCover').value=m?m.cover||'':'';
  document.getElementById('mReview').value=m?m.review||'':'';
  currentRating=m?m.rating||0:0;renderMovieRating();
  mTags=m?[...(m.tags||[])]:[];renderMTags();
  uploadedCoverData='';document.getElementById('mCoverFile').value='';
  uploadedTxtContent='';document.getElementById('mTxtFile').value='';document.getElementById('mTxtFileName').textContent='';
  // Book fields
  document.getElementById('mAuthor').value=m?m.author||'':'';
  document.getElementById('mPublisher').value=m?m.publisher||'':'';
  document.getElementById('mPublishYear').value=m?m.publishYear||'':'';
  document.getElementById('mPageCount').value=m?m.pageCount||'':'';
  document.getElementById('mCurrentPage').value=m?m.currentPage||'':'';
  document.getElementById('mChapterCount').value=m?m.chapterCount||'':'';
  document.getElementById('mCurrentChapter').value=m?m.currentChapter||'':'';
  const prev=document.getElementById('mCoverPreview');
  if(m&&m.cover){prev.src=m.cover;prev.style.display='block';}else{prev.style.display='none';}
  if(m&&m.txtContent){uploadedTxtContent=m.txtContent;document.getElementById('mTxtFileName').textContent='已上传 .txt';}
}
function renderMovieRating(){
  document.getElementById('mRating').innerHTML=[1,2,3,4,5].map(i=>`<span onclick="currentRating=${i};renderMovieRating()" style="color:${i<=currentRating?'var(--star-color)':'var(--border)'}">${i<=currentRating?'★':'☆'}</span>`).join('');
}
function handleMTag(e){if(e.key==='Enter'){const v=e.target.value.trim();if(v&&!mTags.includes(v)){mTags.push(v);renderMTags();e.target.value='';}}}
function renderMTags(){
  const area=document.getElementById('mTagArea');
  area.innerHTML=mTags.map((t,i)=>`<span class="tag-pill">${esc(t)}<span class="x" onclick="mTags.splice(${i},1);renderMTags()">×</span></span>`).join('')+'<input id="mTagInput" placeholder="输入标签按回车..." onkeydown="handleMTag(event)">';
}
function handleCoverUpload(e){
  const f=e.target.files[0];if(!f)return;
  const r=new FileReader();r.onload=ev=>{uploadedCoverData=ev.target.result;document.getElementById('mCoverPreview').src=ev.target.result;document.getElementById('mCoverPreview').style.display='block';};r.readAsDataURL(f);
}
var uploadedTxtContent='';
function onTypeChange(){
  const type=document.getElementById('mType').value;
  const bf=document.getElementById('bookFields');
  const mL=document.getElementById('movieModalTitle');
  const titleL=document.querySelector('#addMovieModal .form-row .form-group:first-child .form-label');
  if(type==='书籍'){
    bf.style.display='block';
    if(mL)mL.textContent=editingMovieId?'编辑书籍':'新增书籍';
    if(titleL)titleL.textContent='书籍名称';
    document.getElementById('mTitle').placeholder='输入书籍名称';
    document.getElementById('mStatus').innerHTML='<option>已读</option><option>在读</option><option>想读</option>';
  } else {
    bf.style.display='none';
    if(mL)mL.textContent=editingMovieId?'编辑影片':'新增影片';
    if(titleL)titleL.textContent='影片名称';
    document.getElementById('mTitle').placeholder='输入影片名称';
    document.getElementById('mStatus').innerHTML='<option>已看</option><option>想看</option><option>在看</option>';
  }
}
function handleTxtUpload(e){
  const f=e.target.files[0];if(!f)return;
  document.getElementById('mTxtFileName').textContent=f.name;
  const r=new FileReader();
  r.onload=ev=>{
    // Store as base64 for localStorage (limited to ~5MB readable)
    const text=ev.target.result;
    if(text.length>5000000){showToast('文件过大，请上传小于5MB的txt文件');return;}
    uploadedTxtContent=text;
    // Try to estimate page count (assuming ~2000 chars per page)
    const estPages=Math.max(1,Math.ceil(text.length/2000));
    if(!document.getElementById('mPageCount').value){
      document.getElementById('mPageCount').value=estPages;
    }
    showToast('已解析，约'+estPages+'页');
  };
  r.readAsText(f,'UTF-8');
}
function saveMovie(){
  const data={title:document.getElementById('mTitle').value.trim(),type:document.getElementById('mType').value,watchDate:document.getElementById('mDate').value,status:document.getElementById('mStatus').value,cover:uploadedCoverData||document.getElementById('mCover').value.trim(),rating:currentRating,tags:mTags,review:document.getElementById('mReview').value.trim()};
  if(!data.title){showToast('请填写影片名称');return;}
  // Map book statuses to internal format
  if(data.type==='书籍'){
    data.author=document.getElementById('mAuthor').value.trim();
    data.publisher=document.getElementById('mPublisher').value.trim();
    data.publishYear=document.getElementById('mPublishYear').value;
    data.pageCount=parseInt(document.getElementById('mPageCount').value)||0;
    data.currentPage=parseInt(document.getElementById('mCurrentPage').value)||0;
    data.chapterCount=parseInt(document.getElementById('mChapterCount').value)||0;
    data.currentChapter=parseInt(document.getElementById('mCurrentChapter').value)||0;
    if(uploadedTxtContent)data.txtContent=uploadedTxtContent;
    // Map display status back to internal
    if(data.status==='已读')data.status='已看';
    else if(data.status==='在读')data.status='在看';
    else if(data.status==='想读')data.status='想看';
  }
  const ms=loadMovies();
  if(editingMovieId){const i=ms.findIndex(m=>m.id===editingMovieId);if(i>=0){ms[i]={...ms[i],...data};}}else{ms.push({...data,id:genId(),pages:[{id:genId(),elements:[]}],quotes:[],createdAt:nowISO(),author:'',publisher:'',publishYear:'',pageCount:0,currentPage:0,chapterCount:0,currentChapter:0,txtContent:''});}
  saveMovies(ms);closeModal('addMovieModal');showToast('已保存');renderHome();renderJournalList();renderShelf();renderBookshelf();renderWatchlist();}
function deleteMovieWithConfirm(id){if(confirm('确定删除这部作品？')){deleteMovie(id);showToast('已删除');renderHome();renderJournalList();renderShelf();renderBookshelf();renderChecklist();renderWatchlist();renderQuotations();}}

// ==================== BOOK ACTIONS & READER ====================
var currentBookActionsId=null;
function openBookActions(mid){
  currentBookActionsId=mid;
  var m=getMovie(mid);if(!m)return;
  document.getElementById('bookActionsTitle').textContent='📖 '+esc(m.title);
  var btnReader=document.getElementById('btnOpenReader');
  if(m.txtContent){
    btnReader.style.display='';
    btnReader.textContent='📖 打开阅读器 ('+statusLabel(m)+')';
  }else{
    btnReader.textContent='📄 上传电子书（暂无文件）';
  }
  document.getElementById('bookActionsOverlay').classList.add('show');
}
function closeBookActions(){
  document.getElementById('bookActionsOverlay').classList.remove('show');
  currentBookActionsId=null;
}

// Reader state
var readerState={mid:null,fontSize:16,lineHeight:1.8,bg:'#faf8f0',nightMode:false};

function openBookReader(mid){
  var m=getMovie(mid);if(!m){showToast('书籍不存在');return;}
  readerState.mid=mid;
  document.getElementById('brTitle').textContent='📖 '+esc(m.title);
  var contentEl=document.getElementById('brContent');
  var emptyEl=document.getElementById('brEmpty');
  if(!m.txtContent){
    emptyEl.style.display='block';contentEl.textContent='';
  }else{
    emptyEl.style.display='none';
    contentEl.textContent=m.txtContent;
  }
  // Apply saved reader settings
  readerState.fontSize=16;readerState.lineHeight=1.8;readerState.bg='#faf8f0';readerState.nightMode=false;
  applyReaderStyle();
  // Set progress bar
  var pct=progressPercent(m);
  document.getElementById('brProgressFill').style.width=pct+'%';
  // Restore scroll position (approximate)
  setTimeout(()=>{
    if(m.pageCount>0&&m.currentPage>0){
      var ratio=m.currentPage/m.pageCount;
      contentEl.scrollTop=ratio*contentEl.scrollHeight;
    }
  },100);
  openModal('bookReaderOverlay');
}

function closeBookReader(){
  updateReaderProgress();
  closeModal('bookReaderOverlay');
  readerState.mid=null;
}

function applyReaderStyle(){
  var c=document.getElementById('brContent');
  c.style.fontSize=readerState.fontSize+'px';
  c.style.lineHeight=readerState.lineHeight;
  c.style.background=readerState.nightMode?'#1a1a22':readerState.bg;
  c.classList.toggle('night-mode',readerState.nightMode);
  document.getElementById('brFontSizeLabel').textContent=readerState.fontSize+'px';
  document.getElementById('brLineHeightLabel').textContent=readerState.lineHeight.toFixed(1);
  document.getElementById('btnReaderNight').textContent=readerState.nightMode?'☀ 日间':'🌙 夜间';
}

function changeReaderFontSize(d){
  readerState.fontSize=Math.max(12,Math.min(28,readerState.fontSize+d));
  applyReaderStyle();
}

function changeReaderLineHeight(d){
  readerState.lineHeight=Math.max(1.2,Math.min(3.0,parseFloat((readerState.lineHeight+d).toFixed(1))));
  applyReaderStyle();
}

function setReaderBg(c){
  readerState.bg=c;readerState.nightMode=(c==='#2a2a32'||c==='#1a1a22');
  applyReaderStyle();
}

function toggleReaderNight(){
  readerState.nightMode=!readerState.nightMode;
  if(readerState.nightMode)readerState.bg='#1a1a22';
  applyReaderStyle();
}

function updateReaderProgress(){
  if(!readerState.mid)return;
  var m=getMovie(readerState.mid);if(!m||!m.txtContent)return;
  var contentEl=document.getElementById('brContent');
  if(!contentEl)return;
  var ratio=contentEl.scrollTop/Math.max(1,contentEl.scrollHeight-contentEl.clientHeight);
  var estPage=Math.min(m.pageCount||1,Math.max(1,Math.round(ratio*(m.pageCount||Math.ceil(m.txtContent.length/2000)))));
  m.currentPage=estPage;
  updateMovie(readerState.mid,{currentPage:estPage});
  // Update progress bar
  var pct=progressPercent(m);
  document.getElementById('brProgressFill').style.width=pct+'%';
  showToast('进度已保存：第 '+estPage+' 页');
  // Refresh journal list to show updated progress
  renderJournalList();
}

// changeStatus already defined elsewhere - removed duplicate
function renderJournalList(){
  const ms=loadMovies();const d=document.getElementById('journalMovieList');
  d.innerHTML=ms.length?ms.map(m=>makeMovieCard(m)).join(''):'<div style="text-align:center;color:var(--text-muted);padding:30px;grid-column:1/-1;">暂无作品，点击按钮添加</div>';
}
function openJournalForMovie(mid){
  const m=getMovie(mid);if(!m){showToast('作品不存在');return;}
  if(!m.pages||!m.pages.length)m=ensureMovie(mid);
  currentJournalMovieId=mid;currentJournalPageIdx=0;selectedElements.clear();
  document.getElementById('journalInfo').textContent=`${m.title} · ${m.type} · ${fmtDate(m.watchDate)}`;
  renderJournalSidebar();renderJournalPage();openModal('journalOverlay');
  applyJournalPaper();resetJournalHistory();
  // Update template buttons based on type
  updateJournalTemplateBtns(m);
}
function updateJournalTemplateBtns(m){
  var container=document.getElementById('journalTemplateBtns');
  if(!container)return;
  if(m&&m.type==='书籍'){
    container.innerHTML=`
      <button onclick="applyJournalTemplate('bookReview')" title="阅读感悟">📝 感悟</button>
      <button onclick="applyJournalTemplate('bookQuote')" title="金句摘录">💬 金句</button>
      <button onclick="applyJournalTemplate('bookPlot')" title="情节梳理">📋 情节</button>
      <button onclick="applyJournalTemplate('bookCharacter')" title="人物分析">👤 人物</button>`;
  }else{
    container.innerHTML=`
      <button onclick="applyJournalTemplate('review')" title="影评模板">📝 影评</button>
      <button onclick="applyJournalTemplate('quote')" title="金句摘录">💬 金句</button>
      <button onclick="applyJournalTemplate('poster')" title="海报">🎬 海报</button>
      <button onclick="applyJournalTemplate('diary')" title="日记">📔 日记</button>`;
  }
}
function applyJournalPaper(){
  const area=document.getElementById('journalPageArea');
  area.classList.remove('paper-lined','paper-grid','paper-solid','paper-none');
  area.classList.add('paper-'+journalPaperMode);
  const btn=document.getElementById('btnPaperMode');
  const labels={lined:'📝 横线纸',grid:'🔲 方格纸',solid:'📄 纯色纸',none:'⬜ 无背景'};
  if(btn)btn.textContent=labels[journalPaperMode]||'📝 横线纸';
}
function cycleJournalPaper(){
  const modes=['lined','grid','solid','none'];
  const i=modes.indexOf(journalPaperMode);
  journalPaperMode=modes[(i+1)%modes.length];
  try{localStorage.setItem('treehole-paper-mode',journalPaperMode);}catch(e){}
  applyJournalPaper();
  showToast('纸张：'+({lined:'横线纸',grid:'方格纸',solid:'纯色纸',none:'无背景'}[journalPaperMode]));
}

// ==================== JOURNAL UNDO / REDO ====================
function saveJournalHistory() {
  const m = getMovie(currentJournalMovieId);
  if (!m) return;
  const page = m.pages[currentJournalPageIdx];
  if (!page) return;
  if (journalHistoryIndex >= 0 && journalHistoryIndex < journalHistory.length) {
    const current = JSON.stringify(journalHistory[journalHistoryIndex]);
    const incoming = JSON.stringify(page.elements);
    if (current === incoming) return; // No change, skip
  }
  const snapshot = JSON.parse(JSON.stringify(page.elements));
  if (journalHistoryIndex < journalHistory.length - 1) {
    journalHistory = journalHistory.slice(0, journalHistoryIndex + 1);
  }
  journalHistory.push(snapshot);
  if (journalHistory.length > JOURNAL_HISTORY_MAX) {
    journalHistory.shift();
  } else {
    journalHistoryIndex = journalHistory.length - 1;
  }
  updateJournalUndoButtons();
}

function undoJournal() {
  if (journalHistoryIndex <= 0) return;
  journalHistoryIndex--;
  restoreJournalState();
}

function redoJournal() {
  if (journalHistoryIndex >= journalHistory.length - 1) return;
  journalHistoryIndex++;
  restoreJournalState();
}

function restoreJournalState() {
  const m = getMovie(currentJournalMovieId);
  if (!m) return;
  const page = m.pages[currentJournalPageIdx];
  if (!page) return;
  page.elements = JSON.parse(JSON.stringify(journalHistory[journalHistoryIndex]));
  updateMovie(currentJournalMovieId, { pages: m.pages });
  selectedElements.clear();
  renderJournalPage();
  updateJournalUndoButtons();
}

function updateJournalUndoButtons() {
  const bu = document.getElementById('btnUndo');
  const br = document.getElementById('btnRedo');
  if (bu) bu.disabled = journalHistoryIndex <= 0;
  if (br) br.disabled = journalHistoryIndex >= journalHistory.length - 1;
}

function resetJournalHistory() {
  journalHistory = [];
  journalHistoryIndex = -1;
  saveJournalHistory();
  updateJournalUndoButtons();
}

// Keyboard shortcut for undo/redo
document.addEventListener('keydown', function(e) {
  if (!currentJournalMovieId) return;
  if (e.ctrlKey && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undoJournal(); }
  if (e.ctrlKey && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redoJournal(); }
});

function renderJournalSidebar(){
  const m=getMovie(currentJournalMovieId);if(!m)return;
  document.getElementById('journalSidebar').innerHTML=(m.pages||[]).map((p,i)=>{
    const elCount=(p.elements||[]).length;
    let preview='';
    const imgs=p.elements.filter(e=>e.type==='image');
    if(imgs.length>0)preview=`<span class="thumb-preview">🖼${imgs.length}</span>`;
    else if(elCount>0)preview=`<span class="thumb-preview">✏️${elCount}</span>`;
    const label=i===0?'封面':('P'+(i+1));
    return `<div class="page-thumb ${i===currentJournalPageIdx?'active':''}" onclick="switchJournalPage(${i})" title="第${i+1}页 (${elCount}个元素)">
      ${preview}
      <span class="thumb-label">${label}</span>
      <span class="thumb-num">${elCount}项</span>
    </div>`;
  }).join('');
}
function switchJournalPage(i){
  const m=getMovie(currentJournalMovieId);if(!m)return;
  if(i>=0&&i<(m.pages||[]).length){currentJournalPageIdx=i;selectedElements.clear();renderJournalSidebar();renderJournalPage();resetJournalHistory();}
}
function addJournalPage(){
  const m=getMovie(currentJournalMovieId);if(!m)return;
  m.pages.push({id:genId(),elements:[]});updateMovie(currentJournalMovieId,{pages:m.pages});
  currentJournalPageIdx=m.pages.length-1;selectedElements.clear();renderJournalSidebar();renderJournalPage();showToast('已添加新页面');
}
function duplicateJournalPage(){
  const m=getMovie(currentJournalMovieId);if(!m)return;
  const src=m.pages[currentJournalPageIdx];if(!src)return;
  const dup={id:genId(),elements:src.elements.map(e=>({...e,id:genId(),y:e.y+20,x:e.x+20}))};
  m.pages.splice(currentJournalPageIdx+1,0,dup);
  updateMovie(currentJournalMovieId,{pages:m.pages});
  currentJournalPageIdx++;selectedElements.clear();renderJournalSidebar();renderJournalPage();showToast('已复制页面');
}
function clearJournalPage(){
  if(!confirm('确定清除当前页面所有内容？'))return;
  const m=getMovie(currentJournalMovieId);if(!m)return;
  saveJournalHistory();
  m.pages[currentJournalPageIdx].elements=[];updateMovie(currentJournalMovieId,{pages:m.pages});
  selectedElements.clear();renderJournalPage();showToast('页面已清除');
}

// ==================== JOURNAL: Drawing / Graffiti ====================
let drawMode=false;
let drawBrush='pencil';
let drawColor='#333333';
let drawThickness=3;
let drawStrokes=[]; // [{points:[{x,y}], brush, color, thickness}]
let drawCurrentStroke=null;
let drawIsPainting=false;

function toggleDrawMode(){
  if(drawMode){exitDrawMode(false);return;}
  if(!currentJournalMovieId){showToast('请先打开手帐');return;}
  const m=getMovie(currentJournalMovieId);if(!m){return;}
  drawMode=true;drawStrokes=[];drawCurrentStroke=null;drawIsPainting=false;
  document.getElementById('journalDrawBar').style.display='flex';
  document.getElementById('btnDrawMode').classList.add('active');
  const cv=document.getElementById('drawCanvas');
  cv.style.display='block';cv.classList.add('painting');
  const pa=document.getElementById('journalPageArea');if(pa)pa.classList.add('draw-mode');
  fitDrawCanvas();setBrushType('pencil');
}

function fitDrawCanvas(){
  const cv=document.getElementById('drawCanvas');
  const pa=document.getElementById('journalPageArea');
  if(!cv||!pa)return;
  const r=pa.getBoundingClientRect();
  cv.width=r.width;cv.height=r.height;
  cv.style.width=r.width+'px';cv.style.height=r.height+'px';
}

function setBrushType(type){
  drawBrush=type;
  ['pencil','marker','highlighter','eraser'].forEach(t=>{
    const b=document.getElementById('btn'+t.charAt(0).toUpperCase()+t.slice(1));
    if(b)b.classList.toggle('active',t===type);
  });
  switch(type){
    case 'pencil':drawThickness=2;drawColor='#333333';break;
    case 'marker':drawThickness=5;drawColor='#c05038';break;
    case 'highlighter':drawThickness=12;drawColor='#ffe066';break;
    case 'eraser':drawThickness=15;drawColor='#ffffff';break;
  }
  document.getElementById('drawThickness').value=drawThickness;
  document.getElementById('drawThicknessLabel').textContent=drawThickness+'px';
  document.getElementById('drawColor').value=drawColor;
}

function setDrawColor(v){drawColor=v;}
function setDrawThickness(v){drawThickness=parseInt(v);document.getElementById('drawThicknessLabel').textContent=v+'px';}

// Mouse + Touch event handlers for drawing
(function(){
  function getDrawPoint(e){
    const cv = document.getElementById('drawCanvas');
    if(!cv) return null;
    const rect = cv.getBoundingClientRect();
    const scaleX = cv.width / rect.width;
    const scaleY = cv.height / rect.height;
    const pt = e.touches ? e.touches[0] : e;
    return { x: (pt.clientX - rect.left) * scaleX, y: (pt.clientY - rect.top) * scaleY, cv: cv };
  }
  function drawStart(e){
    if(!drawMode) return;
    const cv = document.getElementById('drawCanvas');
    if(!cv || (e.target !== cv && !e.touches)) return;
    if(e.touches) e.preventDefault();
    drawIsPainting = true;
    const p = getDrawPoint(e); if(!p) return;
    drawCurrentStroke = { points: [{ x: p.x, y: p.y }], brush: drawBrush, color: drawColor, thickness: drawThickness };
    drawDot(p.cv, p.x, p.y);
  }
  function drawMove(e){
    if(!drawMode || !drawIsPainting || !drawCurrentStroke) return;
    if(e.touches) e.preventDefault();
    const p = getDrawPoint(e); if(!p) return;
    drawCurrentStroke.points.push({ x: p.x, y: p.y });
    drawSmoothSegment(p.cv, drawCurrentStroke);
  }
  function drawEnd(){
    if(!drawMode || !drawIsPainting) return;
    drawIsPainting = false;
    if(drawCurrentStroke && drawCurrentStroke.points.length > 0){
      drawStrokes.push(drawCurrentStroke);
    }
    drawCurrentStroke = null;
  }
  document.addEventListener('mousedown', drawStart);
  document.addEventListener('touchstart', drawStart, { passive: false });
  document.addEventListener('mousemove', drawMove);
  document.addEventListener('touchmove', drawMove, { passive: false });
  document.addEventListener('mouseup', drawEnd);
  document.addEventListener('touchend', drawEnd);
  document.addEventListener('touchcancel', drawEnd);
})();

function drawDot(cv,x,y){
  const ctx=cv.getContext('2d');
  const s=drawCurrentStroke||{brush:drawBrush,color:drawColor,thickness:drawThickness};
  ctx.save();
  if(s.brush==='eraser'){
    ctx.globalCompositeOperation='destination-out';
    ctx.beginPath();ctx.arc(x,y,s.thickness/2,0,Math.PI*2);ctx.fill();
  }else if(s.brush==='highlighter'){
    ctx.globalAlpha=0.35;
    ctx.strokeStyle=s.color;ctx.lineWidth=s.thickness;ctx.lineCap='round';ctx.lineJoin='round';
    ctx.beginPath();ctx.arc(x,y,s.thickness/2,0,Math.PI*2);ctx.fillStyle=s.color;ctx.fill();ctx.stroke();
  }else if(s.brush==='marker'){
    ctx.globalAlpha=0.7;
    ctx.strokeStyle=s.color;ctx.lineWidth=s.thickness;ctx.lineCap='round';ctx.lineJoin='round';
    ctx.beginPath();ctx.arc(x,y,s.thickness/2,0,Math.PI*2);ctx.fillStyle=s.color;ctx.fill();ctx.stroke();
  }else{ // pencil
    ctx.strokeStyle=s.color;ctx.lineWidth=s.thickness;ctx.lineCap='round';ctx.lineJoin='round';
    ctx.beginPath();ctx.arc(x,y,s.thickness/2,0,Math.PI*2);ctx.fillStyle=s.color;ctx.fill();ctx.stroke();
  }
  ctx.restore();
}

function drawSmoothSegment(cv,stroke){
  if(stroke.points.length<2)return;
  const ctx=cv.getContext('2d');
  ctx.save();
  const pts=stroke.points;
  const n=pts.length;
  ctx.lineCap='round';ctx.lineJoin='round';
  if(stroke.brush==='eraser'){
    ctx.globalCompositeOperation='destination-out';
    ctx.lineWidth=stroke.thickness;
    ctx.beginPath();ctx.moveTo(pts[n-2].x,pts[n-2].y);ctx.lineTo(pts[n-1].x,pts[n-1].y);ctx.stroke();
  }else if(stroke.brush==='highlighter'){
    ctx.globalAlpha=0.35;
    ctx.strokeStyle=stroke.color;ctx.lineWidth=stroke.thickness;
    ctx.beginPath();ctx.moveTo(pts[n-2].x,pts[n-2].y);ctx.lineTo(pts[n-1].x,pts[n-1].y);ctx.stroke();
  }else if(stroke.brush==='marker'){
    ctx.globalAlpha=0.7;
    ctx.strokeStyle=stroke.color;ctx.lineWidth=stroke.thickness;
    ctx.beginPath();ctx.moveTo(pts[n-2].x,pts[n-2].y);ctx.lineTo(pts[n-1].x,pts[n-1].y);ctx.stroke();
  }else{ // pencil
    ctx.strokeStyle=stroke.color;ctx.lineWidth=stroke.thickness;
    ctx.beginPath();ctx.moveTo(pts[n-2].x,pts[n-2].y);ctx.lineTo(pts[n-1].x,pts[n-1].y);ctx.stroke();
  }
  ctx.restore();
}

function undoDrawStroke(){
  if(!drawMode||drawStrokes.length===0)return;
  drawStrokes.pop();
  renderDrawStrokes();
}

function clearDrawCanvas(){
  if(!drawMode)return;
  drawStrokes=[];
  drawCurrentStroke=null;
  const cv=document.getElementById('drawCanvas');
  if(cv){const ctx=cv.getContext('2d');ctx.clearRect(0,0,cv.width,cv.height);}
}

function renderDrawStrokes(){
  const cv=document.getElementById('drawCanvas');if(!cv)return;
  const ctx=cv.getContext('2d');ctx.clearRect(0,0,cv.width,cv.height);
  for(const s of drawStrokes){renderOneStroke(ctx,s);}
}

function renderOneStroke(ctx,stroke){
  if(stroke.points.length<1)return;
  ctx.save();
  ctx.lineCap='round';ctx.lineJoin='round';
  const pts=stroke.points;
  if(stroke.brush==='eraser'){
    ctx.globalCompositeOperation='destination-out';
    ctx.lineWidth=stroke.thickness;
    ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);
    for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i].x,pts[i].y);
    ctx.stroke();
  }else{
    if(stroke.brush==='highlighter')ctx.globalAlpha=0.35;
    else if(stroke.brush==='marker')ctx.globalAlpha=0.7;
    ctx.strokeStyle=stroke.color;ctx.lineWidth=stroke.thickness;
    ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);
    for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i].x,pts[i].y);
    ctx.stroke();
  }
  ctx.restore();
}

function exitDrawMode(save){
  if(!drawMode)return;
  if(save&&drawStrokes.length>0){
    const cv=document.getElementById('drawCanvas');if(!cv)return;
    // Render strokes to an offscreen canvas with white bg
    const offscreen=document.createElement('canvas');
    offscreen.width=cv.width;offscreen.height=cv.height;
    const octx=offscreen.getContext('2d');
    octx.fillStyle='#ffffff';octx.fillRect(0,0,offscreen.width,offscreen.height);
    for(const s of drawStrokes){renderOneStroke(octx,s);}
    const dataUrl=offscreen.toDataURL('image/png');
    // Find bounding box of actual strokes
    let minX=cv.width,maxX=0,minY=cv.height,maxY=0;
    for(const s of drawStrokes){
      for(const p of s.points){
        if(p.x<minX)minX=p.x;if(p.x>maxX)maxX=p.x;
        if(p.y<minY)minY=p.y;if(p.y>maxY)maxY=p.y;
      }
    }
    if(minX>=maxX||minY>=maxY){minX=0;minY=0;maxX=cv.width;maxY=cv.height;}
    const pad=10;
    minX=Math.max(0,minX-pad);minY=Math.max(0,minY-pad);
    maxX=Math.min(cv.width,maxX+pad);maxY=Math.min(cv.height,maxY+pad);
    const elemW=maxX-minX;const elemH=maxY-minY;
    // Crop to bounding box
    const cropCanvas=document.createElement('canvas');
    cropCanvas.width=elemW;cropCanvas.height=elemH;
    const cctx=cropCanvas.getContext('2d');
    cctx.drawImage(offscreen,minX,minY,elemW,elemH,0,0,elemW,elemH);
    const cropUrl=cropCanvas.toDataURL('image/png');
    const m=getMovie(currentJournalMovieId);if(!m)return;
    const page=m.pages[currentJournalPageIdx];
    saveJournalHistory();
    page.elements.push({
      id:genId(),type:'drawing',src:cropUrl,
      srcCrop:{sx:minX,sy:minY,sw:elemW,sh:elemH},
      x:minX,y:minY,w:Math.max(60,elemW),h:Math.max(60,elemH),
      rotation:0,zIndex:getMaxZ()+1
    });
    updateMovie(currentJournalMovieId,{pages:m.pages});
    showToast('涂鸦已保存');
  }
  // Clean up
  drawMode=false;drawStrokes=[];drawCurrentStroke=null;drawIsPainting=false;
  document.getElementById('journalDrawBar').style.display='none';
  document.getElementById('btnDrawMode').classList.remove('active');
  const cv=document.getElementById('drawCanvas');
  if(cv){const ctx=cv.getContext('2d');ctx.clearRect(0,0,cv.width,cv.height);cv.style.display='none';cv.classList.remove('painting');}
  const pa=document.getElementById('journalPageArea');if(pa)pa.classList.remove('draw-mode');
  // Re-enable element interactions
  document.querySelectorAll('.journal-elem').forEach(de=>{de.style.pointerEvents='auto';de.style.opacity='1';});
  renderJournalPage();
}

// Resize draw canvas when window resizes
window.addEventListener('resize',()=>{if(drawMode)fitDrawCanvas();});

function renderJournalPage(){
  const m=getMovie(currentJournalMovieId);if(!m)return;
  const page=m.pages[currentJournalPageIdx];if(!page)return;
  const el=document.getElementById('journalElements');
  el.innerHTML='';
  (page.elements||[]).forEach(e=>{renderJournalElement(e,el);});
}
function renderJournalElement(e,container){
  const div=document.createElement('div');div.className='journal-elem'+(selectedElements.has(e.id)?' selected':'');
  div.id='elem-'+e.id;div.dataset.eid=e.id;
  div.style.cssText=`left:${e.x}px;top:${e.y}px;width:${e.w}px;height:${e.h}px;transform:rotate(${e.rotation||0}deg);z-index:${e.zIndex||1};`;
  const ctrl=document.createElement('div');ctrl.className='elem-controls';
  ctrl.innerHTML=`<button title="置顶" onclick="event.stopPropagation();bringElemToFront('${e.id}')">⬆</button><button title="置底" onclick="event.stopPropagation();sendElemToBack('${e.id}')">⬇</button><button class="del-btn" title="删除" onclick="event.stopPropagation();deleteJournalElem('${e.id}')">×</button>`;
  div.appendChild(ctrl);
  if(e.type==='image'){const img=document.createElement('img');img.src=e.src;img.draggable=false;applyJournalImageStyles(e,img);div.appendChild(img);}
  else if(e.type==='drawing'){const img=document.createElement('img');img.src=e.src;img.draggable=false;img.style.width='100%';img.style.height='100%';img.style.objectFit='contain';img.style.pointerEvents='none';div.appendChild(img);}
  else if(e.type==='text'){const ta=document.createElement('textarea');ta.className='journal-text-box';
    ta.value=e.content||'';ta.style.cssText=`font-size:${e.fontSize||16}px;font-family:${e.fontFamily||'PingFang SC,Microsoft YaHei,sans-serif'};color:${e.color||'#333'};font-weight:${e.bold?'bold':'normal'};font-style:${e.italic?'italic':'normal'};`;
    ta.addEventListener('input',()=>{updateJournalElem(e.id,{content:ta.value});});
    ta.addEventListener('mousedown',e=>e.stopPropagation());
    ta.addEventListener('touchstart',e=>e.stopPropagation());
    ta.addEventListener('focus',function(){saveJournalHistory();});
    div.appendChild(ta);
  }
  const rh=document.createElement('div');rh.className='elem-resize-handle';div.appendChild(rh);
  const roth=document.createElement('div');roth.className='rot-handle';div.appendChild(roth);
  container.appendChild(div);
  makeElementDraggable(div);
  makeElementResizable(div,rh);
  makeElementRotatable(div,roth);
  div.addEventListener('mousedown',function(ev){ev.stopPropagation();handleElemSelect(ev,e.id);});
  div.addEventListener('touchstart',function(ev){ev.stopPropagation();handleElemSelect(ev,e.id);},{passive:false});
}
function handleElemSelect(ev, eid) {
  if(ev.target.classList.contains('elem-resize-handle')||ev.target.classList.contains('rot-handle')) return;
  if(ev.target.tagName==='TEXTAREA'||ev.target.tagName==='INPUT') return;
  const ctrlOrMeta = ev.ctrlKey || ev.metaKey;
  if(!ev.shiftKey && !ctrlOrMeta) selectedElements.clear();
  if(selectedElements.has(eid)) {
    if(ctrlOrMeta) selectedElements.delete(eid); else selectedElements.clear();
  } else {
    selectedElements.add(eid);
    if(!ctrlOrMeta) { selectedElements.clear(); selectedElements.add(eid); }
  }
  document.querySelectorAll('.journal-elem').forEach(de=>de.classList.toggle('selected',selectedElements.has(de.dataset.eid)));
  setTimeout(updateFmtBar,10);
}
function makeElementDraggable(el){
  let ox,oy,ex,ey,dragging=false;
  function startDrag(e){
    if(e.target.classList.contains('elem-resize-handle')||e.target.classList.contains('rot-handle')||e.target.tagName==='TEXTAREA')return;
    if(e.target.tagName==='INPUT')return;
    saveJournalHistory();
    const pt=e.touches?e.touches[0]:e;
    const rect=el.getBoundingClientRect();ox=pt.clientX-rect.left;oy=pt.clientY-rect.top;ex=parseInt(el.style.left)||0;ey=parseInt(el.style.top)||0;dragging=true;el.style.transition='none';
    if(e.touches)e.preventDefault();
  }
  function moveDrag(e){
    if(!dragging)return;e.preventDefault();
    const pt=e.touches?e.touches[0]:e;
    const nx=ex+pt.clientX-ox-el.parentElement.getBoundingClientRect().left;const ny=ey+pt.clientY-oy-el.parentElement.getBoundingClientRect().top;
    el.style.left=Math.max(0,nx)+'px';el.style.top=Math.max(0,ny)+'px';
  }
  function endDrag(){
    if(!dragging)return;dragging=false;el.style.transition='';
    updateJournalElem(el.dataset.eid,{x:parseInt(el.style.left)||0,y:parseInt(el.style.top)||0});
  }
  el.addEventListener('mousedown',startDrag);
  el.addEventListener('touchstart',startDrag,{passive:false});
  document.addEventListener('mousemove',moveDrag);
  document.addEventListener('touchmove',moveDrag,{passive:false});
  document.addEventListener('mouseup',endDrag);
  document.addEventListener('touchend',endDrag);
  document.addEventListener('touchcancel',endDrag);
}
function makeElementResizable(el,handle){
  let sx,sy,sw,sh,dragging=false;
  function startResize(e){e.stopPropagation();e.preventDefault();
    saveJournalHistory();
    const pt=e.touches?e.touches[0]:e;
    sx=pt.clientX;sy=pt.clientY;sw=parseInt(el.style.width)||200;sh=parseInt(el.style.height)||100;dragging=true;el.style.transition='none';
  }
  function moveResize(e){
    if(!dragging)return;e.preventDefault();
    const pt=e.touches?e.touches[0]:e;
    const nw=Math.max(40,sw+pt.clientX-sx);const nh=Math.max(30,sh+pt.clientY-sy);
    el.style.width=nw+'px';el.style.height=nh+'px';
  }
  function endResize(){
    if(!dragging)return;dragging=false;el.style.transition='';
    updateJournalElem(el.dataset.eid,{w:parseInt(el.style.width)||200,h:parseInt(el.style.height)||100});
  }
  handle.addEventListener('mousedown',startResize);
  handle.addEventListener('touchstart',startResize,{passive:false});
  document.addEventListener('mousemove',moveResize);
  document.addEventListener('touchmove',moveResize,{passive:false});
  document.addEventListener('mouseup',endResize);
  document.addEventListener('touchend',endResize);
  document.addEventListener('touchcancel',endResize);
}
function makeElementRotatable(el,handle){
  let sx,sy,sr,dragging=false;
  function startRot(e){e.stopPropagation();e.preventDefault();
    saveJournalHistory();
    const pt=e.touches?e.touches[0]:e;
    sx=pt.clientX;sy=pt.clientY;sr=parseFloat(el.style.transform?.match(/rotate\(([-\d.]+)deg\)/)?.[1])||0;dragging=true;el.style.transition='none';
  }
  function moveRot(e){
    if(!dragging)return;e.preventDefault();
    const pt=e.touches?e.touches[0]:e;
    const rect=el.getBoundingClientRect();const cx=rect.left+rect.width/2;const cy=rect.top+rect.height/2;
    const ang=Math.atan2(pt.clientY-cy,pt.clientX-cx)*180/Math.PI;el.style.transform=`rotate(${ang}deg)`;
  }
  function endRot(){
    if(!dragging)return;dragging=false;el.style.transition='';
    const rot=parseFloat(el.style.transform?.match(/rotate\(([-\d.]+)deg\)/)?.[1])||0;
    updateJournalElem(el.dataset.eid,{rotation:Math.round(rot)});
  }
  handle.addEventListener('mousedown',startRot);
  handle.addEventListener('touchstart',startRot,{passive:false});
  document.addEventListener('mousemove',moveRot);
  document.addEventListener('touchmove',moveRot,{passive:false});
  document.addEventListener('mouseup',endRot);
  document.addEventListener('touchend',endRot);
  document.addEventListener('touchcancel',endRot);
}
function updateJournalElem(eid,updates){
  const m=getMovie(currentJournalMovieId);if(!m)return;
  const page=m.pages[currentJournalPageIdx];const i=page.elements.findIndex(e=>e.id===eid);
  if(i>=0){page.elements[i]={...page.elements[i],...updates};updateMovie(currentJournalMovieId,{pages:m.pages});}
}
function bringElemToFront(eid){
  const m=getMovie(currentJournalMovieId);if(!m)return;const page=m.pages[currentJournalPageIdx];const maxZ=Math.max(...page.elements.map(e=>e.zIndex||1),1);
  saveJournalHistory();
  const i=page.elements.findIndex(e=>e.id===eid);if(i>=0){page.elements[i].zIndex=maxZ+1;updateMovie(currentJournalMovieId,{pages:m.pages});renderJournalPage();}
}
function sendElemToBack(eid){
  const m=getMovie(currentJournalMovieId);if(!m)return;const page=m.pages[currentJournalPageIdx];const minZ=Math.min(...page.elements.map(e=>e.zIndex||1),1);
  saveJournalHistory();
  const i=page.elements.findIndex(e=>e.id===eid);if(i>=0){page.elements[i].zIndex=minZ-1;updateMovie(currentJournalMovieId,{pages:m.pages});renderJournalPage();}
}
function getMaxZ(){const m=getMovie(currentJournalMovieId);if(!m)return 1;const page=m.pages[currentJournalPageIdx];return Math.max(...page.elements.map(e=>e.zIndex||1),1);}
function bringToFront(){selectedElements.forEach(eid=>bringElemToFront(eid));}
function sendToBack(){selectedElements.forEach(eid=>sendElemToBack(eid));}
function deleteJournalElem(eid){
  spawnJournalParticles(eid);
  const m=getMovie(currentJournalMovieId);if(!m)return;const page=m.pages[currentJournalPageIdx];
  saveJournalHistory();
  page.elements=page.elements.filter(e=>e.id!==eid);selectedElements.delete(eid);
  updateMovie(currentJournalMovieId,{pages:m.pages});renderJournalPage();
}
function deleteSelectedElements(){
  const eids=[...selectedElements];
  eids.forEach(eid=>{spawnJournalParticles(eid);});
  const m=getMovie(currentJournalMovieId);if(!m)return;const page=m.pages[currentJournalPageIdx];
  saveJournalHistory();
  page.elements=page.elements.filter(e=>!selectedElements.has(e.id));
  selectedElements.clear();updateMovie(currentJournalMovieId,{pages:m.pages});renderJournalPage();
}
function spawnJournalParticles(eid){
  const el=document.getElementById('elem-'+eid);if(!el)return;
  const rect=el.getBoundingClientRect();const cx=rect.left+rect.width/2;const cy=rect.top+rect.height/2;
  const colors={ocean:['#4dbfd8','#5cc0a0','#8ad4e8'],spring:['#f0a0b8','#ffd0e0','#ffc0d0'],starry:['#c0a0f8','#a080e0','#e0d0ff'],dusk:['#e0a060','#f0c080','#ffd0a0'],forest:['#68a858','#8ac868','#a8d888'],rain:['#6898c0','#88b8e0','#a8d0f0'],autumn:['#e89850','#f0b870','#ffd090'],polar:['#78a8d0','#98c8f0','#b8e0ff']};
  const c=colors[currentTheme]||colors.ocean;const count=currentTheme==='spring'?14:currentTheme==='autumn'?12:10;
  for(let i=0;i<count;i++){
    const p=document.createElement('div');p.className='particle'+(currentTheme==='spring'||currentTheme==='autumn'?' petal':'');
    p.style.left=cx+'px';p.style.top=cy+'px';p.style.width=(4+Math.random()*8)+'px';
    p.style.height=p.style.width;if(currentTheme==='spring'||currentTheme==='autumn'){p.style.width='10px';p.style.height='16px';}
    p.style.background=c[Math.floor(Math.random()*c.length)];
    p.style.setProperty('--dx',((Math.random()-0.5)*120)+'px');
    p.style.setProperty('--dy',((Math.random()-0.5)*120-40)+'px');
    p.style.setProperty('--rot',((Math.random()-0.5)*360)+'deg');
    document.body.appendChild(p);setTimeout(()=>p.remove(),1000);
  }
}
function addImageToJournal(){
  // On mobile (touch-enabled), offer camera vs gallery choice
  if('ontouchstart' in window||navigator.maxTouchPoints>0){
    if(confirm('选择图片来源：\n\n确定 = 拍照\n取消 = 相册/本地')) {
      document.getElementById('journalCameraInput').click();
    } else {
      document.getElementById('journalImageInput').click();
    }
  } else {
    document.getElementById('journalImageInput').click();
  }
}
function handleJournalImageUpload(e){
  const files=e.target.files;if(!files.length)return;
  const m=getMovie(currentJournalMovieId);if(!m)return;const page=m.pages[currentJournalPageIdx];
  saveJournalHistory();
  Array.from(files).forEach(f=>{
    const reader=new FileReader();reader.onload=ev=>{
      const img=new Image();img.onload=()=>{
        const maxW=500;let w=img.width,h=img.height;if(w>maxW){h=h*maxW/w;w=maxW;}
        page.elements.push({id:genId(),type:'image',src:ev.target.result,x:20+page.elements.length*30,y:20+page.elements.length*20,w:Math.round(w),h:Math.round(h),rotation:0,zIndex:page.elements.length+1});
        updateMovie(currentJournalMovieId,{pages:m.pages});renderJournalPage();
      };img.src=ev.target.result;
    };reader.readAsDataURL(f);
  });e.target.value='';
}
function addTextToJournal(){
  const m=getMovie(currentJournalMovieId);if(!m)return;const page=m.pages[currentJournalPageIdx];
  saveJournalHistory();
  page.elements.push({id:genId(),type:'text',content:'双击编辑文字',fontSize:16,fontFamily:'PingFang SC,Microsoft YaHei,sans-serif',color:'#333',bold:false,italic:false,x:30+page.elements.length*25,y:30+page.elements.length*15,w:200,h:80,rotation:0,zIndex:page.elements.length+1});
  updateMovie(currentJournalMovieId,{pages:m.pages});renderJournalPage();
}
function closeJournal(){if(drawMode)exitDrawMode(false);document.getElementById('journalOverlay').classList.remove('show');}

// Export Journal  
let exportResolution='normal'; // 'normal'|'hd'
async function exportJournalPage(res='normal'){
  const m=getMovie(currentJournalMovieId);if(!m)return;const page=m.pages[currentJournalPageIdx];
  const area=document.getElementById('journalPageArea');
  const scale=res==='hd'?2:1;
  const baseW=750;const baseH=Math.max(500,area.offsetHeight);
  const canvas=document.createElement('canvas');const w=baseW*scale;const h=baseH*scale;canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');
  ctx.scale(scale,scale);
  ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);
  // Draw paper lines for lined mode
  if(journalPaperMode==='lined'){ctx.strokeStyle='#e0e0e0';ctx.lineWidth=1;for(let y=32;y<h;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}}
  else if(journalPaperMode==='grid'){
    ctx.strokeStyle='#e8e8e8';ctx.lineWidth=0.5;
    for(let y=24;y<h;y+=24){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
    for(let x=24;x<w;x+=24){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
  }else if(journalPaperMode==='solid'){ctx.fillStyle='#faf9f2';ctx.fillRect(0,0,w,h);}
  for(const elem of(page.elements||[])){
    ctx.save();const cx=elem.x+elem.w/2;const cy=elem.y+elem.h/2;ctx.translate(cx,cy);ctx.rotate((elem.rotation||0)*Math.PI/180);
    if(elem.type==='image'){
      const img=await loadImage(elem.src);if(img){
        // Apply image styles in export
        if(elem.imgFilter)ctx.filter=elem.imgFilter;
        const r=parseInt(elem.imgRadius)||0;
        if(r>0){ctx.beginPath();ctx.roundRect(-elem.w/2,-elem.h/2,elem.w,elem.h,r);ctx.clip();ctx.drawImage(img,-elem.w/2,-elem.h/2,elem.w,elem.h);}
        else{ctx.drawImage(img,-elem.w/2,-elem.h/2,elem.w,elem.h);}
        if(elem.imgShadow){ctx.shadowColor='rgba(0,0,0,0.2)';ctx.shadowBlur=10;ctx.shadowOffsetX=3;ctx.shadowOffsetY=3;ctx.drawImage(img,-elem.w/2,-elem.h/2,elem.w,elem.h);}
        if(elem.imgBorder){ctx.strokeStyle=elem.imgBorder;ctx.lineWidth=8;ctx.strokeRect(-elem.w/2,-elem.h/2,elem.w,elem.h);}
      }
    }else if(elem.type==='drawing'){
      const img=await loadImage(elem.src);if(img){
        ctx.drawImage(img,-elem.w/2,-elem.h/2,elem.w,elem.h);
      }
    }else if(elem.type==='text'){
      ctx.font=`${elem.italic?'italic ':''}${elem.bold?'bold ':''}${elem.fontSize||16}px ${elem.fontFamily||'PingFang SC,Microsoft YaHei,sans-serif'}`;
      ctx.fillStyle=elem.color||'#333';ctx.textBaseline='top';
      const words=(elem.content||'').split('\n');words.forEach((line,i)=>{ctx.fillText(line,-elem.w/2,-elem.h/2+i*(elem.fontSize||16)*1.5);});
    }
    ctx.restore();
  }
  const label=res==='hd'?'_高清':'';
  const filename=`${m.title}_手帐${label}_${Date.now()}.png`;
  saveCanvas(canvas, filename);
  showToast('手帐已导出 ('+(res==='hd'?'高清':'普通')+')');
}
function toggleExportRes(){
  exportResolution=exportResolution==='normal'?'hd':'normal';
  showToast('导出分辨率：'+(exportResolution==='hd'?'高清 (1500px)':'普通 (750px)'));
  exportJournalPage(exportResolution);
}
function loadImage(src){return new Promise((resolve)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>resolve(null);img.src=src;});}

// ==================== JOURNAL: Text Formatting ====================
function getSelectedTextElem(){
  if(selectedElements.size!==1)return null;
  const eid=[...selectedElements][0];
  const m=getMovie(currentJournalMovieId);if(!m)return null;
  const page=m.pages[currentJournalPageIdx];
  return page.elements.find(e=>e.id===eid&&e.type==='text')||null;
}
function getSelectedImageElem(){
  if(selectedElements.size!==1)return null;
  const eid=[...selectedElements][0];
  const m=getMovie(currentJournalMovieId);if(!m)return null;
  const page=m.pages[currentJournalPageIdx];
  return page.elements.find(e=>e.id===eid&&e.type==='image')||null;
}
function updateFmtBar(){
  const bar=document.getElementById('journalFmtBar');
  const txtGrp=document.getElementById('fmtTextGroup');
  const imgGrp=document.getElementById('fmtImageGroup');
  const seps=document.querySelectorAll('.fmt-text-only');
  const te=getSelectedTextElem();
  const ie=getSelectedImageElem();
  if(te){
    bar.style.display='flex';txtGrp.style.display='flex';imgGrp.style.display='none';
    seps.forEach(s=>s.style.display='');
    document.getElementById('fmtBold').classList.toggle('active',te.bold);
    document.getElementById('fmtItalic').classList.toggle('active',te.italic);
    document.getElementById('fmtColor').value=te.color||'#333333';
  }else if(ie){
    bar.style.display='flex';txtGrp.style.display='none';imgGrp.style.display='flex';
    seps.forEach(s=>s.style.display='none');
  }else{
    bar.style.display='none';
  }
}
function fmtBold(){
  saveJournalHistory();
  const e=getSelectedTextElem();if(!e)return;
  updateJournalElem(e.id,{bold:!e.bold});
  renderJournalPage();setTimeout(()=>{const el=document.getElementById('elem-'+e.id);if(el){el.classList.add('selected');selectedElements.add(e.id);}updateFmtBar();},50);
}
function fmtItalic(){
  saveJournalHistory();
  const e=getSelectedTextElem();if(!e)return;
  updateJournalElem(e.id,{italic:!e.italic});
  renderJournalPage();setTimeout(()=>{const el=document.getElementById('elem-'+e.id);if(el){el.classList.add('selected');selectedElements.add(e.id);}updateFmtBar();},50);
}
function fmtColor(val){
  saveJournalHistory();
  const e=getSelectedTextElem();if(!e)return;
  updateJournalElem(e.id,{color:val});
  renderJournalPage();setTimeout(()=>{const el=document.getElementById('elem-'+e.id);if(el){el.classList.add('selected');selectedElements.add(e.id);}updateFmtBar();},50);
}
function fmtColorPreset(val){fmtColor(val);document.getElementById('fmtColor').value=val;}

// ==================== JOURNAL: Image Styles ====================
function fmtImgStyle(style){
  saveJournalHistory();
  const e=getSelectedImageElem();if(!e)return;
  const updates={imgStyle:style};
  if(style==='polaroid'){updates.imgBorder='#fff';updates.imgRadius='0';updates.imgShadow=true;updates.imgFilter='';}
  else if(style==='rounded'){updates.imgRadius='12';updates.imgBorder='';updates.imgShadow=false;updates.imgFilter='';}
  else if(style==='shadow'){updates.imgShadow=true;updates.imgRadius='4';updates.imgBorder='';updates.imgFilter='';}
  else if(style==='blurBg'){updates.imgFilter='brightness(1.05)';updates.imgRadius='8';updates.imgShadow=false;updates.imgBorder='';}
  else if(style==='sepia'){updates.imgFilter='sepia(0.6) hue-rotate(-10deg)';updates.imgRadius='4';updates.imgShadow=false;updates.imgBorder='';}
  else{updates.imgRadius='0';updates.imgShadow=false;updates.imgFilter='';updates.imgBorder='';}
  updateJournalElem(e.id,updates);
  renderJournalPage();setTimeout(()=>{const el=document.getElementById('elem-'+e.id);if(el){el.classList.add('selected');selectedElements.add(e.id);}updateFmtBar();},50);
}

// Update renderJournalElement to apply image styles
function applyJournalImageStyles(e,imgEl){
  if(!imgEl)return;
  const r=e.imgRadius||'0';const f=e.imgFilter||'';const b=e.imgBorder||'';
  imgEl.style.borderRadius=r+(r==='0'?'':'px');
  imgEl.style.filter=f;
  if(e.imgShadow)imgEl.style.boxShadow='0 6px 20px rgba(0,0,0,0.2)';else imgEl.style.boxShadow='';
  if(b){imgEl.style.border='8px solid '+b;imgEl.style.boxShadow='2px 3px 10px rgba(0,0,0,0.15)';}
  if(!b)imgEl.style.border='';
}

// ==================== JOURNAL: Templates ====================
function applyJournalTemplate(type){
  const m=getMovie(currentJournalMovieId);if(!m)return;
  if(!confirm('套用模板将替换当前页面内容，确定继续？'))return;
  saveJournalHistory();
  const page=m.pages[currentJournalPageIdx];
  const elems=[];
  const tpls={
    review:{
      desc:'影评模板',
      elems:[
        {type:'text',content:'🎬 '+m.title,x:40,y:30,w:660,h:50,fontSize:28,color:'#333',bold:true},
        {type:'text',content:'观影日期：'+fmtDate(m.watchDate)+'    评分：'+'★'.repeat(m.rating||0)+'☆'.repeat(5-(m.rating||0)),x:40,y:90,w:660,h:30,fontSize:14,color:'#888'},
        {type:'text',content:'📝 我的感想',x:40,y:150,w:300,h:30,fontSize:18,color:'#c05038',bold:true},
        {type:'text',content:'在这里写下你的观影感受...',x:40,y:190,w:660,h:200,fontSize:16,color:'#555'},
        {type:'text',content:'💡 印象深刻的画面',x:40,y:420,w:300,h:30,fontSize:18,color:'#60a058',bold:true},
        {type:'text',content:'记录那些让你心动的画面和台词...',x:40,y:460,w:660,h:60,fontSize:15,color:'#555'},
      ]
    },
    quote:{
      desc:'金句摘录',
      elems:[
        {type:'text',content:'💬 经典台词 / 金句摘录',x:40,y:30,w:660,h:50,fontSize:22,color:'#333',bold:true},
        {type:'text',content:'—— 选自《'+m.title+'》',x:40,y:80,w:660,h:25,fontSize:14,color:'#888',italic:true},
        {type:"text",content:"\u201c在此粘贴你最喜欢的台词...\u201d",x:60,y:140,w:620,h:180,fontSize:20,color:"#4088c0",bold:true},
        {type:"text",content:"💭 为什么喜欢这句话",x:60,y:350,w:620,h:30,fontSize:16,color:"#a070c8",bold:true},
        {type:"text",content:"写下你的感受...",x:60,y:390,w:620,h:80,fontSize:15,color:"#555"},
      ]
    },
    poster:{
      desc:'海报模板',
      elems:[
        {type:'text',content:m.title,x:280,y:40,w:400,h:60,fontSize:32,color:'#c05038',bold:true},
        {type:'text',content:m.type+'  ·  '+fmtDate(m.watchDate),x:280,y:100,w:400,h:25,fontSize:14,color:'#888',italic:true},
        {type:'text',content:'★'.repeat(m.rating||0)+'☆'.repeat(5-(m.rating||0)),x:280,y:130,w:200,h:25,fontSize:18,color:'#e89850'},
        {type:'text',content:m.review||'点击这里写下短评...',x:280,y:170,w:400,h:80,fontSize:16,color:'#666'},
        {type:"text",content:"在左侧放入电影海报截图 ☚",x:280,y:420,w:400,h:30,fontSize:12,color:"#aaa",italic:true},
      ]
    },
    diary:{
      desc:'日记模板',
      elems:[
        {type:"text",content:"📔 观影日记",x:40,y:25,w:660,h:45,fontSize:26,color:"#60a058",bold:true},
        {type:'text',content:m.title+'  ·  '+fmtDate(m.watchDate),x:40,y:75,w:660,h:22,fontSize:13,color:'#888'},
        {type:"text",content:"日期：点击修改日期    天气：☀️ 心情：😊",x:40,y:110,w:660,h:22,fontSize:13,color:"#888"},
        {type:"text",content:"今天看了《"+m.title+"》，感受如下：",x:40,y:160,w:660,h:25,fontSize:15,color:"#555"},
        {type:"text",content:"在这里写下观影日记...",x:40,y:195,w:660,h:250,fontSize:15,color:"#666"},
        {type:"text",content:"明日计划：",x:40,y:460,w:660,h:25,fontSize:14,color:"#a070c8",bold:true},
      ]
    },
    bookQuote: {desc: "金句摘录", elems: [
      {type: "text", content: "📖 书籍金句摘录", x: 40, y: 30, w: 660, h: 50, fontSize: 24, color: "#6a5ac0", bold: true},
      {type: "text", content: "—— 摘自《" + m.title + "》" + (m.author ? "  " : "") + (m.author || ""), x: 40, y: 85, w: 660, h: 22, fontSize: 13, color: "#888", italic: true},
      {type: "text", content: "\u201c在此粘贴令你心动的句子...\u201d", x: 60, y: 140, w: 620, h: 160, fontSize: 20, color: "#5a40a0", bold: true},
      {type: "text", content: "📄 出处：页码/章节（点击修改）", x: 60, y: 320, w: 300, h: 25, fontSize: 13, color: "#888"},
      {type: "text", content: "💭 阅读感悟", x: 60, y: 370, w: 620, h: 30, fontSize: 16, color: "#a070c8", bold: true},
      {type: "text", content: "写下你对这段话的理解...", x: 60, y: 410, w: 620, h: 60, fontSize: 15, color: "#555"}
    ]},
    bookPlot: {desc: "情节梳理", elems: [
      {type: "text", content: "📋 情节梳理 · 《" + m.title + "》", x: 40, y: 25, w: 660, h: 45, fontSize: 22, color: "#4080a0", bold: true},
      {type: "text", content: "📖 主要人物", x: 40, y: 90, w: 200, h: 25, fontSize: 16, color: "#4080a0", bold: true},
      {type: "text", content: "角色1：", x: 40, y: 120, w: 660, h: 22, fontSize: 14, color: "#555"},
      {type: "text", content: "角色2：", x: 40, y: 148, w: 660, h: 22, fontSize: 14, color: "#555"},
      {type: "text", content: "角色3：", x: 40, y: 176, w: 660, h: 22, fontSize: 14, color: "#555"},
      {type: "text", content: "🔄 情节发展线", x: 40, y: 220, w: 200, h: 25, fontSize: 16, color: "#4080a0", bold: true},
      {type: "text", content: "开端 \u2192 发展 \u2192 高潮 \u2192 结局", x: 40, y: 255, w: 660, h: 40, fontSize: 15, color: "#666"},
      {type: "text", content: "📝 详细梳理", x: 40, y: 310, w: 200, h: 25, fontSize: 16, color: "#4080a0", bold: true},
      {type: "text", content: "在这里梳理故事脉络...", x: 40, y: 345, w: 660, h: 120, fontSize: 15, color: "#555"}
    ]},
    bookCharacter: {desc: "人物分析", elems: [
      {type: "text", content: "👤 人物分析 · 《" + m.title + "》", x: 40, y: 25, w: 660, h: 45, fontSize: 22, color: "#607040", bold: true},
      {type: "text", content: "角色名称（点击修改）", x: 40, y: 80, w: 300, h: 30, fontSize: 18, color: "#607040", bold: true},
      {type: "text", content: "🎭 性格特点", x: 40, y: 125, w: 200, h: 25, fontSize: 15, color: "#607040", bold: true},
      {type: "text", content: "描述角色的性格特征...", x: 40, y: 158, w: 660, h: 40, fontSize: 14, color: "#555"},
      {type: "text", content: "💬 经典台词", x: 40, y: 210, w: 200, h: 25, fontSize: 15, color: "#607040", bold: true},
      {type: "text", content: "\u201c角色的经典语录...\u201d", x: 40, y: 243, w: 660, h: 30, fontSize: 14, color: "#4088c0", italic: true},
      {type: "text", content: "📈 成长轨迹", x: 40, y: 290, w: 200, h: 25, fontSize: 15, color: "#607040", bold: true},
      {type: "text", content: "角色在故事中的变化与成长...", x: 40, y: 323, w: 660, h: 80, fontSize: 14, color: "#555"},
      {type: "text", content: "💡 我的评价", x: 40, y: 420, w: 200, h: 25, fontSize: 15, color: "#607040", bold: true},
      {type: "text", content: "对这个人物的看法...", x: 40, y: 453, w: 660, h: 40, fontSize: 14, color: "#555"}
    ]},
    bookReview: {desc: "阅读感悟", elems: [
      {type: "text", content: "📝 阅读感悟 · 《" + m.title + "》", x: 40, y: 25, w: 660, h: 45, fontSize: 24, color: "#c05038", bold: true},
      {type: "text", content: "阅读日期：" + fmtDate(m.watchDate) + "    评分：" + "\u2605".repeat(m.rating || 0) + "\u2606".repeat(5 - (m.rating || 0)), x: 40, y: 80, w: 660, h: 25, fontSize: 13, color: "#888"},
      {type: "text", content: "📖 内容概要", x: 40, y: 130, w: 200, h: 25, fontSize: 16, color: "#c05038", bold: true},
      {type: "text", content: "这本书讲了什么...", x: 40, y: 163, w: 660, h: 50, fontSize: 15, color: "#555"},
      {type: "text", content: "💡 启发与思考", x: 40, y: 230, w: 200, h: 25, fontSize: 16, color: "#60a058", bold: true},
      {type: "text", content: "这本书带给你的启发...", x: 40, y: 263, w: 660, h: 100, fontSize: 15, color: "#555"},
      {type: "text", content: "📌 行动清单", x: 40, y: 380, w: 200, h: 25, fontSize: 16, color: "#a070c8", bold: true},
      {type: "text", content: "读完这本书后你打算做什么...", x: 40, y: 413, w: 660, h: 60, fontSize: 15, color: "#555"}
    ]}
  };
  const tpl=tpls[type];
  if(tpl){
    elems.push(...tpl.elems.map((e,i)=>({...e,id:genId(),x:e.x,y:e.y,w:e.w||200,h:e.h||60,rotation:0,zIndex:i+1})));
  }
  page.elements=elems;
  updateMovie(currentJournalMovieId,{pages:m.pages});
  renderJournalPage();showToast('已套用模板：'+tpl.desc);
}

// ==================== JOURNAL: PDF Export ====================
async function exportJournalPDF(){
  const m=getMovie(currentJournalMovieId);if(!m)return;
  const pages=m.pages||[];if(!pages.length){showToast('没有可导出的页面');return;}
  showToast('正在生成PDF...（多页导出为PNG合集）');
  // Since we don't have PDF lib, export all pages as individual PNG in a zip-like batch
  for(let i=0;i<pages.length;i++){
    const page=pages[i];
    const canvas=document.createElement('canvas');const w=750;const h=500;canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);
    for(const elem of(page.elements||[])){
      ctx.save();const cx=elem.x+elem.w/2;const cy=elem.y+elem.h/2;ctx.translate(cx,cy);ctx.rotate((elem.rotation||0)*Math.PI/180);
      if(elem.type==='image'){
        const img=await loadImage(elem.src);if(img){ctx.drawImage(img,-elem.w/2,-elem.h/2,elem.w,elem.h);}
      }else if(elem.type==='drawing'){
        const img=await loadImage(elem.src);if(img){ctx.drawImage(img,-elem.w/2,-elem.h/2,elem.w,elem.h);}
      }else if(elem.type==='text'){
        ctx.font=`${elem.italic?'italic ':''}${elem.bold?'bold ':''}${elem.fontSize||16}px ${elem.fontFamily||'PingFang SC,Microsoft YaHei,sans-serif'}`;
        ctx.fillStyle=elem.color||'#333';ctx.textBaseline='top';
        const words=(elem.content||'').split('\n');words.forEach((line,j)=>{ctx.fillText(line,-elem.w/2,-elem.h/2+j*(elem.fontSize||16)*1.5);});
      }
      ctx.restore();
    }
    var fname=`${m.title}_手帐_P${i+1}_${Date.now()}.png`;
    await new Promise(resolve=>{canvas.toBlob(blob=>{saveFile(blob,fname);resolve();},'image/png');});
  }
  showToast(`已导出 ${pages.length} 页手帐`);
}

// ==================== JOURNAL: Export Share Poster ====================
function exportSharePoster(){
  const m=getMovie(currentJournalMovieId);if(!m)return;
  showToast('正在生成海报...');
  const isMobile=window.innerWidth<768;
  const w=isMobile?Math.min(360,window.innerWidth-20):400;
  const h=Math.round(w*1.4);
  const canvas=document.createElement('canvas');
  canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d');
  const s=w/400;
  // Gradient BG
  const g=ctx.createLinearGradient(0,0,0,h);
  g.addColorStop(0,'#1a1a2e');g.addColorStop(0.5,'#16213e');g.addColorStop(1,'#0f3460');
  ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  // Stars bg
  ctx.fillStyle='rgba(255,255,255,0.04)';
  for(let i=0;i<60;i++){ctx.beginPath();ctx.arc(Math.random()*w,Math.random()*h,Math.random()*2+0.5,0,Math.PI*2);ctx.fill();}
  const drawContent=()=>{
    ctx.fillStyle='#fff';ctx.font='bold '+(20*s)+'px "PingFang SC","Microsoft YaHei",sans-serif';ctx.textAlign='center';
    ctx.fillText(m.title.slice(0,18),200*s,275*s);
    ctx.fillStyle='rgba(255,255,255,0.6)';ctx.font=(12*s)+'px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText(`${m.type} · ${fmtDate(m.watchDate)}`,200*s,296*s);
    const stars='★'.repeat(m.rating||0)+'☆'.repeat(5-(m.rating||0));
    ctx.fillStyle='#f5c842';ctx.font=(20*s)+'px serif';ctx.fillText(stars,200*s,324*s);
    ctx.strokeStyle='rgba(255,255,255,0.15)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(40*s,346*s);ctx.lineTo(360*s,346*s);ctx.stroke();
    // Quotes
    const quotes=m.quotes||[];
    if(quotes.length>0){
      ctx.fillStyle='rgba(255,255,255,0.85)';ctx.font=(14*s)+'px "PingFang SC","Microsoft YaHei",sans-serif';
      const q=quotes[0].content.length>30?quotes[0].content.slice(0,30)+'...':quotes[0].content;
      ctx.fillText(`"${q}"`,200*s,380*s);
    }
    // Review
    if(m.review){
      ctx.fillStyle='rgba(255,255,255,0.7)';ctx.font=(13*s)+'px "PingFang SC","Microsoft YaHei",sans-serif';
      const rv=m.review.length>40?m.review.slice(0,40)+'...':m.review;
      ctx.fillText(rv,200*s,420*s);
    }
    // Footer
    ctx.fillStyle='rgba(255,255,255,0.4)';ctx.font=(11*s)+'px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText('🌳 树洞 · 观影手帳',200*s,h-30);
    ctx.fillText(new Date().toLocaleDateString('zh-CN'),200*s,h-14);
    showSharePosterDialog(canvas);
  };
  if(m.cover){
    const img=new Image();img.crossOrigin='anonymous';
    img.onload=()=>{ctx.drawImage(img,120*s,24*s,160*s,220*s);drawContent();};
    img.onerror=()=>{ctx.fillStyle='rgba(255,255,255,0.08)';ctx.fillRect(120*s,24*s,160*s,220*s);ctx.font=(50*s)+'px serif';ctx.textAlign='center';ctx.fillText('🎬',200*s,155*s);drawContent();};
    img.src=m.cover;
  }else{ctx.fillStyle='rgba(255,255,255,0.08)';ctx.fillRect(120*s,24*s,160*s,220*s);ctx.font=(50*s)+'px serif';ctx.textAlign='center';ctx.fillText('🎬',200*s,155*s);drawContent();}
}

// Override element selection to show format bar
(function(){
  const origRJP=renderJournalPage;
  const origSDJ=deleteSelectedElements;
  const origSTJ=switchJournalPage;
  renderJournalPage=function(){
    origRJP();setTimeout(updateFmtBar,100);
  };
  deleteSelectedElements=function(){
    origSDJ();setTimeout(updateFmtBar,100);
  };
  switchJournalPage=function(i){
    origSTJ(i);setTimeout(updateFmtBar,100);
  };
})();

// ==================== SHELF MODULE ====================
let shelfViewMode='grid';
function switchShelfView(view,btn){
  shelfViewMode=view;
  document.querySelectorAll('.shelf-view-toggle button').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  renderShelf();
}
function renderShelf(){
  const ms=loadMovies();const area=document.getElementById('shelfArea');
  if(!ms.length){area.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:40px;">📚 观影架空空的，先添加一些作品吧</div>';return;}
  if(shelfViewMode==='list'){
    renderShelfList(ms,area);return;
  }
  const types={'电影':[],'电视剧':[],'动漫':[],'书籍':[],'其他':[]};
  ms.forEach(m=>{const t=m.type||'其他';if(types[t])types[t].push(m);else types['其他'].push(m);});
  let html='';
  for(const[t,items] of Object.entries(types)){
    if(!items.length)continue;
    html+=`<div class="shelf-row"><div class="shelf-label">${t}</div><div class="shelf-items">`;
    items.forEach(m=>{
      html+=`<div class="shelf-book" onclick="openDetail('${m.id}')" title="${esc(m.title)}">
        <div class="book-cover">${m.cover?`<img src="${esc(m.cover)}" onerror="this.innerHTML='🎬'">`:'🎬'}</div>
        <div class="book-title">${esc(m.title)}</div>
      </div>`;
    });
    html+='</div></div>';
  }
  area.innerHTML=html;
}
function renderShelfList(ms,area){
  const types={'电影':[],'电视剧':[],'动漫':[],'书籍':[],'其他':[]};
  ms.forEach(m=>{const t=m.type||'其他';if(types[t])types[t].push(m);else types['其他'].push(m);});
  let html='';
  for(const[t,items] of Object.entries(types)){
    if(!items.length)continue;
    html+=`<div class="shelf-row"><div class="shelf-label">${t} (${items.length})</div>`;
    items.forEach(m=>{
      const sb=m.status==='想看'?'want':m.status==='在看'?'watching':'watched';
      const st=m.status==='想看'?'📌 想看':m.status==='在看'?'▶ 在看':'✓ 已看';
      const stars='★'.repeat(m.rating||0)+'☆'.repeat(5-(m.rating||0));
      html+=`<div class="shelf-list-item" onclick="openDetail('${m.id}')">
        <div class="sl-poster">${m.cover?`<img src="${esc(m.cover)}" onerror="this.style.display='none';this.parentElement.innerHTML='🎬'" alt="" style="width:100%;height:100%;object-fit:cover;">`:'🎬'}</div>
        <div class="sl-body">
          <div class="sl-title">${esc(m.title)}</div>
          <div class="sl-meta">${fmtDate(m.watchDate)} · ${esc(m.type)}</div>
          <div class="sl-stars">${stars} · <span class="sl-status ${sb}">${st}</span></div>
        </div>
      </div>`;
    });
    html+='</div>';
  }
  area.innerHTML=html;
}

// ==================== CHECKLIST MODULE ====================
function renderChecklist(){
  const ms=loadMovies();const sort=document.getElementById('checkSort').value;
  const typeF=document.getElementById('checkType').value;const search=document.getElementById('checkSearch').value.toLowerCase();
  let list=[...ms];
  if(typeF!=='全部')list=list.filter(m=>m.type===typeF);
  if(search)list=list.filter(m=>m.title.toLowerCase().includes(search));
  if(sort==='date')list.sort((a,b)=>new Date(b.watchDate||0)-new Date(a.watchDate||0));
  else if(sort==='rating')list.sort((a,b)=>(b.rating||0)-(a.rating||0));
  else list.sort((a,b)=>a.title.localeCompare(b.title,'zh'));
  const tb=document.getElementById('checklistTable').querySelector('tbody');
  tb.innerHTML=list.map(m=>{
    const stars='★'.repeat(m.rating||0)+'☆'.repeat(5-(m.rating||0));
    const st=m.status==='想看'?'📌 想看':m.status==='在看'?'▶ 在看':'✓ 已看';
    return `<tr>
      <td>${fmtDate(m.watchDate)}</td>
      <td style="cursor:pointer;" onclick="openJournalForMovie('${m.id}')">${esc(m.title)}</td>
      <td>${esc(m.type)}</td>
      <td><span class="checklist-stars" onclick="quickRate('${m.id}',event)">${stars}</span></td>
      <td>${st}</td>
      <td><button class="btn sm" onclick="openEditMovie('${m.id}')">编辑</button> <button class="btn sm danger" onclick="deleteMovieWithConfirm('${m.id}')">删除</button></td>
    </tr>`;
  }).join('');
  document.getElementById('checkSummary').innerHTML=`<span>共 <strong>${list.length}</strong> 部作品</span><span>已看 <strong>${list.filter(m=>m.status==='已看').length}</strong></span><span>平均评分 <strong>${list.length?(list.reduce((s,m)=>s+(m.rating||0),0)/list.length).toFixed(1):'0'}</strong></span>`;
}
function quickRate(id,e){
  const rect=e.target.getBoundingClientRect();const x=e.clientX-rect.left;const starW=rect.width/5;const rating=Math.ceil(x/starW);
  const m=getMovie(id);if(m){updateMovie(id,{rating:rating===m.rating?0:rating});renderChecklist();}
}

// ==================== WATCHLIST MODULE ====================
function setWatchFilter(f,btn){
  watchFilter=f;document.querySelectorAll('.watchlist-filters button[data-status]').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');renderWatchlist();
}
function setWatchTypeFilter(f,btn){
  watchTypeFilter=f;
  document.querySelectorAll('#watchlistTypeFilters button[data-type]').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');renderWatchlist();
}
function openAddWatchMovie(){editingMovieId=null;document.getElementById('movieModalTitle').textContent='添加想看影片';fillMovieForm({status:'想看'});openModal('addMovieModal');}
function renderWatchlist(){
  const ms=loadMovies();let list=watchFilter==='全部'?ms:ms.filter(m=>m.status===watchFilter);
  if(watchTypeFilter!=='全部')list=list.filter(m=>m.type===watchTypeFilter);
  const d=document.getElementById('watchlistGrid');
  const stIcons={want:'📌',watching:'🔵',watched:'🟢'};
  d.innerHTML=list.length?list.map(m=>{
    const stKey=m.status==='想看'?'want':m.status==='在看'?'watching':'watched';
    const statusLabel=(stIcons[stKey]||'')+' '+m.status;
    const sb=m.status==='想看'?'want':m.status==='在看'?'watching':'watched';
    const tagsHtml=(m.tags||[]).length?`<div class="mc-tags">${m.tags.map(t=>`<span class="mc-tag" onclick="event.stopPropagation();filterByTag('${esc(t)}')">${esc(t)}</span>`).join('')}</div>`:'';
    return `<div class="movie-card">
      <div class="mc-poster">${m.cover?`<img src="${esc(m.cover)}" onerror="this.parentElement.innerHTML='🎬'">`:'🎬'}</div>
      <div class="mc-body">
        <div class="mc-title">${esc(m.title)}</div>
        <div class="mc-meta">${esc(m.type)} · ${fmtDate(m.watchDate)}</div>
        <div class="mc-status ${sb}">${statusLabel}</div>
        ${tagsHtml}
        <div class="mc-actions">
          <select style="font-family:inherit;font-size:0.7rem;padding:3px 6px;border-radius:8px;border:1px solid var(--border);background:var(--input-bg);color:var(--text);" onchange="changeStatus('${m.id}',this.value)">
            <option value="想看" ${m.status==='想看'?'selected':''}>想看</option>
            <option value="在看" ${m.status==='在看'?'selected':''}>在看</option>
            <option value="已看" ${m.status==='已看'?'selected':''}>已看</option>
          </select>
          <button class="btn sm" onclick="openJournalForMovie('${m.id}')">手帐</button>
          <button class="btn sm danger" onclick="deleteMovieWithConfirm('${m.id}')">删除</button>
        </div>
      </div>
    </div>`;
  }).join(''):'<div style="text-align:center;color:var(--text-muted);padding:30px;grid-column:1/-1;">暂无影片</div>';
}
function changeStatus(id,st){updateMovie(id,{status:st});renderWatchlist();renderHome();renderChecklist();}

// ==================== BOOKSHELF MODULE ====================
let bookshelfStatusFilter = '全部';
let bookshelfTagFilter = '';
let bookshelfSortBy = 'date';

function setBookshelfStatusFilter(f, btn) {
  bookshelfStatusFilter = f;
  document.querySelectorAll('#bsStatusFilters button[data-status]').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderBookshelf();
}

function setBookshelfTagFilter(tag, btn) {
  bookshelfTagFilter = (bookshelfTagFilter === tag) ? '' : tag;
  renderBookshelf();
}

function renderBookshelf() {
  const search = (document.getElementById('bsSearchInput')?.value || '').toLowerCase();
  bookshelfSortBy = document.getElementById('bsSortBy')?.value || 'date';

  let books = loadMovies().filter(m => m.type === '书籍');

  // Status filter
  if (bookshelfStatusFilter === '已读') books = books.filter(m => m.status === '已看');
  else if (bookshelfStatusFilter === '在读') books = books.filter(m => m.status === '在看');
  else if (bookshelfStatusFilter === '想读') books = books.filter(m => m.status === '想看');

  // Tag filter
  if (bookshelfTagFilter) books = books.filter(m => (m.tags || []).includes(bookshelfTagFilter));

  // Search filter
  if (search) {
    books = books.filter(m =>
      (m.title || '').toLowerCase().includes(search) ||
      (m.author || '').toLowerCase().includes(search) ||
      (m.tags || []).some(t => t.toLowerCase().includes(search)) ||
      (m.publisher || '').toLowerCase().includes(search)
    );
  }

  // Sort
  if (bookshelfSortBy === 'rating') books.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  else if (bookshelfSortBy === 'title') books.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'zh'));
  else if (bookshelfSortBy === 'progress') books.sort((a, b) => progressPercent(b) - progressPercent(a));
  else books.sort((a, b) => new Date(b.watchDate || 0) - new Date(a.watchDate || 0));

  // Render tag chips
  const allTags = new Set();
  loadMovies().filter(m => m.type === '书籍').forEach(m => (m.tags || []).forEach(t => allTags.add(t)));
  const tagContainer = document.getElementById('bsTagFilters');
  if (tagContainer) {
    tagContainer.innerHTML = Array.from(allTags).map(t =>
      `<span class="bs-tag-chip${bookshelfTagFilter === t ? ' active' : ''}" onclick="setBookshelfTagFilter('${esc(t)}',this)">${esc(t)}</span>`
    ).join('');
  }

  // Render cards
  const grid = document.getElementById('bookshelfGrid');
  if (!grid) return;
  if (!books.length) {
    grid.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:30px;grid-column:1/-1;">📖 书架空空，点击「＋ 添加书籍」开始录入吧</div>';
    return;
  }
  grid.innerHTML = books.map(m => makeMovieCard(m)).join('');
}

// ==================== QUOTATIONS MODULE ====================
function openAddQuote(){const ms=loadMovies();const sel=document.getElementById('qMovieSelect');sel.innerHTML=ms.map(m=>`<option value="${m.id}">${esc(m.title)} [${m.type}]</option>`).join('');if(ms.length)sel.value=ms[0].id;document.getElementById('qContent').value='';openModal('addQuoteModal');}
function saveQuote(){
  const mid=document.getElementById('qMovieSelect').value;const content=document.getElementById('qContent').value.trim();
  if(!content){showToast('请填写摘录内容');return;}
  const m=getMovie(mid);if(!m)return;m.quotes=m.quotes||[];m.quotes.push({id:genId(),content,time:nowISO()});
  updateMovie(mid,{quotes:m.quotes});closeModal('addQuoteModal');showToast('摘录已保存');renderQuotations();
}
var quoteTypeFilter='全部';
function setQuoteTypeFilter(f,btn){
  quoteTypeFilter=f;
  document.querySelectorAll('#page-quotations .btn.sm[onclick^="setQuoteTypeFilter"]').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  renderQuotations();
}

function renderQuotations(){
  const ms=loadMovies();const sel=document.getElementById('quoteMovieSelect');
  sel.innerHTML=ms.map(m=>`<option value="${m.id}">${esc(m.title)} [${m.type}]</option>`).join('');
  const list=document.getElementById('quotationsList');
  var moviesWithQuotes=ms.filter(m=>(m.quotes||[]).length>0);
  // Apply type filter
  if(quoteTypeFilter==='影视'){
    moviesWithQuotes=moviesWithQuotes.filter(m=>m.type!=='书籍');
  }else if(quoteTypeFilter==='书籍'){
    moviesWithQuotes=moviesWithQuotes.filter(m=>m.type==='书籍');
  }
  if(!moviesWithQuotes.length){list.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:30px;">暂无摘录，选择一个作品开始添加</div>';return;}
  let html='';
  moviesWithQuotes.forEach(m=>{
    html+=`<div class="quote-group"><div class="quote-group-header" onclick="this.classList.toggle('collapsed')">${esc(m.title)} <span style="font-size:0.75rem;color:var(--text-muted);">· ${esc(m.type)} · ${m.quotes.length}条</span><span class="arrow">▾</span></div><div class="quote-items">`;
    m.quotes.forEach(q=>{
      html+=`<div class="quote-item">
        <div class="quote-mark">"</div>
        <div><div class="quote-text">${esc(q.content)}</div><div class="quote-time">${fmtDate(q.time)}</div></div>
        <div class="quote-actions">
          <button class="btn sm" onclick="syncQuoteToJournal('${m.id}','${q.id}')">📒 同步到笔记</button>
          <button class="btn sm danger" onclick="deleteQuote('${m.id}','${q.id}')">×</button>
        </div>
      </div>`;
    });
    html+='</div></div>';
  });
  list.innerHTML=html;
}
function deleteQuote(mid,qid){
  const m=getMovie(mid);if(!m)return;m.quotes=m.quotes.filter(q=>q.id!==qid);updateMovie(mid,{quotes:m.quotes});renderQuotations();showToast('摘录已删除');
}
function syncQuoteToJournal(mid,qid){
  const m=getMovie(mid);if(!m)return;const q=m.quotes.find(x=>x.id===qid);if(!q)return;
  if(!m.pages||!m.pages.length)m.pages=[{id:genId(),elements:[]}];
  const page=m.pages[m.pages.length-1];
  page.elements.push({id:genId(),type:'text',content:`"${q.content}"`,fontSize:14,fontFamily:'PingFang SC,Microsoft YaHei,sans-serif',color:'#555',bold:false,italic:true,x:30+page.elements.length*20,y:30+page.elements.length*15,w:400,h:60,rotation:0,zIndex:page.elements.length+1});
  updateMovie(mid,{pages:m.pages});showToast('已同步到笔记最后一页');openJournalForMovie(mid);
}

// ==================== SETTINGS ====================
function renderSettings(){
  const presets=[
    {name:'晨曦',desc:'温暖朝霞色调',colors:['#f8c8a0','#e89868','#f0d0b0'],theme:'dusk'},
    {name:'深海',desc:'宁静海洋蓝调',colors:['#4dbfd8','#5cc0a0','#2a9db8'],theme:'ocean'},
    {name:'花园',desc:'浪漫春日粉调',colors:['#f0a0b8','#ffd0e0','#c8a86a'],theme:'spring'},
    {name:'星空',desc:'梦幻暗夜紫调',colors:['#a080e0','#c0a0f8','#60a0d8'],theme:'starry'},
    {name:'森林',desc:'清新自然绿调',colors:['#68a858','#8ac868','#8a9a40'],theme:'forest'},
    {name:'雨季',desc:'沉静雨境蓝调',colors:['#6898c0','#88b8e0','#7088a8'],theme:'rain'},
    {name:'秋色',desc:'温暖落叶橙调',colors:['#e89850','#f0b870','#a86840'],theme:'autumn'},
    {name:'极光',desc:'纯净冰雪银调',colors:['#78a8d0','#98c8f0','#7898b8'],theme:'polar'}
  ];
  document.getElementById('colorPresets').innerHTML=presets.map(p=>`<div class="preset-card" onclick="switchTheme('${p.theme}');showToast('已应用「${p.name}」配色')">
    <div class="preset-swatch">${p.colors.map(c=>`<span style="background:${c}"></span>`).join('')}</div>
    <div class="preset-name">${p.name}</div><div class="preset-desc">${p.desc}</div>
  </div>`).join('');
  renderYearlySummary();
  renderTagCloud();
  loadApiSettings();
}
function renderYearlySummary(){
  const ms=loadMovies();
  const years={};
  ms.forEach(m=>{
    const y=m.watchDate?m.watchDate.slice(0,4):'未知';
    if(!years[y])years[y]={total:0,watched:0,watching:0,want:0,types:{}};
    years[y].total++;
    if(m.status==='已看')years[y].watched++;
    else if(m.status==='在看')years[y].watching++;
    else years[y].want++;
    const t=m.type||'其他';years[y].types[t]=(years[y].types[t]||0)+1;
  });
  const sortedYrs=Object.keys(years).filter(y=>y!=='未知').sort().reverse();
  const el=document.getElementById('yearlySummary');
  if(!sortedYrs.length){el.innerHTML='<div class="yearly-summary-empty">暂无年度数据，添加作品后自动统计</div>';return;}
  el.innerHTML='<div class="yearly-summary-grid">'+sortedYrs.slice(0,6).map(y=>{
    const d=years[y];
    return `<div class="yearly-sum-card" onclick="setYearFilter('${y}')">
      <div class="ys-year">📅 ${y}</div>
      <div class="ys-count">${d.total}</div>
      <div class="ys-label">✓${d.watched} ▶${d.watching} 📌${d.want}</div>
    </div>`;
  }).join('')+'</div>';
}
function setYearFilter(y){
  homeTypeFilter='全部';document.querySelectorAll('.top-filter-bar button[data-type]').forEach(b=>b.classList.remove('active'));
  document.querySelector('.top-filter-bar button[data-type="全部"]').classList.add('active');
  const ms=loadMovies().filter(m=>(m.watchDate||'').slice(0,4)===y);
  const d=document.getElementById('homeTimeline');
  renderTimeline(ms);
  showPage('home');
  showToast('已筛选 '+y+' 年作品');
}
function renderTagCloud(){
  const ms=loadMovies();
  const tagCounts={};
  ms.forEach(m=>{(m.tags||[]).forEach(t=>{tagCounts[t]=(tagCounts[t]||0)+1;});});
  const el=document.getElementById('tagCloud');
  const entries=Object.entries(tagCounts).sort((a,b)=>b[1]-a[1]);
  if(!entries.length){el.innerHTML='<div class="tag-cloud-empty">暂无标签，编辑作品时添加标签即可</div>';return;}
  el.innerHTML='<div class="tag-cloud">'+entries.map(([t,c])=>`<span class="tag-cloud-item" onclick="filterByTag('${esc(t)}')">${esc(t)}<span class="tag-count">${c}</span></span>`).join('')+'</div>';
}
function filterByTag(tag){
  homeTypeFilter='全部';document.querySelectorAll('.top-filter-bar button[data-type]').forEach(b=>b.classList.remove('active'));
  document.querySelector('.top-filter-bar button[data-type="全部"]').classList.add('active');
  const ms=loadMovies().filter(m=>(m.tags||[]).includes(tag));
  const d=document.getElementById('homeTimeline');
  renderTimeline(ms);
  showPage('home');
  showToast('已筛选标签: '+tag);
}

// ==================== DATA EXPORT/IMPORT ====================
function exportAllData(){
  const ms=loadMovies();const blob=new Blob([JSON.stringify({movies:ms,exportedAt:nowISO()},null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`treehole_backup_${new Date().toISOString().slice(0,10)}.json`;a.click();showToast('数据已导出');
}
function importAllData(e){
  const f=e.target.files[0];if(!f)return;const r=new FileReader();
  r.onload=ev=>{try{const d=JSON.parse(ev.target.result);if(d.movies){saveMovies(d.movies);showToast('数据导入成功');renderHome();renderJournalList();renderShelf();renderChecklist();renderWatchlist();renderQuotations();}}catch(ex){showToast('导入失败：无效文件');}};
  r.readAsText(f);e.target.value='';
}
function clearAllData(){localStorage.removeItem(MOVIES_KEY);showToast('数据已清除');renderHome();renderJournalList();renderShelf();renderBookshelf();renderChecklist();renderWatchlist();renderQuotations();}

// ==================== INIT ====================
function init(){
  loadTheme();initBgCanvas();renderHome();renderSettings();
  // Auto-connect proxy silently in background (never blocks page)
  initProxyAutoConnect();
  // Keyboard shotcuts
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      closeModal('addMovieModal');closeModal('addQuoteModal');
      document.getElementById('journalOverlay')?.classList.remove('show');
      if(document.getElementById('playerOverlay').classList.contains('show'))closePlayer();
      if(document.getElementById('mediaSearchPanel').classList.contains('show'))closeMediaSearch();
      if(document.getElementById('detailOverlay').classList.contains('show'))closeDetail();
      if(document.getElementById('reviewDetailOverlay').classList.contains('show'))closeReviewDetail();
      if(document.getElementById('rdMetaEditOverlay').classList.contains('show'))closeRdMetaEdit();
      if(document.getElementById('rdWatchLogOverlay').classList.contains('show'))closeRdWatchLogDialog();
      if(document.getElementById('sharePosterOverlay').classList.contains('show'))closeSharePoster();
      if(document.getElementById('aiChatOverlay').classList.contains('show'))closeAIChat();
    }
  });
  // Journal overlay click outside
  document.getElementById('journalOverlay').addEventListener('click',function(e){if(e.target===this)closeJournal();});
  // Player overlay click outside
  document.getElementById('playerOverlay').addEventListener('click',function(e){if(e.target===this)closePlayer();});
  // Media search overlay click outside
  document.getElementById('mediaSearchOverlay').addEventListener('click',function(e){if(e.target===this)closeMediaSearch();});
  // Universal modal overlay tap-to-close (for addMovieModal, addQuoteModal, bookReaderOverlay, etc.)
  document.addEventListener('click', function(e) {
    if (!e.target.classList || !e.target.classList.contains('modal-overlay')) return;
    if (!e.target.classList.contains('show')) return;
    const id = e.target.id;
    if (!id) return;
    const closeMap = {
      'addMovieModal': function() { closeModal('addMovieModal'); },
      'addQuoteModal': function() { closeModal('addQuoteModal'); },
      'bookReaderOverlay': function() { closeModal('bookReaderOverlay'); }
    };
    if (closeMap[id]) closeMap[id]();
  });
  // Deselect all on canvas click
  document.getElementById('journalElements').addEventListener('mousedown',function(e){
    if(e.target===this||e.target===document.getElementById('journalPageArea')){
      selectedElements.clear();document.querySelectorAll('.journal-elem').forEach(de=>de.classList.remove('selected'));
    }
  });
  // Demo data if empty
  const ms=loadMovies();
  if(!ms.length){
    const demo=[
      {id:genId(),title:'肖申克的救赎',type:'电影',watchDate:'2025-01-15',status:'已看',cover:'',rating:5,tags:['经典','剧情'],review:'希望是美好的，也许是人间至善',pages:[{id:genId(),elements:[]}],quotes:[{id:genId(),content:'有些鸟是关不住的，它们的羽毛太鲜亮了。',time:nowISO()},{id:genId(),content:'希望是美好的，也许是人间至善，而美好的事物永不消逝。',time:nowISO()}],createdAt:nowISO()},
      {id:genId(),title:'星际穿越',type:'电影',watchDate:'2025-03-22',status:'已看',cover:'',rating:5,tags:['科幻','诺兰'],review:'爱是唯一可以超越时间与空间的事物',pages:[{id:genId(),elements:[]}],quotes:[],createdAt:nowISO()},
      {id:genId(),title:'海贼王',type:'动漫',watchDate:'2025-06-01',status:'在看',cover:'',rating:5,tags:['热血','冒险'],review:'我不是英雄，我只做我想做的事',pages:[{id:genId(),elements:[]}],quotes:[{id:genId(),content:'人的梦想，是不会结束的！',time:nowISO()}],createdAt:nowISO()},
    ];saveMovies(demo);
  }
}
// ==================== MEDIA SEARCH & PLAYER ====================
const PROXY_BASE = PROXY_URL.replace(/^\ws/, 'http');
let proxyReady = false;
let searchMediaType = 'video'; // 'video' | 'novel'
let lastSearchType = '全部';

// ——— Invisible auto-connect: runs once at init, never shows status ———
let _proxyTimer = null;
let _proxyRetryCount = 0;
const _PROXY_RETRY_FAST = 6;
let _proxyFirstConnectDone = false;

init();
console.log('%c🌳 树洞 · 电子手帐观影管理系统 %c已就绪','color:var(--accent);font-size:16px;','color:var(--text-muted);');

/** Called ONCE at init – invisible background connect */
function initProxyAutoConnect() {
  if (_proxyTimer) return;
  _proxyRetryCount = 0;
  _proxyFirstConnectDone = false;
  _backgroundPing();
  _proxyTimer = setInterval(() => _backgroundPing(), 3000);
}

/** Completely silent – updates proxyReady only, no visible UI */
async function _backgroundPing() {
  try {
    const r = await fetch(`${PROXY_BASE}/api/ping`, { signal: AbortSignal.timeout(3000) });
    if (r.ok) {
      const d = await r.json();
      if (d.status === 'ok') {
        proxyReady = true;
        _proxyRetryCount = 0;
        _proxyFirstConnectDone = true;
        if (_proxyTimer) { clearInterval(_proxyTimer); _proxyTimer = setInterval(() => _backgroundPing(), 30000); }
        return;
      }
    }
  } catch(e) {}

  proxyReady = false;
  _proxyRetryCount++;

  if (_proxyRetryCount > _PROXY_RETRY_FAST) {
    _proxyFirstConnectDone = true;
    if (_proxyTimer) { clearInterval(_proxyTimer); _proxyTimer = setInterval(() => _backgroundPing(), 10000); }
  }
}

/** Manual retry (still silent) */
function retryProxyNow() {
  if (_proxyTimer) { clearInterval(_proxyTimer); _proxyTimer = null; }
  _proxyRetryCount = 0;
  _proxyFirstConnectDone = false;
  _proxyTimer = setInterval(() => _backgroundPing(), 3000);
  _backgroundPing();
}

/** Called from showPage/search – just check state */
async function checkMainProxy() {
  if (!_proxyTimer) { initProxyAutoConnect(); }
  return proxyReady;
}
async function checkProxy() {
  if (!_proxyTimer) { initProxyAutoConnect(); }
  return proxyReady;
}

function switchSearchTab(type, btn) {
  searchMediaType = type;
  document.querySelectorAll('.media-search-tabs button[data-media-type]').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  // Sync between main page tabs and panel tabs
  document.querySelectorAll('.media-search-tabs button[data-media-type="' + type + '"]').forEach(b => b.classList.add('active'));
  // Clear results
  const r1 = document.getElementById('mainSearchResults');
  const r2 = document.getElementById('mediaSearchResults');
  const empty = type === 'video'
    ? '<div class="search-empty"><span style="font-size:40px;display:block;margin-bottom:12px;">🎬</span><p>输入关键词搜索影视片库</p><p style="font-size:0.72rem;">通过代理搜索电影 · 电视剧 · 动漫</p></div>'
    : '<div class="search-empty"><span style="font-size:40px;display:block;margin-bottom:12px;">📖</span><p>搜索或管理你的书籍收藏</p><p style="font-size:0.72rem;">点击下方按钮快速添加书籍到书库</p></div>';
  if (r1) r1.innerHTML = empty;
  if (r2) r2.innerHTML = empty;
}

// Main search page
async function mainSearch() {
  if (searchMediaType === 'video') {
    await mainVideoSearch();
  } else {
    mainNovelSearch();
  }
}

async function mainVideoSearch() {
  const query = document.getElementById('mainSearchInput').value.trim();
  const resultsDiv = document.getElementById('mainSearchResults');
  if (!query) {
    resultsDiv.innerHTML = '<div class="search-empty"><span style="font-size:40px;display:block;margin-bottom:12px;">🎬</span><p>输入关键词搜索影视片库</p></div>';
    return;
  }
  resultsDiv.innerHTML = '<div class="search-loading">⏳ 正在搜索...</div>';
  try {
    const r = await fetch(`${PROXY_BASE}/api/search?q=${encodeURIComponent(query)}`, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    if (data.error) throw new Error(data.error);
    if (!data.results || data.results.length === 0) {
      resultsDiv.innerHTML = `<div class="search-empty"><span style="font-size:40px;">🔍</span><p>未找到 "${esc(query)}" 的结果</p></div>`;
      return;
    }
    renderResults(data.results, 'mainSearchResults');
  } catch (e) {
    resultsDiv.innerHTML = `<div class="search-empty"><span style="font-size:40px;display:block;margin-bottom:8px;">🔍</span><p>搜索失败，请稍后重试</p></div>`;
  }
}

function mainNovelSearch() {
  const query = document.getElementById('mainSearchInput').value.trim().toLowerCase();
  const resultsDiv = document.getElementById('mainSearchResults');
  const ms = loadMovies().filter(m => m.type === '书籍');
  let filtered = ms;
  if (query) filtered = ms.filter(m => m.title.toLowerCase().includes(query));
  if (filtered.length === 0) {
    resultsDiv.innerHTML = `<div class="novel-search-prompt">
      <span class="big-icon">📖</span>
      <p>${query ? `未找到"${esc(query)}"相关书籍` : '你的书籍收藏'}</p>
      <p class="hint">目前有 ${ms.length} 本书籍在库中</p>
      <button class="novel-add-btn" onclick="quickAddNovel()">＋ 添加新书籍</button>
    </div>`;
    return;
  }
  resultsDiv.innerHTML = filtered.map(m => {
    const stars = '★'.repeat(m.rating||0) + '☆'.repeat(5-(m.rating||0));
    return `<div class="media-result-card" style="cursor:pointer;" onclick="openJournalForMovie('${m.id}')">
      <div class="mr-poster">${m.cover ? `<img src="${esc(m.cover)}" onerror="this.innerHTML='📖'">` : '📖'}</div>
      <div class="mr-body">
        <div class="mr-title">${esc(m.title)}</div>
        <div class="mr-meta">${esc(m.type)} · ${fmtDate(m.watchDate)} · ${stars}</div>
        <div class="mr-actions">
          <button onclick="event.stopPropagation();openJournalForMovie('${m.id}')">📒 手帐</button>
        </div>
      </div>
    </div>`;
  }).join('') + `<div style="text-align:center;padding:8px;color:var(--text-muted);font-size:0.65rem;">共 ${filtered.length} 本书籍 · <a href="javascript:quickAddNovel()" style="color:var(--accent2);">＋ 添加新书籍</a></div>`;
}

function quickAddNovel() {
  openAddMovie();
  setTimeout(() => {
    document.getElementById('mType').value = '书籍';
    document.getElementById('mTitle').focus();
  }, 200);
}

// Slide-in panel functions
function openMediaSearch(type) {
  lastSearchType = type || '全部';
  document.getElementById('mediaSearchTitle').textContent = '📺 媒体搜索';
  document.getElementById('mediaSearchPanel').classList.add('show');
  document.getElementById('mediaSearchOverlay').classList.add('show');
  document.getElementById('mediaSearchInput').value = '';
  document.getElementById('mediaSearchResults').innerHTML = `
    <div class="search-empty">
      <span style="font-size:40px;display:block;margin-bottom:12px;">📺</span>
      <p>输入关键词搜索片库</p>
      <p style="font-size:0.7rem;">直接获取片源 · 无需跳转 · 无需额外登录</p>
    </div>`;
  checkProxy();
  setTimeout(() => document.getElementById('mediaSearchInput').focus(), 400);
}

function closeMediaSearch() {
  document.getElementById('mediaSearchPanel').classList.remove('show');
  document.getElementById('mediaSearchOverlay').classList.remove('show');
}

async function tvSearch() {
  const query = document.getElementById('mediaSearchInput').value.trim();
  const resultsDiv = document.getElementById('mediaSearchResults');
  if (!query) {
    resultsDiv.innerHTML = '<div class="search-empty"><span style="font-size:40px;">📺</span><p>输入关键词搜索片库</p></div>';
    return;
  }
  resultsDiv.innerHTML = '<div class="search-loading">⏳ 正在搜索...</div>';
  try {
    const r = await fetch(`${PROXY_BASE}/api/search?q=${encodeURIComponent(query)}`, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    if (data.error) throw new Error(data.error);
    if (!data.results || data.results.length === 0) {
      resultsDiv.innerHTML = `<div class="search-empty"><span style="font-size:40px;">🔍</span><p>未找到 "${esc(query)}" 的结果</p></div>`;
      return;
    }
    let items = data.results;
    if (lastSearchType !== '全部') {
      const typeKeyword = lastSearchType === '影视剧' ? '电视剧' : lastSearchType;
      items = items.filter(it => (it.title||'').includes(typeKeyword) || (it.type||'').includes(typeKeyword) || (it.vod_class||'').includes(typeKeyword));
      if (items.length === 0) items = data.results;
    }
    renderResults(items, 'mediaSearchResults');
  } catch (e) {
    resultsDiv.innerHTML = `<div class="search-empty"><span style="font-size:40px;display:block;margin-bottom:8px;">🔍</span><p>搜索失败，请稍后重试</p></div>`;
  }
}

function renderResults(items, targetId) {
  const resultsDiv = document.getElementById(targetId);
  const html = items.map((r, i) => {
    const title = r.title || r.vod_name || '未知作品';
    const poster = r.poster || r.vod_pic || '';
    const year = r.year || r.vod_year || '';
    const typeName = r.type || r.vod_class || r.type_name || '';
    const notes = r.vod_remarks || r.notes || '';
    const vidId = r.vod_id || r.id || '';
    const safeTitle = esc(title);
    // Capture episodes (m3u8 URLs) and all possible play URL fields
    const episodes = r.episodes || [];
    const rawPlayUrl = r.vod_play_url || r.vod_content || r.vod_play_from || '';
    const itemData = encodeURIComponent(JSON.stringify({
      vod_id: vidId, vod_name: title, vod_pic: poster,
      vod_year: year, vod_class: typeName, vod_play_url: rawPlayUrl,
      vod_remarks: notes, episodes: episodes
    }));
    return `<div class="media-result-card" style="animation:cardIn 0.35s ease-out;animation-delay:${i*0.05}s;cursor:pointer;"
      data-item='${itemData}' title="点击播放「${safeTitle}」">
      <div class="mr-poster">
        ${poster ? `<img src="${esc(poster)}" alt="${safeTitle}" onerror="this.parentElement.innerHTML='🎬'">` : '🎬'}
      </div>
      <div class="mr-body">
        <div class="mr-title">${safeTitle}</div>
        <div class="mr-meta">${[year,typeName,notes].filter(Boolean).join(' · ')}</div>
        <div class="mr-actions">
          <button onclick="event.stopPropagation();quickAddFromSearch('${safeTitle}','${typeName||lastSearchType}','${year}')">＋ 加入收藏</button>
        </div>
      </div>
    </div>`;
  }).join('');
  resultsDiv.innerHTML = html + `<div style="text-align:center;padding:8px 0;color:var(--text-muted);font-size:0.65rem;">共 ${items.length} 条结果 · 来自片库</div>`;
  resultsDiv.querySelectorAll('.media-result-card').forEach(card => {
    card.addEventListener('click', function(e) {
      if (e.target.closest('button') || e.target.closest('.mr-actions')) return;
      const raw = this.dataset.item;
      if (raw) {
        try { const item = JSON.parse(decodeURIComponent(raw)); openPlayer(item); } catch(ex) {}
      }
    });
  });
}

function quickAddFromSearch(title, type, year) {
  closeMediaSearch();
  openAddMovie();
  const typeMap = {电视剧:'电视剧',电影:'电影',动漫:'动漫','':'电影'};
  setTimeout(() => {
    document.getElementById('mTitle').value = title + (year ? ' ('+year+')' : '');
    document.getElementById('mType').value = typeMap[type] || '电影';
    document.getElementById('mReview').focus();
  }, 300);
}

// ==================== PLAYER ====================
let playerMediaRecorder = null;
let playerRecordedChunks = [];
let playerCanvasStream = null;
let playerAnimId = null;
let playerEpisodes = [];
let playerCurrentEpIndex = 0;
let playerCurrentItem = null;

// Parse vod_play_url into [{name, url}, ...] 
// Common formats: "ep1$url1#ep2$url2"  or  "$$$share1$$$ep1$url1#$$$share2$$$ep2$url2"
function parseEpisodes(rawUrl) {
  if (!rawUrl) return [];
  const raw = String(rawUrl).trim();
  if (!raw) return [];
  // Split by # (multiple episodes) or $$ (alternate delimiter)
  let blocks;
  if (raw.includes('#') && raw.split('#').filter(Boolean).length > 1) {
    blocks = raw.split('#');
  } else {
    // Single episode
    blocks = [raw];
  }
  const episodes = [];
  blocks.forEach((block, idx) => {
    block = block.trim();
    if (!block) return;
    let name, url;
    // Try $$$ format: "share_url$$$EpisodeName$real_url"
    if (block.includes('$$$')) {
      const parts = block.split('$$$');
      const lastPart = parts[parts.length - 1];
      const subParts = lastPart.split('$');
      if (subParts.length >= 2) {
        name = subParts[0].trim();
        url = subParts[subParts.length - 1].trim();
      } else {
        name = '第' + (idx + 1) + '集';
        url = parts.find(p => p.startsWith('http')) || lastPart;
      }
    } else {
      // Standard format: "EpisodeName$http://url"
      const dollarIdx = block.indexOf('$');
      if (dollarIdx > 0) {
        name = block.substring(0, dollarIdx).trim();
        url = block.substring(dollarIdx + 1).trim();
        // If name looks like a URL, swap
        if (name.startsWith('http')) {
          const subDollar = url.indexOf('$');
          if (subDollar > 0) {
            name = url.substring(subDollar + 1).trim();
            url = url.substring(0, subDollar).trim();
          } else {
            name = '第' + (idx + 1) + '集';
          }
        }
      } else {
        name = '第' + (idx + 1) + '集';
        url = block.trim();
      }
    }
    // Clean up URL
    url = url.replace(/[\n\r]/g, '').trim();
    if (url.startsWith('http') && url.length > 10) {
      episodes.push({name: name || ('第' + (idx + 1) + '集'), url: url});
    }
  });
  return episodes;
}

function openPlayer(item) {
  const vidId = item.vod_id || item.id || '';
  const title = (item.vod_name || item.title || '未知作品').substring(0, 50);
  const infoParts = [item.vod_year||item.year||'', item.vod_class||item.type||''].filter(Boolean);
  document.getElementById('playerTitle').textContent = '📺 ' + title;
  document.getElementById('playerInfo').textContent = infoParts.length > 0 ? infoParts.join(' · ') : '';
  
  const loading = document.getElementById('playerLoading');
  const error = document.getElementById('playerError');
  const screen = document.getElementById('playerScreen');
  const video = document.getElementById('playerVideo');
  
  loading.style.display = 'flex';
  error.style.display = 'none';
  screen.style.display = 'none';
  video.src = '';
  video.pause();
  stopRecording();
  destroyHls();
  
  document.getElementById('playerOverlay').classList.add('show');
  playerCurrentItem = item;
  
  // Parse episodes from raw play URL (vod_play_url format)
  const rawPlayUrl = item.vod_play_url || item.vod_content || item.vod_play_from || '';
  playerEpisodes = parseEpisodes(rawPlayUrl);
  
  // If no episodes parsed from raw URL, try episodes array from search results
  if (playerEpisodes.length === 0 && (item.episodes || []).length > 0) {
    playerEpisodes = item.episodes.map((url, i) => {
      let name = '第' + (i + 1) + '集';
      let cleanUrl = url;
      // Handle $$$ format
      if (url.includes('$$$')) {
        const parts = url.split('$$$');
        const lastPart = parts[parts.length - 1];
        const subParts = lastPart.split('$');
        if (subParts.length >= 2) {
          name = subParts[0].trim();
          cleanUrl = subParts[subParts.length - 1].trim();
        }
      }
      return {name, url: cleanUrl};
    });
  }
  
  // Render episode selector
  renderEpisodeSelector();
  
  // Play first episode
  if (playerEpisodes.length > 0) {
    playEpisode(0);
    return;
  }
  
  // No episodes parsed → try direct play URL
  let playUrl = extractPlayUrlFromItem(item);
  if (playUrl) {
    console.log('[Player] Using play URL from search result:', playUrl);
    if (playUrl.endsWith('.m3u8')) {
      loadHls(`http://localhost:8765/api/m3u8?url=${encodeURIComponent(playUrl)}`);
    } else {
      loadVideo(playUrl);
    }
    return;
  }
  
  // Fallback: try detail API
  if (!vidId) {
    showPlayerError('缺少视频信息，无法加载播放器');
    return;
  }
  
  // Record detail retry info before fetching
  playerLastAction = {type: 'detail', vidId: vidId, item: item};
  
  console.log('[Player] Fetching detail for vidId:', vidId);
  fetch(`${PROXY_BASE}/api/detail?id=${encodeURIComponent(vidId)}`)
    .then(r => { if (!r.ok) throw new Error(`代理服务返回 ${r.status}`); return r.json(); })
    .then(d => {
      if (d.error) throw new Error(d.error);
      // Try parsing episodes from detail response too
      const detailRawUrl = d.vod_play_url || d.data?.vod_play_url || '';
      playerEpisodes = parseEpisodes(detailRawUrl);
      renderEpisodeSelector();
      if (playerEpisodes.length > 0) {
        playEpisode(0);
        return;
      }
      let url = extractPlayUrlFromDetail(d);
      if (!url) throw new Error('未在返回数据中找到播放地址');
      console.log('[Player] Play URL from detail:', url);
      if (url.endsWith('.m3u8')) {
        loadHls(`http://localhost:8765/api/m3u8?url=${encodeURIComponent(url)}`);
      } else {
        loadVideo(url);
      }
    })
    .catch(e => {
      console.error('[Player] Detail fetch failed:', e);
      showPlayerError('获取播放信息失败: ' + esc(e.message));
    });
}

function playEpisode(index) {
  if (index < 0 || index >= playerEpisodes.length) return;
  playerCurrentEpIndex = index;
  const ep = playerEpisodes[index];
  const title = (playerCurrentItem?.vod_name || playerCurrentItem?.title || '未知作品').substring(0, 50);
  document.getElementById('playerTitle').textContent = '📺 ' + title + ' · ' + ep.name;
  
  // Update active button in selector
  document.querySelectorAll('.ep-selector-btn').forEach((b, i) => {
    b.classList.toggle('active', i === index);
  });
  
  const loading = document.getElementById('playerLoading');
  const error = document.getElementById('playerError');
  const screen = document.getElementById('playerScreen');
  const video = document.getElementById('playerVideo');
  
  loading.style.display = 'flex';
  error.style.display = 'none';
  screen.style.display = 'none';
  video.src = '';
  video.pause();
  stopRecording();
  destroyHls();
  
  let epUrl = ep.url;
  console.log('[Player] Playing episode:', ep.name, epUrl);
  
  // Record last action for retry
  playerLastAction = {type: 'episode', index: index, name: ep.name};
  
  if (epUrl.endsWith('.m3u8')) {
    loadHls(`http://localhost:8765/api/m3u8?url=${encodeURIComponent(epUrl)}`);
  } else if (epUrl.startsWith('http')) {
    // Try as direct video first; if it might be an M3U8, also prepare fallback
    loadVideo(epUrl);
  } else {
    // Last resort: try appending to common base URLs or proxy
    let tried = false;
    const fallbacks = [
      'https://' + epUrl.replace(/^\/+/, ''),
      'http://localhost:8765/api/m3u8?url=' + encodeURIComponent(epUrl.startsWith('http') ? epUrl : 'https://' + epUrl.replace(/^\/+/, ''))
    ];
    for (const fb of fallbacks) {
      if (fb && fb.length > 10) {
        console.log('[Player] Fallback URL:', fb);
        if (fb.includes('/api/m3u8')) {
          loadHls(fb);
        } else {
          loadVideo(fb);
        }
        tried = true;
        break;
      }
    }
    if (!tried) {
      showPlayerError('无法识别的播放地址格式 · ' + ep.name);
    }
  }
}

function renderEpisodeSelector() {
  const container = document.getElementById('episodeSelector');
  if (!container) return;
  if (playerEpisodes.length <= 1) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'flex';
  container.innerHTML = playerEpisodes.map((ep, i) => 
    `<button class="ep-selector-btn${i === 0 ? ' active' : ''}" onclick="playEpisode(${i})" title="${esc(ep.name)}">${esc(ep.name.length > 8 ? ep.name.substring(0,7)+'…' : ep.name)}</button>`
  ).join('');
}

// HLS instance
let hlsInstance = null;

function loadHls(url) {
  const video = document.getElementById('playerVideo');
  const loading = document.getElementById('playerLoading');
  const screen = document.getElementById('playerScreen');
  const error = document.getElementById('playerError');
  
  destroyHls();
  video.src = '';
  loading.style.display = 'flex';
  screen.style.display = 'none';
  error.style.display = 'none';
  
  // Record last action for retry (only if not already set by playEpisode)
  if (!playerLastAction || playerLastAction.type !== 'episode') {
    playerLastAction = {type: 'hls', url: url};
  }
  
  console.log('[HLS] Loading:', url);
  
  // ====== TIMEOUT: show error if nothing loads within 20s ======
  let loadTimeout = setTimeout(() => {
    if (loading.style.display !== 'none') {
      console.error('[HLS] Timeout: no response after 20s');
      destroyHls();
      video.src = '';
      showPlayerError('播放地址加载超时，可能地址已失效，请重新搜索');
    }
  }, 20000);
  
  function cancelTimeout() {
    if (loadTimeout) { clearTimeout(loadTimeout); loadTimeout = null; }
  }
  
  // ====== Retry counter for network errors ======
  let networkRetries = 0;
  const MAX_RETRIES = 3;
  
  if (Hls && Hls.isSupported()) {
    hlsInstance = new Hls({
      // ==== Core ====
      enableWorker: true,
      lowLatencyMode: false,
      // ==== Segment requests go DIRECT to CDN (no proxy bottleneck) ====
      xhrSetup: function(xhr, url) {
        // No CORS needed - CDN segments are fetched natively
        xhr.withCredentials = false;
      },
      // ==== Buffer tuning ====
      maxBufferLength: 30,              // Buffer 30s ahead (reduced from 60)
      maxMaxBufferLength: 120,          // Hard ceiling 120s
      maxBufferSize: 30 * 1000 * 1000,  // ~30MB max buffer
      maxBufferHole: 0.5,
      highBufferWatchdogPeriod: 2,
      // ==== Fragment prefetch ====
      startFragPrefetch: true,
      // ==== Adaptive Bitrate (ABR) - aggressive for CDN ====
      abrEwmaDefaultEstimate: 1000000,  // Start at 1Mbps (CDN is fast)
      abrBandWidthFactor: 0.95,
      abrBandWidthUpFactor: 0.7,
      maxLoadingDelay: 2,               // Down-switch after 2s (faster recovery)
      maxFragLookUpTolerance: 0.25,
      // ==== Retry and resilience ====
      manifestLoadMaxRetry: 3,
      manifestLoadingTimeOut: 15000,
      levelLoadMaxRetry: 3,
      levelLoadingTimeOut: 15000,
      fragLoadMaxRetry: 4,
      fragLoadingTimeOut: 15000,        // 15s per fragment timeout
      appendErrorMaxRetry: 3,
      nudgeMaxRetry: 3,
      nudgeOffset: 0.1,
      // ==== Stalling detection ====
      stallDetectRetry: 4,
      stallDetectInfinite: false,
      // ==== Network ====
      manifestLoadingMaxRetry: 5,
      levelLoadingMaxRetry: 5
    });
    hlsInstance.loadSource(url);
    hlsInstance.attachMedia(video);
    hlsInstance.on(Hls.Events.MANIFEST_PARSED, function(event, data) {
      console.log('[HLS] Manifest parsed, levels:', data.levels, 'ready to play');
      cancelTimeout();
      loading.style.display = 'none';
      screen.style.display = 'flex';
      video.play().catch(() => {});
      // Log available quality levels for debugging
      if (data.levels && data.levels.length > 0) {
        const bitrates = data.levels.map(l => Math.round(l.bitrate / 1000) + 'k').join(', ');
        console.log('[HLS] Available qualities:', bitrates);
      }
    });
    hlsInstance.on(Hls.Events.LEVEL_SWITCHED, function(event, data) {
      if (hlsInstance.levels && hlsInstance.levels[data.level]) {
        const br = Math.round(hlsInstance.levels[data.level].bitrate / 1000);
        const h = hlsInstance.levels[data.level].height || '?';
        console.log('[HLS] Quality switched to:', br + 'kbps', h + 'p');
        document.getElementById('playerInfo').textContent = '🎬 ' + h + 'p · ' + br + 'kbps';
        setTimeout(() => {
          const info = document.getElementById('playerInfo');
          if (info) info.textContent = '';
        }, 5000);
      }
    });
    hlsInstance.on(Hls.Events.FRAG_BUFFERED, function(event, data) {
      // Monitor buffer health
      if (hlsInstance) {
        const bufInfo = hlsInstance.mainForwardBufferInfo;
        if (bufInfo && bufInfo.len < 3) {
          console.warn('[HLS] Buffer low:', Math.round(bufInfo.len * 10) / 10 + 's, may stall');
        }
      }
    });
    hlsInstance.on(Hls.Events.ERROR, function(event, data) {
      if (data.fatal) {
        console.error('[HLS] Fatal error:', data.type, data.details);
        switch(data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            networkRetries++;
            if (networkRetries <= MAX_RETRIES) {
              console.log('[HLS] Network error, retry ' + networkRetries + '/' + MAX_RETRIES + '...');
              hlsInstance.startLoad();
            } else {
              console.error('[HLS] Network retries exhausted');
              destroyHls();
              cancelTimeout();
              showPlayerError('加载视频源失败，请重新搜索或稍后再试');
            }
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            console.log('[HLS] Media error, recovering...');
            hlsInstance.recoverMediaError();
            break;
          default:
            console.error('[HLS] Unrecoverable error, trying fallback');
            destroyHls();
            cancelTimeout();
            // Try direct video element as fallback
            loadVideo(url);
            break;
        }
      } else {
        // Non-fatal: log but continue
        if (data.details === 'bufferStalledError' || data.details === 'bufferNudgeOnStall') {
          console.warn('[HLS] Buffer stalled, nudge recovery...');
          // Auto-recovery: hls.js will handle via nudgeMaxRetry
        } else if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          console.warn('[HLS] Non-fatal network error:', data.details);
        }
      }
    });
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    // Safari native HLS support
    video.src = url;
    video.addEventListener('loadedmetadata', function() {
      cancelTimeout();
      loading.style.display = 'none';
      screen.style.display = 'flex';
    });
    video.addEventListener('error', function() {
      cancelTimeout();
      showPlayerError('视频加载失败，地址可能已失效');
    });
  } else {
    cancelTimeout();
    showPlayerError('当前浏览器不支持HLS播放，请使用Chrome/Edge/Safari');
  }
}

function destroyHls() {
  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }
}

// Extract play URL from search result item (try multiple possible field names)
function extractPlayUrlFromItem(item) {
  // Try multiple candidate fields in order of preference
  const candidates = [
    item.vod_play_url, item.vod_content, item.vod_play_from,
    item.play_url, item.url, item.source_url, item.video_url
  ];
  for (const candidate of candidates) {
    if (!candidate || !String(candidate).trim()) continue;
    const raw = String(candidate).trim();
    // Try resolving directly
    let resolved = resolvePlayUrl(raw);
    if (resolved) return resolved;
    // If raw contains multiple lines or $ delimiters, try extracting URL
    const lines = raw.split(/[\n\r]+/).filter(s => s.trim());
    for (const line of lines) {
      // Try $ delimiter format: "name$url" or "share$$$name$url"
      if (line.includes('$') && !line.startsWith('http')) {
        const parts = line.split('$').filter(Boolean);
        for (const part of parts) {
          resolved = resolvePlayUrl(part.trim());
          if (resolved) return resolved;
        }
      }
      resolved = resolvePlayUrl(line.trim());
      if (resolved) return resolved;
    }
    // Try extracting any http/https URL from the raw string using regex
    const urlMatch = raw.match(/(https?:\/\/[^\s"'#$$]+)/);
    if (urlMatch) {
      resolved = resolvePlayUrl(urlMatch[1]);
      if (resolved) return resolved;
    }
  }
  return '';
}

// Extract play URL from detail API response
function extractPlayUrlFromDetail(d) {
  let url = '';
  const data = d.data || d;
  const candidates = [
    data.vod_play_url,
    data.vod_content,
    data.play_url,
    data.url,
    data.source_url,
    data.video_url
  ];
  for (const candidate of candidates) {
    if (!candidate || !String(candidate).trim()) continue;
    url = String(candidate).trim();
    break;
  }
  if (!url) return '';
  const lines = url.split(/[\n\r]+/).filter(s => s.trim());
  if (lines.length === 0) return '';
  const first = lines[0].trim();
  const parts = first.split('$');
  let resolved = parts.length > 1 ? parts[1].trim() : parts[0].trim();
  const hashIdx = resolved.indexOf('#');
  if (hashIdx > 0) resolved = resolved.substring(0, hashIdx);
  return resolvePlayUrl(resolved);
}

// Final resolution: validate and normalize play URL, robust for messy data
function resolvePlayUrl(url) {
  if (!url) return '';
  url = String(url).trim();
  if (!url) return '';
  // Already valid
  if (url.startsWith('http://') || url.startsWith('https://')) {
    // Basic sanity: URL must be longer than just the protocol
    if (url.length > 10) return url;
    return '';
  }
  // Protocol-relative URL
  if (url.startsWith('//') && url.length > 5) return 'https:' + url;
  // Relative path — not usable directly
  if (url.startsWith('/')) return '';
  // Try extracting URL from a blob of text (common in malformed data)
  const urlMatch = url.match(/(https?:\/\/[^\s"'#$]+)/);
  if (urlMatch && urlMatch[1].length > 10) return urlMatch[1];
  // Try protocol-relative URL extraction
  const protoRelMatch = url.match(/(\/\/[^\s"'#$]+)/);
  if (protoRelMatch && protoRelMatch[1].length > 5) return 'https:' + protoRelMatch[1];
  return '';
}

function loadVideo(url) {
  const video = document.getElementById('playerVideo');
  const loading = document.getElementById('playerLoading');
  const screen = document.getElementById('playerScreen');
  
  video.onerror = null;
  video.onloadedmetadata = null;
  video.src = '';
  video.removeAttribute('crossorigin');
  
  video.setAttribute('crossorigin', 'anonymous');
  loading.style.display = 'flex';
  screen.style.display = 'none';
  
  // Record last action for retry
  if (!playerLastAction || playerLastAction.type !== 'episode') {
    playerLastAction = {type: 'video', url: url};
  }
  
  // ====== TIMEOUT: show error if nothing loads within 25s ======
  let loadTimeout = setTimeout(() => {
    if (loading.style.display !== 'none') {
      console.error('[Video] Timeout: no response after 25s');
      video.src = '';
      showPlayerError('视频加载超时，地址可能已失效，请重试或重新搜索');
    }
  }, 25000);
  
  function cancelTimeout() {
    if (loadTimeout) { clearTimeout(loadTimeout); loadTimeout = null; }
  }
  
  video.onloadedmetadata = function() {
    cancelTimeout();
    loading.style.display = 'none';
    screen.style.display = 'flex';
  };
  
  video.onerror = function() {
    if (video.hasAttribute('crossorigin')) {
      video.removeAttribute('crossorigin');
      video.onerror = function() {
        cancelTimeout();
        loading.style.display = 'none';
        screen.style.display = 'flex';
      };
      video.onloadedmetadata = function() {
        cancelTimeout();
        loading.style.display = 'none';
        screen.style.display = 'flex';
      };
      video.src = url;
      video.load();
      return;
    }
    cancelTimeout();
    showPlayerError('视频加载失败，可能需代理或播放地址已失效');
  };
  
  video.src = url;
  video.load();
  setTimeout(() => {
    if (video.readyState >= 1) {
      cancelTimeout();
      loading.style.display = 'none';
      screen.style.display = 'flex';
    }
  }, 800);
}

function onVideoReady() {
  document.getElementById('playerLoading').style.display = 'none';
  document.getElementById('playerScreen').style.display = 'flex';
}

function onVideoError() {
  const video = document.getElementById('playerVideo');
  if (video.hasAttribute('crossorigin')) {
    const src = video.src;
    video.removeAttribute('crossorigin');
    video.onerror = function() { showPlayerError('视频加载失败'); };
    video.onloadedmetadata = function() {
      document.getElementById('playerLoading').style.display = 'none';
      document.getElementById('playerScreen').style.display = 'flex';
    };
    video.src = src;
    video.load();
    return;
  }
  showPlayerError('视频加载失败，可能需代理或播放地址已失效');
}

// Track last playback action for retry capability
let playerLastAction = null; // {type:'episode'|'hls'|'video'|'detail', ...args}

function showPlayerError(msg) {
  document.getElementById('playerLoading').style.display = 'none';
  document.getElementById('playerScreen').style.display = 'none';
  const err = document.getElementById('playerError');
  err.style.display = 'flex';
  // Build retry UI based on last action type
  let retryHtml = '';
  if (playerLastAction) {
    if (playerLastAction.type === 'episode') {
      retryHtml = `<button onclick="retryEpisode()" style="margin:12px 8px 0;padding:10px 22px;border:1px solid var(--accent);background:var(--accent);color:#fff;border-radius:20px;cursor:pointer;font-size:14px;">🔄 重试播放 · ${esc(playerEpisodes[playerCurrentEpIndex]?.name||'')}</button>`;
    } else if (playerLastAction.type === 'hls') {
      retryHtml = `<button onclick="retryHls()" style="margin:12px 8px 0;padding:10px 22px;border:1px solid var(--accent);background:var(--accent);color:#fff;border-radius:20px;cursor:pointer;font-size:14px;">🔄 重试HLS加载</button>`;
    } else if (playerLastAction.type === 'video') {
      retryHtml = `<button onclick="retryVideo()" style="margin:12px 8px 0;padding:10px 22px;border:1px solid var(--accent);background:var(--accent);color:#fff;border-radius:20px;cursor:pointer;font-size:14px;">🔄 重试视频加载</button>`;
    } else if (playerLastAction.type === 'detail') {
      retryHtml = `<button onclick="retryDetail()" style="margin:12px 8px 0;padding:10px 22px;border:1px solid var(--accent);background:var(--accent);color:#fff;border-radius:20px;cursor:pointer;font-size:14px;">🔄 重试详情请求</button>`;
    }
    retryHtml += `<button onclick="closePlayer()" style="margin:12px 8px 0;padding:10px 22px;border:1px solid var(--border);background:transparent;color:var(--text-muted);border-radius:20px;cursor:pointer;font-size:14px;">✕ 关闭</button>`;
  }
  err.innerHTML = `<span style="font-size:36px;">⚠️</span><p>${msg}</p>${retryHtml}`;
}

function retryEpisode() {
  if (playerLastAction && playerLastAction.type === 'episode') {
    const idx = playerLastAction.index ?? 0;
    if (playerEpisodes.length > idx) {
      const loading = document.getElementById('playerLoading');
      const error = document.getElementById('playerError');
      error.style.display = 'none';
      loading.style.display = 'flex';
      playEpisode(idx);
      return;
    }
  }
  // Fallback: re-open player
  if (playerCurrentItem) {
    const error = document.getElementById('playerError');
    error.style.display = 'none';
    document.getElementById('playerLoading').style.display = 'flex';
    openPlayer(playerCurrentItem);
  }
}

function retryHls() {
  if (playerLastAction && playerLastAction.type === 'hls') {
    const url = playerLastAction.url;
    if (url) {
      const error = document.getElementById('playerError');
      error.style.display = 'none';
      document.getElementById('playerLoading').style.display = 'flex';
      loadHls(url);
      return;
    }
  }
  retryEpisode();
}

function retryVideo() {
  if (playerLastAction && playerLastAction.type === 'video') {
    const url = playerLastAction.url;
    if (url) {
      const error = document.getElementById('playerError');
      error.style.display = 'none';
      document.getElementById('playerLoading').style.display = 'flex';
      loadVideo(url);
      return;
    }
  }
  retryEpisode();
}

function retryDetail() {
  if (playerLastAction && playerLastAction.type === 'detail') {
    const vidId = playerLastAction.vidId;
    const item = playerLastAction.item;
    if (vidId || item) {
      const error = document.getElementById('playerError');
      error.style.display = 'none';
      document.getElementById('playerLoading').style.display = 'flex';
      // Re-use openPlayer logic by calling back into the same fallback path
      playerEpisodes = [];
      playerCurrentEpIndex = 0;
      if (vidId) {
        const targetItem = item || {vod_id: vidId, vod_name: playerCurrentItem?.vod_name || ''};
        openPlayer(targetItem);
      } else {
        openPlayer(item);
      }
      return;
    }
  }
  // Final fallback
  if (playerCurrentItem) {
    openPlayer(playerCurrentItem);
  }
}

function closePlayer() {
  stopRecording();
  destroyHls();
  const video = document.getElementById('playerVideo');
  video.pause();
  video.src = '';
  document.getElementById('playerOverlay').classList.remove('show');
  playerEpisodes = [];
  playerCurrentEpIndex = 0;
  playerCurrentItem = null;
  const epSel = document.getElementById('episodeSelector');
  if (epSel) { epSel.style.display = 'none'; epSel.innerHTML = ''; }
}

let playerRecordStart = 0;
let playerRecordTimerId = null;
let playerRecordCanvas = null;
let playerRecordCtx = null;

function takeScreenshot() {
  const video = document.getElementById('playerVideo');
  if (!video || video.readyState < 2) { showToast('视频未就绪，无法截图'); return; }
  try {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || video.clientWidth;
    canvas.height = video.videoHeight || video.clientHeight;
    if (!canvas.width || !canvas.height) { showToast('无法获取画面尺寸'); return; }
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    saveCanvas(canvas, `树洞截图_${new Date().toISOString().replace(/[:.]/g,'-').slice(0,19)}.png`);
  } catch (e) {
    console.error('[Screenshot] Error:', e);
    showToast('截图失败: ' + e.message);
  }
}

function toggleRecording() {
  const btn = document.getElementById('btnRecord');
  if (playerMediaRecorder && playerMediaRecorder.state === 'recording') {
    // Stop recording
    playerMediaRecorder.stop();
    return;
  }
  // Start recording
  startRecording();
}

function startRecording() {
  const video = document.getElementById('playerVideo');
  if (!video || video.readyState < 2) { showToast('视频未就绪，无法录制'); return; }
  if (!window.MediaRecorder) { showToast('当前浏览器不支持录制功能'); return; }

  playerRecordedChunks = [];

  // Create canvas for capturing video frames
  playerRecordCanvas = document.createElement('canvas');
  playerRecordCanvas.width = video.videoWidth || video.clientWidth || 640;
  playerRecordCanvas.height = video.videoHeight || video.clientHeight || 360;
  playerRecordCtx = playerRecordCanvas.getContext('2d');

  // Capture video as canvas stream at ~25fps
  const stream = playerRecordCanvas.captureStream(25);
  playerCanvasStream = stream;

  // Add audio track if available
  try {
    if (video.captureStream) {
      const videoStream = video.captureStream();
      const audioTracks = videoStream.getAudioTracks();
      if (audioTracks.length > 0) {
        stream.addTrack(audioTracks[0]);
      }
    }
  } catch (e) {
    console.log('[Record] Could not capture audio track:', e.message);
  }

  // Determine mime type
  let mimeType = 'video/webm;codecs=vp8,opus';
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/webm;codecs=vp8';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/mp4';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          showToast('浏览器不支持任何录制格式');
          return;
        }
      }
    }
  }

  try {
    playerMediaRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2500000 });
  } catch (e) {
    playerMediaRecorder = new MediaRecorder(stream, { videoBitsPerSecond: 2500000 });
  }

  playerMediaRecorder.ondataavailable = function(e) {
    if (e.data && e.data.size > 0) playerRecordedChunks.push(e.data);
  };

  playerMediaRecorder.onstop = function() {
    finalizeRecording();
    // Reset UI
    const btn = document.getElementById('btnRecord');
    btn.classList.remove('recording');
    btn.innerHTML = '⏺ 录制';
    btn.disabled = false;
    syncFsRecordUI(false);
    // Stop canvas draw loop
    if (playerAnimId) { cancelAnimationFrame(playerAnimId); playerAnimId = null; }
    // Clean up
    playerMediaRecorder = null;
    playerCanvasStream = null;
    playerRecordCanvas = null;
    playerRecordCtx = null;
    // Hide timer
    const timerEl = document.getElementById('recordTimer');
    timerEl.style.display = 'none';
    if (playerRecordTimerId) { clearInterval(playerRecordTimerId); playerRecordTimerId = null; }
  };

  // Start canvas draw loop
  function drawFrame() {
    if (playerRecordCanvas && playerRecordCtx && video.readyState >= 2) {
      playerRecordCtx.drawImage(video, 0, 0, playerRecordCanvas.width, playerRecordCanvas.height);
    }
    playerAnimId = requestAnimationFrame(drawFrame);
  }
  drawFrame();

  playerMediaRecorder.start(200); // collect data every 200ms
  playerRecordStart = Date.now();

  // Update UI
  btn.classList.add('recording');
  btn.innerHTML = '⏹ 停止';
  btn.disabled = false;
  syncFsRecordUI(true);

  // Start timer display
  const timerEl = document.getElementById('recordTimer');
  timerEl.style.display = 'inline';
  timerEl.textContent = '● 00:00';
  playerRecordTimerId = setInterval(() => {
    const elapsed = Math.floor((Date.now() - playerRecordStart) / 1000);
    const min = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const sec = String(elapsed % 60).padStart(2, '0');
    const text = '● ' + min + ':' + sec;
    timerEl.textContent = text;
    syncFsRecordTimer(text);
  }, 500);

  showToast('录制已开始 ⏺');
}

function finalizeRecording() {
  if (playerRecordedChunks.length === 0) return;
  var filename = '树洞录制_' + new Date().toISOString().replace(/[:.]/g,'-').slice(0,19) + '.webm';
  var blob = new Blob(playerRecordedChunks, { type: playerMediaRecorder ? playerMediaRecorder.mimeType : 'video/webm' });
  playerRecordedChunks = [];
  // Try mobile save first
  if (navigator.share && navigator.canShare) {
    var file = new File([blob], filename, { type: 'video/webm' });
    if (navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: filename }).then(function() {
        showToast('录制完成，视频已分享 ✓');
      }).catch(function() {
        fallbackDownload(blob, filename);
      });
      return;
    }
  }
  fallbackDownload(blob, filename);
  showToast('录制完成，视频已保存 ✓');
}

function stopRecording() {
  if (playerMediaRecorder && playerMediaRecorder.state === 'recording') {
    playerMediaRecorder.stop();
  }
  if (playerAnimId) { cancelAnimationFrame(playerAnimId); playerAnimId = null; }
  if (playerRecordTimerId) { clearInterval(playerRecordTimerId); playerRecordTimerId = null; }
  const timerEl = document.getElementById('recordTimer');
  if (timerEl) timerEl.style.display = 'none';
  const btn = document.getElementById('btnRecord');
  if (btn) { btn.classList.remove('recording'); btn.innerHTML = '⏺ 录制'; btn.disabled = false; }
  syncFsRecordUI(false);
  playerMediaRecorder = null;
  playerCanvasStream = null;
  playerRecordCanvas = null;
  playerRecordCtx = null;
  playerRecordedChunks = [];
}

// ==================== PLAYER FULLSCREEN & KEYBOARD ====================
let isPlayerFs = false; // true when #playerScreen is the browser fullscreen element

function togglePlayerFullscreen() {
  const screen = document.getElementById('playerScreen');
  if (!screen || screen.style.display === 'none') return;
  if (isPlayerFs) {
    exitPlayerFullscreen();
    return;
  }
  // Try Fullscreen API on #playerScreen – video + toolbar both visible
  try {
    if (screen.requestFullscreen) {
      screen.requestFullscreen();
    } else if (screen.webkitRequestFullscreen) {
      screen.webkitRequestFullscreen();
    } else {
      // Fallback: CSS window fullscreen
      fallbackCssFs(true);
    }
  } catch (e) {
    console.warn('[Fullscreen] API failed, using CSS fallback:', e);
    fallbackCssFs(true);
  }
}

function exitPlayerFullscreen() {
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    try {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    } catch (e) {}
  }
  fallbackCssFs(false);
}

function fallbackCssFs(on) {
  const modal = document.querySelector('.player-modal');
  const btn = document.getElementById('btnFullWin');
  const toolbar = document.getElementById('playerFsToolbar');
  if (!modal) return;
  if (on) {
    modal.classList.add('fullscreen-modal');
    if (btn) btn.innerHTML = '⛶ 退出';
    // Show toolbar in CSS fallback mode too
    if (toolbar) { toolbar.classList.add('visible'); toolbar.classList.remove('fade-out'); }
    isPlayerFs = true;
  } else {
    modal.classList.remove('fullscreen-modal');
    if (btn) btn.innerHTML = '⛶ 全屏';
    if (toolbar) toolbar.classList.remove('visible', 'fade-out');
    isPlayerFs = false;
  }
}

function onFsChange() {
  const screen = document.getElementById('playerScreen');
  const toolbar = document.getElementById('playerFsToolbar');
  const btn = document.getElementById('btnFullWin');
  const fsEl = document.fullscreenElement || document.webkitFullscreenElement;

  // Determine if #playerScreen (or its child video) is the fullscreen element
  isPlayerFs = !!(fsEl && (fsEl === screen || screen.contains(fsEl)));

  if (isPlayerFs) {
    // Browser fullscreen active on playerScreen — show floating toolbar
    if (toolbar) {
      toolbar.classList.add('visible');
      toolbar.classList.remove('fade-out');
      resetFsAutoHide();
    }
    if (btn) btn.innerHTML = '⛶ 退出';
  } else {
    // Exited fullscreen or fullscreen on unrelated element
    if (toolbar) {
      toolbar.classList.remove('visible', 'fade-out');
      clearFsAutoHide();
    }
    if (btn) btn.innerHTML = '⛶ 全屏';
    // Also remove CSS fallback if present
    const modal = document.querySelector('.player-modal');
    if (modal) modal.classList.remove('fullscreen-modal');
  }
}

let _fsHideTimer = null;
function clearFsAutoHide() {
  if (_fsHideTimer) { clearTimeout(_fsHideTimer); _fsHideTimer = null; }
}
function resetFsAutoHide() {
  clearFsAutoHide();
  _fsHideTimer = setTimeout(() => {
    const toolbar = document.getElementById('playerFsToolbar');
    if (toolbar) toolbar.classList.add('fade-out');
  }, 4000);
}

function onPlayerScreenMouseMove() {
  const toolbar = document.getElementById('playerFsToolbar');
  if (!toolbar || !isPlayerFs) return;
  toolbar.classList.remove('fade-out');
  resetFsAutoHide();
}

function syncFsRecordUI(recording) {
  const btn = document.getElementById('btnFsRecord');
  const timer = document.getElementById('fsRecordTimer');
  if (!btn) return;
  if (recording) {
    btn.classList.add('recording');
    btn.innerHTML = '⏹ 停止';
    if (timer) timer.classList.add('show');
  } else {
    btn.classList.remove('recording');
    btn.innerHTML = '⏺ 录制';
    if (timer) timer.classList.remove('show');
  }
}

function syncFsRecordTimer(text) {
  const timer = document.getElementById('fsRecordTimer');
  if (timer && timer.classList.contains('show')) timer.textContent = text;
}

function onPlayerKey(e) {
  const overlay = document.getElementById('playerOverlay');
  if (!overlay || !overlay.classList.contains('show')) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
  const k = e.key.toLowerCase();
  if (k === 's') { e.preventDefault(); takeScreenshot(); }
  else if (k === 'r') { e.preventDefault(); toggleRecording(); }
  else if (k === 'f') { e.preventDefault(); togglePlayerFullscreen(); }
  else if (k === 'escape' && isPlayerFs) {
    // Let browser handle native fullscreen exit; onFsChange will clean up
  }
}

// Register fullscreen & keyboard listeners
document.addEventListener('fullscreenchange', onFsChange);
document.addEventListener('webkitfullscreenchange', onFsChange);
document.addEventListener('keydown', onPlayerKey);
document.getElementById('playerScreen').addEventListener('mousemove', onPlayerScreenMouseMove);
document.getElementById('playerScreen').addEventListener('touchstart', onPlayerScreenMouseMove);

// ==================== ARCHIVE (IndexedDB based) ====================
const ARCHIVE_DB = 'TreeholeArchive';
const ARCHIVE_STORE = 'files';
let archiveDB = null;

function openArchiveDB() {
  return new Promise((resolve, reject) => {
    if (archiveDB) return resolve(archiveDB);
    const req = indexedDB.open(ARCHIVE_DB, 1);
    req.onupgradeneeded = function(e) {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(ARCHIVE_STORE)) {
        db.createObjectStore(ARCHIVE_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = function(e) { archiveDB = e.target.result; resolve(archiveDB); };
    req.onerror = function(e) { reject(e.target.error); };
  });
}

function saveArchiveItem(item) {
  return openArchiveDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ARCHIVE_STORE, 'readwrite');
      const store = tx.objectStore(ARCHIVE_STORE);
      store.put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  });
}

function getAllArchiveItems() {
  return openArchiveDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ARCHIVE_STORE, 'readonly');
      const store = tx.objectStore(ARCHIVE_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = (e) => reject(e.target.error);
    });
  });
}

function deleteArchiveItem(id) {
  return openArchiveDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ARCHIVE_STORE, 'readwrite');
      const store = tx.objectStore(ARCHIVE_STORE);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  });
}

// ==================== ARCHIVE UI ====================
let archiveViewYear, archiveViewMonth;
let archiveNameResolve = null;
let archivePendingBlob = null;
let archivePendingType = null;
let archiveMoveItemId = null;
let archiveMoveSourceDate = null;

function initArchiveDate() {
  const now = new Date();
  archiveViewYear = now.getFullYear();
  archiveViewMonth = now.getMonth() + 1;
}

function renderArchive() {
  if (!archiveViewYear) initArchiveDate();
  document.getElementById('archiveMonthLabel').textContent = archiveViewYear + '年' + archiveViewMonth + '月';
  getAllArchiveItems().then(items => {
    const today = new Date();
    const todayStr = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');
    
    // Group items by date
    const byDate = {};
    items.forEach(item => {
      const d = item.date ? item.date.slice(0, 10) : '未知';
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push(item);
    });

    // Build calendar
    const firstDay = new Date(archiveViewYear, archiveViewMonth - 1, 1);
    const lastDay = new Date(archiveViewYear, archiveViewMonth, 0);
    const startDow = firstDay.getDay(); // 0=Sun
    const daysInMonth = lastDay.getDate();
    const prevLastDay = new Date(archiveViewYear, archiveViewMonth - 1, 0).getDate();

    let html = '<tr><th>日</th><th>一</th><th>二</th><th>三</th><th>四</th><th>五</th><th>六</th></tr><tr>';
    let cellCount = 0;

    // Previous month fill
    for (let i = 0; i < startDow; i++) {
      const d = prevLastDay - startDow + i + 1;
      html += `<td class="other-month"><div class="day-num">${d}</div></td>`;
      cellCount++;
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      if (cellCount % 7 === 0 && cellCount > 0) html += '</tr><tr>';
      const dateStr = archiveViewYear + '-' + String(archiveViewMonth).padStart(2,'0') + '-' + String(d).padStart(2,'0');
      const dayItems = byDate[dateStr] || [];
      const isToday = dateStr === todayStr;
      let cellClass = isToday ? 'today' : '';
      html += `<td class="${cellClass}" onclick="openArchiveDetail('${dateStr}')">
        <div class="day-num">${d}</div>`;
      if (dayItems.length > 0) {
        html += '<div class="archive-day-thumbs">';
        const showItems = dayItems.slice(0, 3);
        showItems.forEach(item => {
          if (item.type === 'screenshot' && item.thumbnail) {
            html += `<div class="archive-day-thumb"><img src="${item.thumbnail}" alt=""></div>`;
          } else if (item.type === 'video') {
            html += `<div class="archive-day-thumb video-thumb">▶</div>`;
          } else {
            html += `<div class="archive-day-thumb">📷</div>`;
          }
        });
        if (dayItems.length > 3) html += `<div class="archive-day-more">+${dayItems.length - 3}</div>`;
        html += '</div>';
      }
      html += '</td>';
      cellCount++;
    }

    // Next month fill
    while (cellCount % 7 !== 0) {
      const nd = cellCount - daysInMonth - startDow + 1;
      html += `<td class="other-month"><div class="day-num">${nd}</div></td>`;
      cellCount++;
    }
    html += '</tr>';

    document.getElementById('archiveCalendar').innerHTML = html;
    document.getElementById('archiveEmpty').style.display = items.length === 0 ? 'block' : 'none';
  }).catch(e => {
    console.error('[Archive] Error loading items:', e);
    document.getElementById('archiveCalendar').innerHTML = '';
    document.getElementById('archiveEmpty').style.display = 'block';
  });
}

function archivePrevMonth() {
  if (archiveViewMonth === 1) { archiveViewMonth = 12; archiveViewYear--; }
  else archiveViewMonth--;
  renderArchive();
}

function archiveNextMonth() {
  if (archiveViewMonth === 12) { archiveViewMonth = 1; archiveViewYear++; }
  else archiveViewMonth++;
  renderArchive();
}

function archiveToday() {
  const now = new Date();
  archiveViewYear = now.getFullYear();
  archiveViewMonth = now.getMonth() + 1;
  renderArchive();
}

function openArchiveDetail(dateStr) {
  getAllArchiveItems().then(items => {
    const dayItems = items.filter(item => item.date && item.date.startsWith(dateStr));
    if (dayItems.length === 0) return;
    document.getElementById('archiveDetailTitle').textContent = '📅 ' + dateStr + ' · ' + dayItems.length + ' 个文件';
    let gridHtml = '';
    dayItems.forEach(item => {
      const escName = esc(item.name || '未命名');
      const typeLabel = item.type === 'video' ? '🎬 录制' : '📷 截图';
      gridHtml += `<div class="archive-item-card">
        <div class="archive-item-preview">
          ${item.type === 'video'
            ? (item.thumbnail ? `<img src="${item.thumbnail}" alt=""><div class="type-badge">🎬</div>` : `<div style="font-size:2rem;">🎬</div>`)
            : (item.thumbnail ? `<img src="${item.thumbnail}" alt=""><div class="type-badge">📷</div>` : '<div style="font-size:2rem;">📷</div>')}
        </div>
        <div class="archive-item-info">
          <div class="archive-item-name">${escName}</div>
          <div class="archive-item-date">${typeLabel} · ${item.date ? item.date.slice(11,19) : ''}</div>
        </div>
        <div class="archive-item-actions">
          <button onclick="downloadArchiveItem('${item.id}')" title="下载">⬇ 下载</button>
          <button class="move-btn" onclick="openMoveArchiveItemDialog('${item.id}','${dateStr}','${esc(item.name || '未命名')}')" title="移动到其他日期">📅 移动</button>
          <button class="del-btn" onclick="deleteArchiveItemConfirm('${item.id}','${dateStr}')" title="删除">✕ 删除</button>
        </div>
      </div>`;
    });
    document.getElementById('archiveDetailGrid').innerHTML = gridHtml;
    document.getElementById('archiveDetailOverlay').classList.add('show');
  }).catch(e => console.error('[Archive] Detail error:', e));
}

function closeArchiveDetail() {
  document.getElementById('archiveDetailOverlay').classList.remove('show');
}

// ==================== ARCHIVE MOVE ITEM ====================
function openMoveArchiveItemDialog(id, sourceDate, name) {
  archiveMoveItemId = id;
  archiveMoveSourceDate = sourceDate;
  document.getElementById('archiveMoveInfo').textContent = '将「' + name + '」从 ' + sourceDate + ' 移动到：';
  // Default to today's date
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('archiveMoveDate').value = today;
  document.getElementById('archiveMoveOverlay').classList.add('show');
}

function closeMoveArchiveItemDialog() {
  document.getElementById('archiveMoveOverlay').classList.remove('show');
  archiveMoveItemId = null;
  archiveMoveSourceDate = null;
}

function confirmMoveArchiveItem() {
  const newDateStr = document.getElementById('archiveMoveDate').value;
  if (!newDateStr || !archiveMoveItemId) return;
  
  openArchiveDB().then(db => {
    const tx = db.transaction(ARCHIVE_STORE, 'readwrite');
    const store = tx.objectStore(ARCHIVE_STORE);
    const req = store.get(archiveMoveItemId);
    req.onsuccess = function() {
      const item = req.result;
      if (!item) { showToast('文件不存在'); return; }
      // Preserve the time portion of the old date, only change the date part
      const oldDate = item.date || new Date().toISOString();
      const oldTime = oldDate.slice(10); // "T15:54:00.000Z"
      item.date = newDateStr + oldTime;
      const putReq = store.put(item);
      putReq.onsuccess = function() {
        closeMoveArchiveItemDialog();
        // Refresh both the detail view and the calendar
        if (archiveViewYear) renderArchive();
        const overlay = document.getElementById('archiveDetailOverlay');
        if (overlay.classList.contains('show')) {
          // Re-open detail with the source date (items may now be empty there)
          openArchiveDetail(archiveMoveSourceDate);
        }
        showToast('已移动到 ' + newDateStr + ' ✓');
      };
      putReq.onerror = function() { showToast('移动失败'); };
    };
    req.onerror = function() { showToast('读取文件失败'); };
  });
}

// ==================== ARCHIVE PICKER: Import archive screenshots into journal or cover ====================
function openArchivePicker(mode) {
  archivePickerMode = mode || 'journal';

  // Update UI based on mode
  const titleEl = document.getElementById('archivePickerTitle');
  const actionsEl = document.getElementById('archivePickerActions');
  const pcBtn = document.getElementById('archivePickerPcBtn');

  if (archivePickerMode === 'cover') {
    titleEl.textContent = '📦 从档案馆导入封面';
    pcBtn.textContent = '💻 从电脑选择';
    pcBtn.onclick = function() { closeArchivePicker(); document.getElementById('mCoverFile').click(); };
  } else {
    if (!currentJournalMovieId) { showToast('请先打开一篇手帐'); return; }
    titleEl.textContent = '📦 从档案馆导入截图';
    pcBtn.textContent = '💻 从电脑导入';
    pcBtn.onclick = function() { closeArchivePicker(); addImageToJournal(); };
  }

  const overlay = document.getElementById('archivePickerOverlay');
  const grid = document.getElementById('archivePickerGrid');
  const empty = document.getElementById('archivePickerEmpty');
  const countEl = document.getElementById('archivePickerCount');

  overlay.classList.add('show');
  grid.innerHTML = '';
  empty.style.display = 'none';
  countEl.textContent = '加载中...';

  getAllArchiveItems().then(items => {
    const screenshots = items.filter(item => item.type === 'screenshot').sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    if (screenshots.length === 0) {
      empty.style.display = 'block';
      countEl.textContent = '';
      return;
    }
    countEl.textContent = '共 ' + screenshots.length + ' 张截图 · 点击缩略图直接' + (archivePickerMode === 'cover' ? '设为封面' : '插入');
    let html = '';
    screenshots.forEach(item => {
      const escName = esc(item.name || '未命名');
      const d = item.date ? item.date.slice(0, 10) : '';
      const clickFn = archivePickerMode === 'cover' ? `importArchiveCover('${item.id}')` : `importFromArchiveToJournal('${item.id}')`;
      html += `<div class="archive-picker-card" onclick="${clickFn}" title="${escName}">
        <div class="picker-preview">
          ${item.thumbnail ? `<img src="${item.thumbnail}" alt="">` : '<div class="picker-icon">📷</div>'}
        </div>
        <div class="picker-name">${escName}</div>
        <div class="picker-date">${d}</div>
      </div>`;
    });
    grid.innerHTML = html;
  }).catch(e => {
    console.error('[ArchivePicker] Error:', e);
    showToast('加载档案馆失败');
    closeArchivePicker();
  });
}

function openArchiveCoverPicker() {
  openArchivePicker('cover');
}

function closeArchivePicker() {
  document.getElementById('archivePickerOverlay').classList.remove('show');
}

// Mobile camera/gallery upload for archive picker → save to archive + use depending on mode
function handleArchivePickerCameraUpload(e) {
  const f = e.target.files[0]; if (!f) return;
  handleArchivePickerFile(f);
  e.target.value = '';
}
function handleArchivePickerGalleryUpload(e) {
  const f = e.target.files[0]; if (!f) return;
  handleArchivePickerFile(f);
  e.target.value = '';
}
function handleArchivePickerFile(file) {
  const reader = new FileReader();
  reader.onload = function(ev) {
    const dataUrl = ev.target.result;
    if (archivePickerMode === 'cover') {
      // Use as cover image: fill cover preview and data
      uploadedCoverData = dataUrl;
      document.getElementById('mCoverPreview').src = dataUrl;
      document.getElementById('mCoverPreview').style.display = 'block';
      document.getElementById('mCover').value = ''; // clear URL field
      closeArchivePicker();
      showToast('封面已选择 ✓');
    } else {
      // Journal mode: insert into current page
      const m = getMovie(currentJournalMovieId);
      if (!m) { closeArchivePicker(); return; }
      const page = m.pages[currentJournalPageIdx];
      saveJournalHistory();
      const img = new Image();
      img.onload = function() {
        const maxW = 500; let w = img.width, h = img.height;
        if (w > maxW) { h = h * maxW / w; w = maxW; }
        page.elements.push({
          id: genId(), type: 'image', src: dataUrl,
          x: 20 + page.elements.length * 30, y: 20 + page.elements.length * 20,
          w: Math.round(w), h: Math.round(h), rotation: 0, zIndex: page.elements.length + 1
        });
        updateMovie(currentJournalMovieId, { pages: m.pages });
        renderJournalPage();
        closeArchivePicker();
        showToast('图片已添加到手帐 ✓');
      };
      img.src = dataUrl;
    }
  };
  reader.readAsDataURL(file);
}

function importFromArchiveToJournal(id) {
  openArchiveDB().then(db => {
    const tx = db.transaction(ARCHIVE_STORE, 'readonly');
    const store = tx.objectStore(ARCHIVE_STORE);
    const req = store.get(id);
    req.onsuccess = function() {
      const item = req.result;
      if (!item || !item.data) { showToast('文件数据不存在'); return; }
      // Convert blob to data URL for journal insertion
      const reader = new FileReader();
      reader.onload = function(ev) {
        const dataUrl = ev.target.result;
        const m = getMovie(currentJournalMovieId);
        if (!m) return;
        const page = m.pages[currentJournalPageIdx];
        saveJournalHistory();
        const img = new Image();
        img.onload = function() {
          const maxW = 500;
          let w = img.width, h = img.height;
          if (w > maxW) { h = h * maxW / w; w = maxW; }
          page.elements.push({
            id: genId(), type: 'image', src: dataUrl,
            x: 20 + page.elements.length * 30, y: 20 + page.elements.length * 20,
            w: Math.round(w), h: Math.round(h), rotation: 0, zIndex: page.elements.length + 1
          });
          updateMovie(currentJournalMovieId, { pages: m.pages });
          renderJournalPage();
          closeArchivePicker();
          showToast('已从档案馆插入 ✓');
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(item.data);
    };
    req.onerror = function() { showToast('读取存档失败'); };
  });
}

function importArchiveCover(id) {
  openArchiveDB().then(db => {
    const tx = db.transaction(ARCHIVE_STORE, 'readonly');
    const store = tx.objectStore(ARCHIVE_STORE);
    const req = store.get(id);
    req.onsuccess = function() {
      const item = req.result;
      if (!item || !item.data) { showToast('文件数据不存在'); return; }
      const reader = new FileReader();
      reader.onload = function(ev) {
        const dataUrl = ev.target.result;
        uploadedCoverData = dataUrl;
        document.getElementById('mCoverPreview').src = dataUrl;
        document.getElementById('mCoverPreview').style.display = 'block';
        document.getElementById('mCover').value = '';
        closeArchivePicker();
        showToast('已从档案馆设为封面 ✓');
      };
      reader.readAsDataURL(item.data);
    };
    req.onerror = function() { showToast('读取存档失败'); };
  });
}


// Archive picker overlay click-outside to close
document.addEventListener('click', function(e) {
  const overlay = document.getElementById('archivePickerOverlay');
  if (overlay && overlay.classList.contains('show') && e.target === overlay) {
    closeArchivePicker();
  }
});

function downloadArchiveItem(id) {
  openArchiveDB().then(db => {
    const tx = db.transaction(ARCHIVE_STORE, 'readonly');
    const store = tx.objectStore(ARCHIVE_STORE);
    const req = store.get(id);
    req.onsuccess = function() {
      const item = req.result;
      if (!item || !item.data) { showToast('文件数据不存在'); return; }
      const url = URL.createObjectURL(item.data);
      const a = document.createElement('a');
      a.href = url;
      const ext = item.type === 'video' ? '.webm' : '.png';
      a.download = (item.name || '未命名') + ext;
      a.click();
      URL.revokeObjectURL(url);
      showToast('文件已下载 ✓');
    };
    req.onerror = function() { showToast('读取文件失败'); };
  });
}

function deleteArchiveItemConfirm(id, dateStr) {
  if (!confirm('确定要删除这个存档文件吗？')) return;
  deleteArchiveItem(id).then(() => {
    showToast('已删除');
    closeArchiveDetail();
    setTimeout(() => openArchiveDetail(dateStr), 200);
    renderArchive();
  }).catch(e => { showToast('删除失败'); console.error(e); });
}

// ==================== ARCHIVE: Save with naming dialog ====================
function promptArchiveName(blob, type, cb) {
  archivePendingBlob = blob;
  archivePendingType = type;
  document.getElementById('archiveNameInput').value = type === 'video' ? '录制_' + new Date().toISOString().slice(0,10) : '截图_' + new Date().toISOString().slice(0,10);
  document.getElementById('archiveNameModalTitle').textContent = type === 'video' ? '💾 保存录制到档案馆' : '💾 保存截图到档案馆';
  openModal('archiveNameModal');
  setTimeout(() => document.getElementById('archiveNameInput').focus(), 300);
  archiveNameResolve = cb;
}

function confirmArchiveName() {
  const name = document.getElementById('archiveNameInput').value.trim() || '未命名';
  closeArchiveNameModal(true);
  const cb = archiveNameResolve;
  archiveNameResolve = null;
  if (cb) cb(name);
}

function closeArchiveNameModal(confirmed) {
  document.getElementById('archiveNameModal').classList.remove('show');
  if (!confirmed && archiveNameResolve) {
    const cb = archiveNameResolve;
    archiveNameResolve = null;
    cb(document.getElementById('archiveNameInput').value.trim() || '未命名');
  }
}

function saveToArchive(blob, name, type) {
  const now = new Date().toISOString();
  const id = genId();
  const item = { id, name, type, date: now, data: blob, source: 'app' };
  
  // Generate thumbnail for screenshots
  if (type === 'screenshot') {
    item.thumbnail = URL.createObjectURL(blob);
  }
  
  return saveArchiveItem(item).then(() => {
    showToast('已存入档案馆 ✓');
    return item;
  });
}

// ==================== ARCHIVE: Import from computer ====================
function importArchiveFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*,video/*';
  input.multiple = true;
  input.onchange = function(e) {
    const files = e.target.files;
    if (!files.length) return;
    
    // Process files sequentially with naming dialog
    const fileList = Array.from(files);
    let idx = 0;
    function processNext() {
      if (idx >= fileList.length) return;
      const file = fileList[idx];
      idx++;
      const reader = new FileReader();
      reader.onload = function(ev) {
        const blob = new Blob([ev.target.result], { type: file.type });
        const isVideo = file.type.startsWith('video/');
        promptArchiveName(blob, isVideo ? 'video' : 'screenshot', function(name) {
          const now = new Date().toISOString();
          const id = genId();
          const item = { id, name, type: isVideo ? 'video' : 'screenshot', date: now, data: blob, source: 'import' };
          if (!isVideo) item.thumbnail = URL.createObjectURL(blob);
          saveArchiveItem(item).then(() => {
            if (archiveViewYear) renderArchive();
            processNext(); // Process next file after current one is saved
          });
        });
      };
      reader.readAsArrayBuffer(file);
    }
    processNext();
  };
  input.click();
}

// ==================== MODIFIED: Screenshot saves to archive ====================
takeScreenshot = function() {
  const video = document.getElementById('playerVideo');
  if (!video || video.readyState < 2) { showToast('视频未就绪，无法截图'); return; }
  try {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || video.clientWidth;
    canvas.height = video.videoHeight || video.clientHeight;
    if (!canvas.width || !canvas.height) { showToast('无法获取画面尺寸'); return; }
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      if (!blob) { showToast('截图生成失败'); return; }
      // Save to archive with name dialog
      promptArchiveName(blob, 'screenshot', function(name) {
        saveToArchive(blob, name, 'screenshot').then(() => {
          if (archiveViewYear) renderArchive();
        });
        // Also download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `树洞截图_${name}_${new Date().toISOString().replace(/[:.]/g,'-').slice(0,19)}.png`;
        a.click();
        URL.revokeObjectURL(url);
      });
    }, 'image/png');
  } catch (e) {
    console.error('[Screenshot] Error:', e);
    showToast('截图失败: ' + e.message);
  }
};

// ==================== MODIFIED: Recording saves to archive ====================
finalizeRecording = function() {
  if (playerRecordedChunks.length === 0) return;
  const mimeType = playerMediaRecorder ? playerMediaRecorder.mimeType : 'video/webm';
  const blob = new Blob(playerRecordedChunks, { type: mimeType });
  playerRecordedChunks = [];
  
  // Save to archive with name dialog
  promptArchiveName(blob, 'video', function(name) {
    saveToArchive(blob, name, 'video').then(() => {
      if (archiveViewYear) renderArchive();
    });
    // Also download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `树洞录制_${name}_${new Date().toISOString().replace(/[:.]/g,'-').slice(0,19)}.webm`;
    a.click();
    URL.revokeObjectURL(url);
  });
};

// ==================== MODIFIED: Archive detail overlay click-outside ====================
document.addEventListener('click', function(e) {
  const overlay = document.getElementById('archiveDetailOverlay');
  if (overlay.classList.contains('show') && e.target === overlay) {
    closeArchiveDetail();
  }
});

// Archive move overlay click-outside
document.addEventListener('click', function(e) {
  const overlay = document.getElementById('archiveMoveOverlay');
  if (overlay && overlay.classList.contains('show') && e.target === overlay) {
    closeMoveArchiveItemDialog();
  }
});

// Review editor overlay click-outside
document.addEventListener('click', function(e) {
  const overlay = document.getElementById('reviewEditorOverlay');
  if (overlay && overlay.classList.contains('show') && e.target === overlay) {
    closeReviewEditor();
  }
  const rdMeta = document.getElementById('rdMetaEditOverlay');
  if (rdMeta && rdMeta.classList.contains('show') && e.target === rdMeta) {
    closeRdMetaEdit();
  }
  const rdWL = document.getElementById('rdWatchLogOverlay');
  if (rdWL && rdWL.classList.contains('show') && e.target === rdWL) {
    closeRdWatchLogDialog();
  }
  const sp = document.getElementById('sharePosterOverlay');
  if (sp && sp.classList.contains('show') && e.target === sp) {
    closeSharePoster();
  }
});

// AI chat overlay click-outside
document.addEventListener('click', function(e) {
  const overlay = document.getElementById('aiChatOverlay');
  if (overlay && overlay.classList.contains('show') && e.target === overlay) {
    closeAIChat();
  }
});

// ==================== API SETTINGS ====================
function getApiConfig() {
  try {
    return JSON.parse(localStorage.getItem('treehole_api_config') || '{}');
  } catch(e) { return {}; }
}

function loadApiSettings() {
  const cfg = getApiConfig();
  const endpoint = document.getElementById('apiEndpoint');
  const key = document.getElementById('apiKey');
  const model = document.getElementById('apiModel');
  if (endpoint) endpoint.value = cfg.endpoint || '';
  if (key) key.value = cfg.key || '';
  if (model) model.value = cfg.model || '';
}

function saveApiSettings() {
  const endpoint = document.getElementById('apiEndpoint').value.trim();
  const key = document.getElementById('apiKey').value.trim();
  const model = document.getElementById('apiModel').value.trim();
  const cfg = { endpoint, key, model };
  localStorage.setItem('treehole_api_config', JSON.stringify(cfg));
  showToast('API 配置已保存 ✓');
}

function testApiConnection() {
  const cfg = getApiConfig();
  if (!cfg.endpoint || !cfg.key) {
    document.getElementById('apiStatus').innerHTML = '<span style="color:var(--danger);">请先填写 API 地址和 Key</span>';
    return;
  }
  document.getElementById('apiStatus').innerHTML = '<span style="color:var(--text-muted);">连接测试中...</span>';
  fetch(cfg.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.key },
    body: JSON.stringify({ model: cfg.model || 'gpt-3.5-turbo', messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 })
  }).then(r => {
    if (r.ok) {
      document.getElementById('apiStatus').innerHTML = '<span style="color:var(--accent2);">✓ 连接成功</span>';
    } else {
      r.json().then(d => {
        document.getElementById('apiStatus').innerHTML = '<span style="color:var(--danger);">✗ 错误: ' + esc((d.error && d.error.message) || r.status) + '</span>';
      }).catch(() => {
        document.getElementById('apiStatus').innerHTML = '<span style="color:var(--danger);">✗ HTTP ' + r.status + '</span>';
      });
    }
  }).catch(e => {
    document.getElementById('apiStatus').innerHTML = '<span style="color:var(--danger);">✗ 连接失败: ' + esc(e.message) + '</span>';
  });
}

// ==================== REVIEWS MODULE ====================
function getAllReviews() {
  const ms = loadMovies();
  const all = [];
  ms.forEach(m => {
    if (m.reviews && m.reviews.length > 0) {
      m.reviews.forEach(r => {
        all.push({ ...r, movieId: m.id, movieTitle: m.title, movieType: m.type, movieCover: m.cover, movieRating: m.rating });
      });
    }
  });
  return all.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

function getMovieReviews(movieId) {
  const m = getMovie(movieId);
  return m && m.reviews ? m.reviews.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')) : [];
}

function renderReviews() {
  let list = getAllReviews();
  const filter=document.getElementById('reviewArchiveFilter')?.value||'all';
  if(filter==='active')list=list.filter(r=>!r.archived);
  else if(filter==='archived')list=list.filter(r=>r.archived);
  // Group by movie type
  const groups={};
  list.forEach(r=>{
    const t=r.movieType||'其他';
    if(!groups[t])groups[t]=[];
    groups[t].push(r);
  });
  const countEl = document.getElementById('reviewsCount');
  const listEl = document.getElementById('reviewsList');
  countEl.textContent = '共 ' + list.length + ' 篇影评'+(filter!=='all'?' ('+(filter==='active'?'未归档':'已归档')+')':'');
  if (list.length === 0) {
    listEl.className = 'reviews-empty';
    listEl.innerHTML = '<span style="font-size:36px;display:block;margin-bottom:8px;">📝</span><p>还没有影评</p><p style="font-size:0.7rem;">点击「写影评」选择影片开始写作</p>';
    return;
  }
  listEl.className = '';
  let html = '';
  const typeIcons={'电影':'🎬','电视剧':'📺','动漫':'🎨','书籍':'📖','其他':'📂'};
  for(const[t,items] of Object.entries(groups)){
    html+=`<div class="review-group-header"><span>${typeIcons[t]||'📂'} ${t}</span><span style="font-size:0.7rem;color:var(--text-muted);">${items.length}篇</span></div>`;
    items.forEach(r => {
      const stars = '★'.repeat(r.rating || 0) + '☆'.repeat(5 - (r.rating || 0));
      const title = r.title || '无标题';
      const date = r.createdAt ? r.createdAt.slice(0, 10) : '';
      const archived = r.archived ? '📦 已归档' : '';
      html += `<div class="review-card" onclick="openReviewDetail('${r.movieId}','${r.id}')">
        <div class="review-card-header">
          <div class="review-card-movie">
            <div class="rcm-poster">${r.movieCover ? `<img src="${esc(r.movieCover)}" onerror="this.style.display='none';this.parentElement.textContent='🎬';">` : '🎬'}</div>
            <div class="rcm-info">
              <div class="rcm-title">${esc(r.movieTitle)}${archived?` <span style="font-size:0.6rem;color:var(--text-muted);">${archived}</span>`:''}</div>
              <div class="rcm-type">${esc(r.movieType || '')}</div>
            </div>
          </div>
          <div class="review-card-rating">${stars}</div>
        </div>
        <div class="review-card-title">${esc(title)}</div>
        <div class="review-card-body">${esc(r.content ? r.content.slice(0, 500) + (r.content.length > 500 ? '...' : '') : '')}</div>
        <div class="review-card-footer">
          <div class="review-card-date">📅 ${date}</div>
          <div class="review-card-actions" onclick="event.stopPropagation();">
            <button class="chat-btn" onclick="openAIChat('${r.movieId}','${r.id}')" title="与智能体讨论">🤖 对话</button>
            <button onclick="openEditReview('${r.movieId}','${r.id}')" title="编辑">✏️</button>
            <button onclick="event.stopPropagation();toggleArchiveReviewSingle('${r.movieId}','${r.id}')" title="${r.archived?'恢复':'归档'}" style="padding:4px 6px;border-radius:8px;border:1px solid var(--border);background:var(--input-bg);color:var(--text);font-size:0.65rem;cursor:pointer;">${r.archived?'📂':'📦'}</button>
            <button class="del-btn" onclick="event.stopPropagation();deleteReviewRipple('${r.movieId}','${r.id}',this,event)" title="删除">✕</button>
          </div>
        </div>
      </div>`;
    });
  }
  listEl.innerHTML = html;
}

// Batch archive/restore reviews
function batchArchiveReviews(){
  const ms=loadMovies();
  let total=0;
  ms.forEach(m=>{(m.reviews||[]).forEach(r=>{if(!r.archived){r.archived=true;total++;}});});
  if(!total){showToast('没有可归档的影评');return;}
  if(!confirm(`确定归档全部 ${total} 篇未归档影评？`))return;
  saveMovies(ms);renderReviews();showToast('已归档 '+total+' 篇影评');
}
function batchRestoreReviews(){
  const ms=loadMovies();
  let total=0;
  ms.forEach(m=>{(m.reviews||[]).forEach(r=>{if(r.archived){r.archived=false;total++;}});});
  if(!total){showToast('没有已归档的影评');return;}
  if(!confirm(`确定恢复全部 ${total} 篇已归档影评？`))return;
  saveMovies(ms);renderReviews();showToast('已恢复 '+total+' 篇影评');
}
function toggleArchiveReviewSingle(mid,rid){
  const ms=loadMovies();const mi=ms.findIndex(m=>m.id===mid);
  if(mi<0)return;
  const ri=(ms[mi].reviews||[]).findIndex(r=>r.id===rid);
  if(ri<0)return;
  ms[mi].reviews[ri].archived=!ms[mi].reviews[ri].archived;
  saveMovies(ms);renderReviews();
  showToast(ms[mi].reviews[ri].archived?'已归档 ✓':'已取消归档 ✓');
}

function openNewReviewDialog() {
  editingReviewId = null;
  editingReviewMovieId = null;
  reviewRatingVal = 0;
  document.getElementById('reviewEditorTitle').textContent = '✏️ 写影评';
  document.getElementById('reviewSaveBtn').textContent = '💾 保存影评';
  document.getElementById('reviewTitle').value = '';
  document.getElementById('reviewContent').value = '';
  // Populate movie select
  const sel = document.getElementById('reviewMovieSelect');
  const ms = loadMovies();
  sel.innerHTML = '<option value="">-- 选择影片 --</option>' + ms.map(m => `<option value="${m.id}">${esc(m.title)} (${esc(m.type || '')})</option>`).join('');
  sel.value = '';
  renderReviewStars();
  document.getElementById('reviewEditorOverlay').classList.add('show');
}

function openEditReview(movieId, reviewId) {
  const m = getMovie(movieId);
  if (!m) return;
  const r = (m.reviews || []).find(rv => rv.id === reviewId);
  if (!r) return;
  editingReviewId = reviewId;
  editingReviewMovieId = movieId;
  reviewRatingVal = r.rating || 0;
  document.getElementById('reviewEditorTitle').textContent = '✏️ 编辑影评';
  document.getElementById('reviewSaveBtn').textContent = '💾 更新影评';
  document.getElementById('reviewTitle').value = r.title || '';
  document.getElementById('reviewContent').value = r.content || '';
  const sel = document.getElementById('reviewMovieSelect');
  const ms = loadMovies();
  sel.innerHTML = '<option value="">-- 选择影片 --</option>' + ms.map(mv => `<option value="${mv.id}">${esc(mv.title)} (${esc(mv.type || '')})</option>`).join('');
  sel.value = movieId;
  renderReviewStars();
  document.getElementById('reviewEditorOverlay').classList.add('show');
}

function closeReviewEditor() {
  document.getElementById('reviewEditorOverlay').classList.remove('show');
  editingReviewId = null;
  editingReviewMovieId = null;
}

function onReviewMovieChange() {
  // No special handling needed, just validate on save
}

function renderReviewStars() {
  const el = document.getElementById('reviewRating');
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += `<span class="${i <= reviewRatingVal ? 'active' : ''}" data-star="${i}" onclick="setReviewRating(${i})">★</span>`;
  }
  el.innerHTML = html;
}

function setReviewRating(n) {
  reviewRatingVal = n;
  renderReviewStars();
}

function saveReview() {
  const movieId = document.getElementById('reviewMovieSelect').value;
  const title = document.getElementById('reviewTitle').value.trim();
  const content = document.getElementById('reviewContent').value.trim();
  if (!movieId) { showToast('请选择一部影片'); return; }
  if (!title) { showToast('请输入影评标题'); return; }
  if (!content) { showToast('请输入影评正文'); return; }

  const ms = loadMovies();
  const mi = ms.findIndex(m => m.id === movieId);
  if (mi < 0) { showToast('影片不存在'); return; }

  if (!ms[mi].reviews) ms[mi].reviews = [];

  if (editingReviewId) {
    const ri = ms[mi].reviews.findIndex(r => r.id === editingReviewId);
    if (ri >= 0) {
      ms[mi].reviews[ri] = {
        ...ms[mi].reviews[ri],
        title, content,
        rating: reviewRatingVal,
        updatedAt: new Date().toISOString()
      };
    }
  } else {
    ms[mi].reviews.push({
      id: genId(),
      movieId,
      title,
      content,
      rating: reviewRatingVal,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  saveMovies(ms);
  closeReviewEditor();
  renderReviews();
  const d = currentReviewDetail;
  if (d && d.movieId === movieId && editingReviewId === d.reviewId) {
    reopenReviewDetail();
  }
  showToast('影评已保存 ✓');
}

function openReviewDetail(movieId, reviewId) {
  const m = getMovie(movieId); if (!m) { showToast('影片不存在'); return; }
  const r = (m.reviews || []).find(rv => rv.id === reviewId);
  if (!r) { showToast('影评不存在'); return; }
  currentReviewDetail = { movieId, reviewId, movie: m, review: r };

  const sb = m.status === '想看' ? 'want' : m.status === '在看' ? 'watching' : 'watched';
  const st = m.status === '想看' ? '📌 想看' : m.status === '在看' ? '▶ 在看' : '✓ 已看';
  const stars = '★'.repeat(r.rating || 0) + '☆'.repeat(5 - (r.rating || 0));
  const archived = r.archived || false;
  const watchLogs = m.watchLogs || [];

  const box = document.getElementById('reviewDetailBox');
  box.innerHTML = `
    <div class="rd-cover-area">
      ${m.cover ? `<img src="${esc(m.cover)}" onerror="this.style.display='none';this.parentElement.innerHTML='<span class=rd-cover-icon>🎬</span>'">` : '<span class="rd-cover-icon">🎬</span>'}
      <div class="rd-cover-gradient"></div>
      <button class="rd-close-btn" onclick="closeReviewDetail()">✕</button>
    </div>
    <div class="rd-info">
      <div class="rd-header">
        <div class="rd-movie-title">${esc(m.title)}</div>
        <div class="rd-stars">${stars}</div>
      </div>
      <div class="rd-review-title">📝 ${esc(r.title || '无标题')}</div>
      <div class="rd-meta-grid">
        <div class="rd-meta-item"><span class="rd-meta-label">📅 日期</span><span class="rd-meta-val">${fmtDate(m.watchDate)}</span></div>
        <div class="rd-meta-item"><span class="rd-meta-label">🏷 类型</span><span class="rd-meta-val">${esc(m.type || '未知')}</span></div>
        <div class="rd-meta-item"><span class="rd-meta-label">状态</span><span class="rd-status-badge ${sb}">${st}</span></div>
        <div class="rd-meta-item"><span class="rd-meta-label">评分</span><span class="rd-meta-val">${r.rating || 0} / 5</span></div>
        ${r.createdAt ? `<div class="rd-meta-item"><span class="rd-meta-label">📝 创建</span><span class="rd-meta-val">${r.createdAt.slice(0,10)}</span></div>` : ''}
        ${r.updatedAt && r.updatedAt !== r.createdAt ? `<div class="rd-meta-item"><span class="rd-meta-label">🔄 更新</span><span class="rd-meta-val">${r.updatedAt.slice(0,10)}</span></div>` : ''}
      </div>
      ${(m.tags || []).length ? `<div class="rd-tags-row">${m.tags.map(t => `<span class="rd-tag">${esc(t)}</span>`).join('')}</div>` : ''}
      ${watchLogs.length ? `<div class="rd-watch-log"><div class="rd-section-label">📅 多刷记录 (${watchLogs.length}次)</div>` + watchLogs.map((wl, i) => `<div class="rd-watch-log-item"><span class="wl-date">${fmtDate(wl.date)}</span><span class="wl-meta">${esc(wl.note || '')}</span><span class="wl-del" onclick="delWatchLog('${movieId}',${i})" title="删除">✕</span></div>`).join('') + '</div>' : ''}
      <div class="rd-section-label">📖 影评正文</div>
      <div class="rd-review-body">${r.content ? esc(r.content) : '<span style="color:var(--text-muted);">暂无内容</span>'}</div>
      <div class="rd-actions">
        <button onclick="editCurrentReviewContent()">✏️ 编辑改写</button>
        <button onclick="openRdMetaEdit()">⚙ 修改信息</button>
        <button onclick="openAIChat('${movieId}','${reviewId}')">🤖 智能体对话</button>
        <button onclick="openRdWatchLogDialog()">📅 多刷记录</button>
        <button onclick="generateSharePoster()" class="rd-primary">📤 分享海报</button>
        <button onclick="exportAllData()">💾 导出数据</button>
        <button onclick="cloudSyncReview()">☁ 云端同步</button>
        <button onclick="toggleArchiveReview()" class="${archived ? 'rd-archived' : ''}">${archived ? '📂 取消归档' : '📦 归档'}</button>
        <button onclick="deleteReviewFromDetail()" class="rd-danger">🗑 删除</button>
      </div>
    </div>`;
  document.getElementById('reviewDetailOverlay').classList.add('show');
  document.getElementById('reviewDetailOverlay').onclick = function(e) { if (e.target === this) closeReviewDetail(); };
}

let currentReviewDetail = null;
function closeReviewDetail() {
  document.getElementById('reviewDetailOverlay').classList.remove('show');
  currentReviewDetail = null;
}

function editCurrentReviewContent() {
  const d = currentReviewDetail; if (!d) return;
  closeReviewDetail();
  openEditReview(d.movieId, d.reviewId);
}

function openRdMetaEdit() {
  const d = currentReviewDetail; if (!d) return;
  const m = d.movie;
  const r = d.review;
  rdMetaRating = r.rating || 0;
  rdMetaTags = [...(m.tags || [])];
  const sb = m.status === '想看' ? 'want' : m.status === '在看' ? 'watching' : 'watched';

  document.getElementById('rdMetaEditBox').innerHTML = `
    <h4>⚙ 修改作品信息 · ${esc(m.title)}</h4>
    <div class="form-group"><label class="form-label">📅 观影日期</label><input class="form-input" type="date" id="rdMetaDate" value="${m.watchDate || ''}"></div>
    <div class="form-group"><label class="form-label">⭐ 影评评分</label><div class="rating-stars" id="rdMetaStars">${[1,2,3,4,5].map(i => `<span class="${i<=rdMetaRating?'active':''}" data-star="${i}" onclick="rdMetaRating=${i};renderRdMetaStars()">★</span>`).join('')}</div></div>
    <div class="form-group"><label class="form-label">📌 状态</label><select class="form-input" id="rdMetaStatus"><option value="已看" ${m.status==='已看'?'selected':''}>✓ 已看</option><option value="在看" ${m.status==='在看'?'selected':''}>▶ 在看</option><option value="想看" ${m.status==='想看'?'selected':''}>📌 想看</option></select></div>
    <div class="form-group"><label class="form-label">🏷 标签</label><div class="tag-pills" id="rdMetaTags">${rdMetaTags.map((t, i) => `<span class="tag-pill">${esc(t)}<span class="x" onclick="rdMetaTags.splice(${i},1);renderRdMetaTags()">×</span></span>`).join('')}<input id="rdMetaTagInput" placeholder="按回车添加..." onkeydown="if(event.key==='Enter'){event.preventDefault();const v=this.value.trim();if(v&&!rdMetaTags.includes(v)){rdMetaTags.push(v);renderRdMetaTags();this.value='';}}" style="padding:4px 8px;border:1px solid var(--border);border-radius:4px;background:var(--input-bg);color:var(--text);font-family:inherit;font-size:0.68rem;width:80px;"></div></div>
    <div class="btn-row"><button onclick="closeRdMetaEdit()">取消</button><button class="primary" onclick="saveRdMetaEdit()">💾 保存</button></div>`;
  document.getElementById('rdMetaEditOverlay').classList.add('show');
}
let rdMetaRating = 0;
let rdMetaTags = [];
function renderRdMetaStars() {
  const el = document.getElementById('rdMetaStars'); if (!el) return;
  el.innerHTML = [1, 2, 3, 4, 5].map(i => `<span class="${i <= rdMetaRating ? 'active' : ''}" data-star="${i}" onclick="rdMetaRating=${i};renderRdMetaStars()">★</span>`).join('');
}
function renderRdMetaTags() {
  const el = document.getElementById('rdMetaTags'); if (!el) return;
  el.innerHTML = rdMetaTags.map((t, i) => `<span class="tag-pill">${esc(t)}<span class="x" onclick="rdMetaTags.splice(${i},1);renderRdMetaTags()">×</span></span>`).join('') + '<input id="rdMetaTagInput" placeholder="按回车添加..." onkeydown="if(event.key===\'Enter\'){event.preventDefault();const v=this.value.trim();if(v&&!rdMetaTags.includes(v)){rdMetaTags.push(v);renderRdMetaTags();this.value=\'\';}}" style="padding:4px 8px;border:1px solid var(--border);border-radius:4px;background:var(--input-bg);color:var(--text);font-family:inherit;font-size:0.68rem;width:80px;">';
}
function closeRdMetaEdit() { document.getElementById('rdMetaEditOverlay').classList.remove('show'); }
function saveRdMetaEdit() {
  const d = currentReviewDetail; if (!d) return;
  const date = document.getElementById('rdMetaDate').value;
  const status = document.getElementById('rdMetaStatus').value;
  const ms = loadMovies();
  const mi = ms.findIndex(mv => mv.id === d.movieId);
  if (mi >= 0) {
    ms[mi].watchDate = date;
    ms[mi].status = status;
    ms[mi].tags = rdMetaTags;
    const ri = ms[mi].reviews.findIndex(rv => rv.id === d.reviewId);
    if (ri >= 0) { ms[mi].reviews[ri].rating = rdMetaRating; ms[mi].reviews[ri].updatedAt = new Date().toISOString(); }
  }
  saveMovies(ms); closeRdMetaEdit();
  d.review.rating = rdMetaRating; d.movie.watchDate = date; d.movie.status = status; d.movie.tags = rdMetaTags;
  reopenReviewDetail(); showToast('已更新 ✓');
}
function reopenReviewDetail() {
  const d = currentReviewDetail; if (!d) return;
  openReviewDetail(d.movieId, d.reviewId);
}

function openRdWatchLogDialog() {
  const d = currentReviewDetail; if (!d) return;
  const wls = d.movie.watchLogs || [];
  document.getElementById('rdWatchLogBox').innerHTML = `
    <h4>📅 多刷记录 · ${esc(d.movie.title)}</h4>
    <div style="max-height:200px;overflow-y:auto;margin-bottom:10px;">
      ${wls.length ? wls.map((wl, i) => `<div class="rd-watch-log-item"><span class="wl-date">${fmtDate(wl.date)}</span><span class="wl-meta">${esc(wl.note || '无备注')}</span><span class="wl-del" onclick="delWatchLog('${d.movieId}',${i});refreshWatchLogList()">✕</span></div>`).join('') : '<div style="font-size:0.73rem;color:var(--text-muted);text-align:center;padding:10px;">暂无多刷记录</div>'}
    </div>
    <div class="form-group"><label class="form-label">📅 观影日期</label><input class="form-input" type="date" id="wlDate" value="${new Date().toISOString().slice(0,10)}"></div>
    <div class="form-group"><label class="form-label">备注（可选）</label><input class="form-input" id="wlNote" placeholder="如：IMAX重刷、二刷发现新细节..."></div>
    <div class="btn-row"><button onclick="closeRdWatchLogDialog()">取消</button><button class="primary" onclick="addWatchLog()">＋ 添加</button></div>`;
  document.getElementById('rdWatchLogOverlay').classList.add('show');
}
function closeRdWatchLogDialog() { document.getElementById('rdWatchLogOverlay').classList.remove('show'); }
function addWatchLog() {
  const d = currentReviewDetail; if (!d) return;
  const date = document.getElementById('wlDate').value;
  const note = document.getElementById('wlNote').value.trim();
  if (!date) { showToast('请选择日期'); return; }
  const ms = loadMovies();
  const mi = ms.findIndex(mv => mv.id === d.movieId);
  if (mi < 0) return;
  if (!ms[mi].watchLogs) ms[mi].watchLogs = [];
  ms[mi].watchLogs.push({ date, note, addedAt: new Date().toISOString() });
  ms[mi].watchLogs.sort((a, b) => new Date(b.date) - new Date(a.date));
  saveMovies(ms);
  d.movie = ms[mi];
  reopenReviewDetail();
  openRdWatchLogDialog();
  showToast('多刷记录已添加 ✓');
}
function delWatchLog(movieId, idx) {
  const ms = loadMovies();
  const mi = ms.findIndex(mv => mv.id === movieId);
  if (mi < 0) return; if (!ms[mi].watchLogs) return;
  ms[mi].watchLogs.splice(idx, 1);
  saveMovies(ms);
  if (currentReviewDetail && currentReviewDetail.movieId === movieId) currentReviewDetail.movie = ms[mi];
}
function refreshWatchLogList() {
  const d = currentReviewDetail; if (!d) return;
  d.movie = getMovie(d.movieId) || d.movie;
  reopenReviewDetail();
  openRdWatchLogDialog();
}

function generateSharePoster() {
  const d = currentReviewDetail; if (!d) return;
  const m = d.movie; const r = d.review;
  showToast('正在生成海报...');
  // Mobile-friendly smaller canvas
  const isMobile = window.innerWidth < 768;
  const w = isMobile ? Math.min(360, window.innerWidth - 20) : 400;
  const h = Math.round(w * 1.4);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');

  // Scale ratio for layout calculations
  const s = w / 400;

  // Background
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, '#1a1a2e');
  gradient.addColorStop(0.5, '#16213e');
  gradient.addColorStop(1, '#0f3460');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  // Decorative dots
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  for (let i = 0; i < 80; i++) {
    ctx.beginPath();
    ctx.arc(Math.random() * w, Math.random() * h, Math.random() * 2 + 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cover helper functions (scaled)
  function drawPosterScaledCover(ctx, img) {
    ctx.drawImage(img, 120 * s, 24 * s, 160 * s, 220 * s);
  }
  function drawPosterScaledPlaceholder(ctx, emoji) {
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(120 * s, 24 * s, 160 * s, 220 * s);
    ctx.font = (60 * s) + 'px serif';
    ctx.textAlign = 'center';
    ctx.fillText(emoji, 200 * s, 155 * s);
  }
  function drawPosterScaledContent(ctx, m, r) {
    // Movie title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold ' + (20 * s) + 'px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    const title = m.title.length > 16 ? m.title.slice(0, 16) + '...' : m.title;
    ctx.fillText(title, 200 * s, 275 * s);
    // Type & date
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = (12 * s) + 'px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(`${m.type || '未知'} · ${fmtDate(m.watchDate)}`, 200 * s, 296 * s);
    // Stars
    const stars = '★'.repeat(r.rating || 0) + '☆'.repeat(5 - (r.rating || 0));
    ctx.fillStyle = '#f5c842';
    ctx.font = (18 * s) + 'px serif';
    ctx.fillText(stars, 200 * s, 322 * s);
    // Divider
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40 * s, 342 * s);
    ctx.lineTo(360 * s, 342 * s);
    ctx.stroke();
    // Review title
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold ' + (14 * s) + 'px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(r.title || '影评', 200 * s, 368 * s);
    // Review content
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = (12 * s) + 'px "Georgia", "Noto Serif SC", serif';
    ctx.textAlign = 'left';
    const content = r.content || '';
    const words = content.replace(/\s+/g, '');
    const maxChars = 160;
    const displayText = words.length > maxChars ? words.slice(0, maxChars) + '...' : words;
    wrapText(ctx, displayText, 40 * s, 390 * s, 320 * s, 18 * s, w - 40 * s);
    // Footer
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = (10 * s) + 'px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('— 树洞 · 观影手帳 —', 200 * s, h - 30);
    ctx.fillText(new Date().toLocaleDateString('zh-CN'), 200 * s, h - 14);
  }

  // Cover image or placeholder
  if (m.cover) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
      drawPosterScaledCover(ctx, img);
      drawPosterScaledContent(ctx, m, r);
      showSharePosterDialog(canvas);
    };
    img.onerror = function () {
      drawPosterScaledPlaceholder(ctx, '🎬');
      drawPosterScaledContent(ctx, m, r);
      showSharePosterDialog(canvas);
    };
    img.src = m.cover;
  } else {
    drawPosterScaledPlaceholder(ctx, '🎬');
    drawPosterScaledContent(ctx, m, r);
    showSharePosterDialog(canvas);
  }
}
function drawPosterPlaceholder(ctx, emoji) {
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(120, 24, 160, 220);
  ctx.font = '60px serif';
  ctx.textAlign = 'center';
  ctx.fillText(emoji, 200, 155);
}
function drawPosterContent(ctx, m, r) {
  // Movie title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  const title = m.title.length > 16 ? m.title.slice(0, 16) + '...' : m.title;
  ctx.fillText(title, 200, 275);

  // Type & date
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '12px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillText(`${m.type || '未知'} · ${fmtDate(m.watchDate)}`, 200, 296);

  // Stars
  const stars = '★'.repeat(r.rating || 0) + '☆'.repeat(5 - (r.rating || 0));
  ctx.fillStyle = '#f5c842';
  ctx.font = '18px serif';
  ctx.fillText(stars, 200, 322);

  // Divider
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, 342);
  ctx.lineTo(360, 342);
  ctx.stroke();

  // Review title
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = 'bold 14px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillText(r.title || '影评', 200, 368);

  // Review content
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '12px "Georgia", "Noto Serif SC", serif';
  ctx.textAlign = 'left';
  const content = r.content || '';
  const words = content.replace(/\s+/g, '');
  const maxChars = 160;
  const displayText = words.length > maxChars ? words.slice(0, maxChars) + '...' : words;
  wrapText(ctx, displayText, 40, 390, 320, 18);

  // Footer
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '10px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('— 树洞 · 观影手帐 —', 200, 530);
  ctx.fillText(new Date().toLocaleDateString('zh-CN'), 200, 546);
}
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  let line = '';
  for (let i = 0; i < text.length; i++) {
    const testLine = line + text[i];
    if (ctx.measureText(testLine).width > maxWidth && line.length > 0) {
      ctx.fillText(line, x, y);
      y += lineHeight;
      line = text[i];
    } else {
      line = testLine;
    }
  }
  if (line) ctx.fillText(line, x, y);
}
function showSharePosterDialog(canvas) {
  const box = document.getElementById('sharePosterBox');
  const isMobile = window.innerWidth < 768;
  const btns = isMobile
    ? `<button onclick="downloadSharePoster()">💾 下载保存</button>
       <button class="primary" onclick="sharePosterMobile()">📤 分享给好友</button>
       <button onclick="copySharePoster()">📋 复制</button>`
    : `<button onclick="downloadSharePoster()">💾 下载保存</button>
       <button class="primary" onclick="copySharePoster()">📋 复制图片</button>`;
  box.innerHTML = `<button class="share-poster-close" onclick="closeSharePoster()">✕</button>` + 
    `<canvas width="${canvas.width}" height="${canvas.height}"></canvas>` +
    `<div class="share-poster-actions">${btns}</div>` +
    (isMobile ? `<div style="margin-top:8px;font-size:0.7rem;color:rgba(255,255,255,0.5);text-align:center;">💡 长按海报图片可直接保存到相册</div>` : '');
  const c = box.querySelector('canvas');
  const ctx2 = c.getContext('2d');
  ctx2.drawImage(canvas, 0, 0);
  window._sharePosterCanvas = canvas;
  // Ensure overlay has tap-to-close
  document.getElementById('sharePosterOverlay').onclick = function(e) { if (e.target === this) closeSharePoster(); };
  document.getElementById('sharePosterOverlay').classList.add('show');
}
function closeSharePoster() { document.getElementById('sharePosterOverlay').classList.remove('show'); }
function downloadSharePoster() {
  if (!window._sharePosterCanvas) return;
  saveCanvas(window._sharePosterCanvas, 'share_poster_' + new Date().toISOString().slice(0,10) + '.png');
}
function sharePosterMobile() {
  if (!window._sharePosterCanvas) { showToast('海报生成中...'); return; }
  window._sharePosterCanvas.toBlob(function(blob) {
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], 'share_poster.png', { type: 'image/png' })] })) {
      navigator.share({
        files: [new File([blob], 'share_poster.png', { type: 'image/png' })],
        title: '树洞 · 观影手帳'
      }).then(function() {
        showToast('分享成功 ✓');
      }).catch(function() {
        fallbackDownload(blob, 'share_poster.png');
      });
    } else {
      fallbackDownload(blob, 'share_poster.png');
    }
  }, 'image/png');
}
function copySharePoster() {
  if (!window._sharePosterCanvas) { showToast('海报生成中...'); return; }
  window._sharePosterCanvas.toBlob(blob => {
    try {
      // Modern clipboard API with ClipboardItem
      if (typeof ClipboardItem !== 'undefined') {
        navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        showToast('海报已复制到剪贴板');
      } else {
        // Fallback on mobile: download instead
        fallbackDownload(blob, 'share_poster.png');
        showToast('已保存图片 ✓');
      }
    } catch (e) {
      // ClipboardItem not supported, fallback to download
      fallbackDownload(blob, 'share_poster.png');
      showToast('已保存图片 ✓');
    }
  });
}

function cloudSyncReview() {
  showToast('☁ 云端同步功能即将上线，敬请期待');
}

function toggleArchiveReview() {
  const d = currentReviewDetail; if (!d) return;
  const ms = loadMovies();
  const mi = ms.findIndex(mv => mv.id === d.movieId);
  if (mi < 0) return;
  const ri = ms[mi].reviews.findIndex(rv => rv.id === d.reviewId);
  if (ri < 0) return;
  ms[mi].reviews[ri].archived = !ms[mi].reviews[ri].archived;
  saveMovies(ms);
  d.review.archived = ms[mi].reviews[ri].archived;
  reopenReviewDetail();
  showToast(ms[mi].reviews[ri].archived ? '已归档 ✓' : '已取消归档 ✓');
}

function deleteReviewFromDetail() {
  const d = currentReviewDetail; if (!d) return;
  if (!confirm(`确定删除影评「${d.review.title || '无标题'}」吗？此操作不可撤销。`)) return;
  deleteReview(d.movieId, d.reviewId);
  closeReviewDetail();
  renderReviews();
}

function createButtonRipple(btn, e) {
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 2.5;
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  ripple.style.width = ripple.style.height = size + 'px';
  ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
  ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 500);
}

function deleteReviewRipple(movieId, reviewId, btn, e) {
  createButtonRipple(btn, e);
  setTimeout(() => {
    if (!confirm('确定删除这篇影评吗？')) return;
    deleteReview(movieId, reviewId);
  }, 180);
}

function deleteReview(movieId, reviewId) {
  const ms = loadMovies();
  const mi = ms.findIndex(m => m.id === movieId);
  if (mi < 0) return;
  if (!ms[mi].reviews) return;
  ms[mi].reviews = ms[mi].reviews.filter(r => r.id !== reviewId);
  saveMovies(ms);
  const chats = loadChatMessages();
  delete chats[reviewId];
  saveChatMessages(chats);
  renderReviews();
  showToast('影评已删除');
}

// ==================== READING REPORT ====================
function renderReadingReport(){
  var ms=loadMovies().filter(m=>m.type==='书籍');
  var now=new Date();var currentYear=now.getFullYear();
  // Populate year selector
  var yearSel=document.getElementById('readingReportYear');
  yearSel.innerHTML=(function(){
    var years=[];for(var y=2020;y<=currentYear;y++)years.push(y);
    return years.map(y=>'<option value="'+y+'" '+(y===currentYear?'selected':'')+'>'+y+'年</option>').join('');
  })();
  var selectedYear=parseInt(yearSel.value)||currentYear;

  // Filter books for the selected year (by watchDate)
  var yearBooks=ms.filter(m=>{
    var d=m.watchDate;if(!d)return false;
    return d.startsWith(selectedYear+'');
  });

  if(!yearBooks.length){
    document.getElementById('readingReportContent').innerHTML=
      '<div style="text-align:center;padding:40px;color:var(--text-muted);">📊<br>'+selectedYear+'年暂无阅读记录<br><span style="font-size:0.7rem;">为书籍添加阅读日期后即可生成报告</span></div>';
    return;
  }

  var totalBooks=yearBooks.length;
  var readed=yearBooks.filter(m=>m.status==='已看').length;
  var reading=yearBooks.filter(m=>m.status==='在看').length;
  var wantRead=yearBooks.filter(m=>m.status==='想看').length;
  var totalPages=yearBooks.reduce((s,m)=>s+(m.currentPage||0),0);
  var totalEstimated=yearBooks.reduce((s,m)=>s+(m.pageCount||m.txtContent?Math.ceil((m.txtContent||'').length/2000):0),0);
  var avgRating=yearBooks.filter(m=>m.rating>0).length?(yearBooks.reduce((s,m)=>s+(m.rating||0),0)/yearBooks.filter(m=>m.rating>0).length).toFixed(1):'0';
  // Most read author
  var authorCounts={};yearBooks.forEach(m=>{if(m.author){var a=m.author;authorCounts[a]=(authorCounts[a]||0)+1;}});
  var topAuthors=Object.entries(authorCounts).sort((a,b)=>b[1]-a[1]).slice(0,5);
  // Type distribution (all books are 书籍, so skip)
  // Monthly breakdown
  var monthly={};for(var i=1;i<=12;i++)monthly[i]=0;
  yearBooks.forEach(m=>{if(m.watchDate){var month=parseInt(m.watchDate.slice(5,7));monthly[month]=(monthly[month]||0)+1;}});

  var html='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-bottom:20px;">';
  html+='<div class="stat-card"><span class="stat-icon">📚</span><div class="stat-num">'+totalBooks+'</div><div class="stat-label">阅读总数</div><div class="stat-sub">'+selectedYear+'年</div></div>';
  html+='<div class="stat-card"><span class="stat-icon">✅</span><div class="stat-num">'+readed+'</div><div class="stat-label">已读完</div><div class="stat-sub">平均 '+avgRating+' ★</div></div>';
  html+='<div class="stat-card"><span class="stat-icon">📖</span><div class="stat-num">'+reading+'</div><div class="stat-label">在读</div><div class="stat-sub">'+wantRead+' 本想读</div></div>';
  html+='<div class="stat-card"><span class="stat-icon">📄</span><div class="stat-num">'+totalPages+'</div><div class="stat-label">已读页数</div><div class="stat-sub">约 '+totalEstimated+' 总页</div></div>';
  html+='</div>';

  // Monthly chart
  html+='<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:14px;">';
  html+='<div style="font-weight:600;margin-bottom:10px;color:var(--accent-bright);">📅 月度阅读分布</div>';
  html+='<div style="display:flex;align-items:flex-end;gap:3px;height:120px;">';
  var maxMonth=Math.max(1,...Object.values(monthly));
  for(var i=1;i<=12;i++){
    var h=monthly[i]?Math.max(4,(monthly[i]/maxMonth)*100):2;
    html+='<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;">';
    html+='<span style="font-size:0.55rem;color:var(--text-muted);margin-bottom:2px;">'+(monthly[i]||'')+'</span>';
    html+='<div style="width:100%;max-width:20px;height:'+h+'%;background:linear-gradient(180deg,var(--accent),var(--accent2));border-radius:3px 3px 0 0;min-height:2px;"></div>';
    html+='<span style="font-size:0.55rem;color:var(--text-muted);margin-top:4px;">'+i+'月</span></div>';
  }
  html+='</div></div>';

  // Top authors
  if(topAuthors.length){
    html+='<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:14px;">';
    html+='<div style="font-weight:600;margin-bottom:8px;color:var(--accent-bright);">✍ 最常阅读的作者</div>';
    topAuthors.forEach((a,i)=>{
      html+='<div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:0.8rem;">';
      html+='<span style="font-weight:600;color:var(--accent);min-width:20px;">#'+(i+1)+'</span>';
      html+='<span style="flex:1;color:var(--text);">'+esc(a[0])+'</span>';
      html+='<span style="color:var(--text-muted);font-size:0.7rem;">'+a[1]+'本</span></div>';
    });
    html+='</div>';
  }

  // Book list
  html+='<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:16px;">';
  html+='<div style="font-weight:600;margin-bottom:10px;color:var(--accent-bright);">📖 阅读书单</div>';
  yearBooks.sort((a,b)=>new Date(b.watchDate||0)-new Date(a.watchDate||0)).forEach(m=>{
    var stars='★'.repeat(m.rating||0)+'☆'.repeat(5-(m.rating||0));
    var pct=progressPercent(m);
    html+='<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.78rem;">';
    html+='<span style="flex:1;color:var(--text);font-weight:500;">'+esc(m.title)+'</span>';
    if(m.author)html+='<span style="color:var(--text-muted);font-size:0.68rem;">'+esc(m.author)+'</span>';
    html+='<span style="color:var(--star-color);">'+stars+'</span>';
    html+='<span style="color:var(--text-muted);font-size:0.65rem;">'+statusLabel(m)+'</span>';
    if(pct>0)html+='<span style="color:var(--accent);font-size:0.65rem;">'+pct+'%</span>';
    html+='</div>';
  });
  html+='</div>';

  document.getElementById('readingReportContent').innerHTML=html;
}

// ==================== AI CHAT MODULE (本地智能体 · 无需API) ====================
const AI_CHAT_STANDALONE_KEY = 'treehole_ai_chat_standalone_v1';

function loadChatMessages() {
  try { return JSON.parse(localStorage.getItem(REVIEWS_CHAT_KEY) || '{}'); } catch(e) { return {}; }
}
function saveChatMessages(msgs) {
  localStorage.setItem(REVIEWS_CHAT_KEY, JSON.stringify(msgs));
}
function loadStandaloneChat() {
  try { return JSON.parse(localStorage.getItem(AI_CHAT_STANDALONE_KEY) || '[]'); } catch(e) { return []; }
}
function saveStandaloneChat(msgs) {
  localStorage.setItem(AI_CHAT_STANDALONE_KEY, JSON.stringify(msgs));
}

function openAIChat(movieId, reviewId) {
  if (movieId && reviewId) {
    aiChatMode = 'review';
    aiChatMovieId = movieId;
    aiChatReviewId = reviewId;
    const m = getMovie(movieId);
    const r = m ? (m.reviews || []).find(rv => rv.id === reviewId) : null;
    document.getElementById('aiChatSubtitle').textContent = m ?
      '关于《' + m.title + '》的影评：' + (r ? esc(r.title || '无标题') : '') : '';
    const chats = loadChatMessages();
    aiChatMessages = chats[reviewId] || [];
  } else {
    aiChatMode = 'standalone';
    aiChatMovieId = null;
    aiChatReviewId = null;
    document.getElementById('aiChatSubtitle').textContent = '你的专属观影智能助手';
    aiChatMessages = loadStandaloneChat();
  }
  renderAIChatMessages();
  document.getElementById('aiChatOverlay').classList.add('show');
  if (aiChatMessages.length === 0) {
    const ms = loadMovies();
    const watched = ms.filter(m => m.status === '已看');
    const welcomeDiv = document.getElementById('aiChatWelcome');
    welcomeDiv.innerHTML = aiChatMode === 'review'
      ? '智能体已准备好与你讨论这篇影评，开始对话吧~'
      : `你好！我是你的观影智能助手 🌟<br>你已收录 <b>${ms.length}</b> 部作品，其中 <b>${watched.length}</b> 部已看。<br><br>你可以问我：<br>· "我看了多少电影？"<br>· "推荐一部科幻片"<br>· "评分最高的是哪些？"<br>· "今年看了哪些？"<br>试试看吧~`;
  }
  document.getElementById('aiChatInput').focus();
}

function closeAIChat() {
  document.getElementById('aiChatOverlay').classList.remove('show');
  aiChatMovieId = null;
  aiChatReviewId = null;
  aiChatMessages = [];
  aiChatMode = 'standalone';
}

function renderAIChatMessages() {
  const container = document.getElementById('aiChatMessages');
  if (aiChatMessages.length === 0) {
    container.innerHTML = '<div class="ai-chat-msg system" id="aiChatWelcome">智能体已准备好，开始对话吧~</div>';
  } else {
    let html = '';
    aiChatMessages.forEach(msg => {
      const time = msg.time ? new Date(msg.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '';
      const cls = msg.role === 'assistant' ? 'assistant' : (msg.role === 'error' ? 'assistant error' : 'user');
      const body = msg.role === 'assistant' ? msg.content.replace(/\n/g, '<br>') : esc(msg.content);
      html += `<div class="ai-chat-msg ${cls}"><div>${body}</div><div class="msg-time">${time}</div></div>`;
    });
    container.innerHTML = html;
  }
  container.scrollTop = container.scrollHeight;
}

// ===== 本地智能体引擎（核心 · 完全离线）=====
function localChatEngine(userMsg) {
  const msg = userMsg.trim();
  const ms = loadMovies();
  const watched = ms.filter(m => m.status === '已看');
  const want = ms.filter(m => m.status === '想看');
  const watching = ms.filter(m => m.status === '在看');

  let reviewCtx = '';
  if (aiChatMode === 'review') {
    const m = getMovie(aiChatMovieId);
    const r = m ? (m.reviews || []).find(rv => rv.id === aiChatReviewId) : null;
    if (r && m) {
      reviewCtx = '\n\n💡 当前讨论：《' + m.title + '》（' + m.type + '，' + '★'.repeat(m.rating||0) + '☆'.repeat(5-(m.rating||0)) + '）\n影评：《' + (r.title||'无标题') + '》';
    }
  }
  const lower = msg.toLowerCase();

  // 1. Help
  if (/帮助|help|你能做|功能|怎么用/.test(lower)) {
    return '我可以帮你做这些事情：\n\n📊 数据统计：问我"看了多少电影""评分分布如何"\n🔍 查找作品：问我"有哪些科幻片""评分5星的有哪些"\n📅 按时间：问我"今年看了哪些""去年看了什么"\n⭐ 推荐：问我"推荐一部给我""今天看什么好"\n📈 类型分析：问我"最常看的类型是什么"\n📝 影评讨论：在影评详情页打开智能体，讨论具体影评\n\n现在试试问我吧！' + reviewCtx;
  }

  // 2. Greeting
  if (/^(你好|嗨|hello|hi|嘿|哈喽|早上好|下午好|晚上好)[\s！!。.]*$/.test(lower)) {
    return '你好呀！👋 你在树洞里收录了 ' + ms.length + ' 部作品，其中已看 ' + watched.length + ' 部。今天想聊点什么呢？' + reviewCtx;
  }

  // 3. Thanks
  if (/谢谢|感谢|多谢|thanks|thank/.test(lower)) {
    return '不客气！随时为你服务 🌟 还有什么想了解的吗？';
  }

  // 4. Stats - total count
  if (/看了?多少[部个]|一共.*[部个]|总共.*[部个]|汇总|统计|片库/.test(lower)) {
    const tagMap = {};
    ms.forEach(m => { (m.tags||[]).forEach(t => { tagMap[t] = (tagMap[t]||0) + 1; }); });
    const topTag = Object.entries(tagMap).sort((a,b) => b[1] - a[1])[0];
    const avg = watched.length ? (watched.reduce((s,m) => s + (m.rating||0), 0) / watched.length).toFixed(1) : '0';
    return '📊 你的观影统计\n\n📚 共收录 ' + ms.length + ' 部作品\n✓ 已看：' + watched.length + ' 部\n▶ 在看：' + watching.length + ' 部\n📌 想看：' + want.length + ' 部\n⭐ 已看平均评分：' + avg + ' / 5\n🏷 最常用标签：' + (topTag ? topTag[0] + '（' + topTag[1] + '次）' : '暂无') + reviewCtx;
  }

  // 5. Type analysis
  if (/类型|分类|什么类型|哪种.*多|最常看/.test(lower)) {
    const tc = {};
    ms.forEach(m => { const t = m.type || '其他'; tc[t] = (tc[t]||0) + 1; });
    const sorted = Object.entries(tc).sort((a,b) => b[1] - a[1]);
    const lines = sorted.map(([t,c]) => '· ' + t + '：' + c + ' 部').join('\n');
    return '📂 类型分布\n\n' + lines + '\n\n' + (sorted[0] ? '最常看的类型是 ' + sorted[0][0] + '，共 ' + sorted[0][1] + ' 部。' : '暂无数据。') + reviewCtx;
  }

  // 6. Top rated
  if (/评分最高|最好|最喜欢|高分|满分|5星/.test(lower)) {
    const top = watched.filter(m => m.rating >= 4).sort((a,b) => (b.rating||0) - (a.rating||0));
    if (!top.length) return '暂时还没有高分（≥4星）的作品哦，多看点好片吧~ 🍿' + reviewCtx;
    const show = top.slice(0, 8);
    const lines = show.map(m => '· ⭐' + (m.rating||0) + ' 《' + m.title + '》（' + (m.type||'') + '，' + fmtDate(m.watchDate) + '）').join('\n');
    return '🌟 评分最高的作品\n\n' + lines + '\n\n共 ' + top.length + ' 部作品评分 ≥ 4星。' + reviewCtx;
  }

  // 7. Year filter
  const ym = msg.match(/(\d{4})年/);
  let year = null;
  if (ym) { year = parseInt(ym[1]); }
  else if (/今年/.test(lower)) { year = new Date().getFullYear(); }
  else if (/去年/.test(lower)) { year = new Date().getFullYear() - 1; }
  else if (/前年/.test(lower)) { year = new Date().getFullYear() - 2; }
  if (year) {
    const yMs = ms.filter(m => m.watchDate && new Date(m.watchDate).getFullYear() === year);
    if (!yMs.length) return year + '年还没有观影记录呢，快去看点什么吧~ 🎬' + reviewCtx;
    const yW = yMs.filter(m => m.status === '已看');
    const show = yMs.slice(0, 10);
    const lines = show.map(m => '· ' + (m.status==='已看'?'✓':'📌') + ' 《' + m.title + '》（' + (m.type||'') + '，' + '★'.repeat(m.rating||0) + '☆'.repeat(5-(m.rating||0)) + '）').join('\n');
    return '📅 ' + year + '年 观影记录（' + yMs.length + ' 部，已看 ' + yW.length + ' 部）\n\n' + lines + (yMs.length > 10 ? '\n\n...还有 ' + (yMs.length-10) + ' 部' : '') + reviewCtx;
  }

  // 8. Status query
  if (/想看|待看|想看.*列表|想看.*清单/.test(lower) && !/在看/.test(lower)) {
    if (!want.length) return '你的"想看"清单是空的，快去找点想看的吧~ 📌' + reviewCtx;
    const show = want.slice(0, 8);
    const lines = show.map(m => '· 📌 《' + m.title + '》（' + (m.type||'') + '）').join('\n');
    return '📌 想看清单（' + want.length + ' 部）\n\n' + lines + (want.length > 8 ? '\n\n...还有 ' + (want.length-8) + ' 部' : '') + reviewCtx;
  }
  if (/在看|正在.*看|追/.test(lower)) {
    if (!watching.length) return '你目前没有"在看"的作品~ 📺' + reviewCtx;
    const lines = watching.map(m => '· ▶ 《' + m.title + '》（' + (m.type||'') + '，' + '★'.repeat(m.rating||0) + '☆'.repeat(5-(m.rating||0)) + '）').join('\n');
    return '▶ 正在观看（' + watching.length + ' 部）\n\n' + lines + reviewCtx;
  }

  // 9. Recommendations
  if (/推荐|看什么|今天看|无聊|随便.*部|建议/.test(lower)) {
    const gs = ['科幻','悬疑','爱情','动作','喜剧','恐怖','动画','战争','纪录','犯罪','奇幻','历史','武侠','青春','文艺','音乐','运动','推理','冒险','家庭'];
    let pool = ms;
    let matchedG = '';
    for (const g of gs) {
      if (lower.includes(g)) { matchedG = g; pool = ms.filter(m => (m.tags||[]).some(t => t.includes(g)) || (m.type||'').includes(g)); break; }
    }
    const unwatched = pool.filter(m => m.status !== '已看');
    let picks = (unwatched.length >= 3 ? unwatched : pool).sort(() => Math.random() - 0.5).slice(0, 3);
    if (!picks.length) return '你的片库还是空的，先去添加一些作品吧~ 📚' + reviewCtx;
    const lines = picks.map(m => '· ' + (m.status==='已看'?'🔄(可二刷)':'📌') + ' 《' + m.title + '》' + (m.type ? '（' + m.type + '）' : '') + (m.rating ? ' ⭐' + m.rating : '')).join('\n');
    return (matchedG ? '🎯 为你推荐' + matchedG + '类：' : '🎲 随机推荐：') + '\n\n' + lines + '\n\n感兴趣吗？去看看吧~' + reviewCtx;
  }

  // 10. Genre/tag filter
  const genres = ['科幻','悬疑','爱情','动作','喜剧','恐怖','动画','战争','纪录','犯罪','奇幻','历史','武侠','青春','文艺','音乐','运动','推理','冒险','家庭'];
  for (const g of genres) {
    if (lower.includes(g)) {
      const matched = ms.filter(m => (m.tags||[]).some(t => t.includes(g)) || (m.type||'').includes(g) || m.title.includes(g));
      if (!matched.length) return '暂时没有与"' + g + '"相关的作品。你可以在编辑时添加标签~ 🏷' + reviewCtx;
      const show = matched.slice(0, 8);
      const lines = show.map(m => '· ' + '★'.repeat(m.rating||0) + '☆'.repeat(5-(m.rating||0)) + ' 《' + m.title + '》（' + (m.type||'') + '，' + fmtDate(m.watchDate) + '）').join('\n');
      return '🏷 "' + g + '" 相关作品（' + matched.length + ' 部）\n\n' + lines + (matched.length > 8 ? '\n\n...还有 ' + (matched.length-8) + ' 部' : '') + reviewCtx;
    }
  }

  // 11. Movie search by title
  if (msg.length >= 2) {
    const found = ms.filter(m => m.title.toLowerCase().includes(lower));
    if (found.length > 0 && found.length <= 5) {
      const lines = found.map(m => {
        const stars = '★'.repeat(m.rating||0) + '☆'.repeat(5-(m.rating||0));
        const rc = (m.reviews||[]).length;
        return '· ' + stars + ' 《' + m.title + '》' + (m.type ? '（' + m.type + '）' : '') + (m.watchDate ? ' ' + fmtDate(m.watchDate) : '') + (rc ? ' 📝' + rc + '篇' : '');
      }).join('\n');
      return '🔍 找到 ' + found.length + ' 部作品\n\n' + lines + reviewCtx;
    }
  }

  // 12. Recent / this month
  if (/最近|近期|这个月|本月/.test(lower)) {
    const now = new Date();
    const monthMs = ms.filter(m => {
      if (!m.watchDate) return false;
      const d = new Date(m.watchDate);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    if (!monthMs.length) return '这个月还没有观影记录哦~ 🗓' + reviewCtx;
    const show = monthMs.slice(0, 10);
    const lines = show.map(m => '· ' + '★'.repeat(m.rating||0) + '☆'.repeat(5-(m.rating||0)) + ' 《' + m.title + '》（' + (m.type||'') + '，' + fmtDate(m.watchDate) + '）').join('\n');
    return '🗓 本月观影（' + monthMs.length + ' 部）\n\n' + lines + reviewCtx;
  }

  // 13. Rating distribution
  if (/评分分布|几星|打分|评分.*几/.test(lower)) {
    const dist = {1:0,2:0,3:0,4:0,5:0};
    watched.forEach(m => { if (m.rating) dist[m.rating]++; });
    const lines = [5,4,3,2,1].map(n => '· ' + '★'.repeat(n) + '☆'.repeat(5-n) + '：' + dist[n] + ' 部').join('\n');
    return '⭐ 评分分布（已看 ' + watched.length + ' 部）\n\n' + lines + reviewCtx;
  }

  // 14. Review mode context
  if (aiChatMode === 'review') {
    return '关于这篇影评，你可以问我更多具体的问题~ 📝\n\n也可以试试问我：\n· "帮助" · "推荐类似的" · "这个类型还有什么" · "评分最高的是哪些"' + reviewCtx;
  }

  // 15. Fallback
  const fallbacks = [
    '我暂时没完全理解 😅\n试试这些问法：\n· "我看了多少电影？" · "推荐一部给我"\n· "今年看了哪些？" · "评分最高的是哪些？"\n· "有哪些科幻片？" · "本月观影记录"\n\n输入"帮助"查看全部~' + reviewCtx,
    '嗯...这个问题我需要再学学 📚\n试试问我：\n· "统计一下" · "最常看的类型"\n· "高分作品" · "想看清单"\n\n输入"帮助"看更多~' + reviewCtx,
    '有意思！试试这些：\n· "想看清单" · "在看什么" · "推荐一部"\n· "2024年看了哪些？" · 或者直接输入电影名搜索\n\n输入"帮助"查看完整功能~' + reviewCtx
  ];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

async function sendAIChat() {
  if (aiChatLoading) return;
  const input = document.getElementById('aiChatInput');
  const content = input.value.trim();
  if (!content) return;

  aiChatMessages.push({ role: 'user', content, time: new Date().toISOString() });
  input.value = '';
  renderAIChatMessages();

  if (aiChatMode === 'review') {
    const chats = loadChatMessages();
    chats[aiChatReviewId] = aiChatMessages;
    saveChatMessages(chats);
  } else {
    saveStandaloneChat(aiChatMessages);
  }

  aiChatLoading = true;
  document.getElementById('aiChatSendBtn').disabled = true;
  document.getElementById('aiChatLoading').style.display = 'flex';

  await new Promise(r => setTimeout(r, 400 + Math.random() * 600));

  const reply = localChatEngine(content);
  aiChatMessages.push({ role: 'assistant', content: reply, time: new Date().toISOString() });

  if (aiChatMode === 'review') {
    const chats = loadChatMessages();
    chats[aiChatReviewId] = aiChatMessages;
    saveChatMessages(chats);
  } else {
    saveStandaloneChat(aiChatMessages);
  }

  aiChatLoading = false;
  document.getElementById('aiChatSendBtn').disabled = false;
  document.getElementById('aiChatLoading').style.display = 'none';
  renderAIChatMessages();
  document.getElementById('aiChatInput').focus();
}

function retryAIChat() {
  if (aiChatLoading) return;
  while (aiChatMessages.length > 0) {
    const last = aiChatMessages[aiChatMessages.length - 1];
    if (last.role === 'assistant' || last.role === 'error') { aiChatMessages.pop(); }
    else break;
  }
  const lastUser = aiChatMessages[aiChatMessages.length - 1];
  if (lastUser && lastUser.role === 'user') {
    aiChatMessages.pop();
    if (aiChatMode === 'review') {
      const chats = loadChatMessages();
      chats[aiChatReviewId] = aiChatMessages;
      saveChatMessages(chats);
    } else {
      saveStandaloneChat(aiChatMessages);
    }
    document.getElementById('aiChatInput').value = lastUser.content;
    sendAIChat();
  }
}

function clearAIChat() {
  if (!confirm('确定清空当前对话记录吗？')) return;
  aiChatMessages = [];
  if (aiChatMode === 'review') {
    const chats = loadChatMessages();
    delete chats[aiChatReviewId];
    saveChatMessages(chats);
  } else {
    saveStandaloneChat([]);
  }
  renderAIChatMessages();
  showToast('对话已清空');
}

