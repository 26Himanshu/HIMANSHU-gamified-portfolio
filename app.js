// ===== Canvas setup =====
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// ===== Game state =====
const state = JSON.parse(localStorage.getItem('balloonResumeState')||'{}');
state.unlocked = new Set(state.unlocked||[]);
state.score = state.score||0;

const HUD = {
  scoreEl: document.getElementById('score'),
  poppedEl: document.getElementById('popped'),
  bagEl: document.getElementById('badgelist')
};

function save(){ localStorage.setItem('balloonResumeState', JSON.stringify({score:state.score, unlocked:[...state.unlocked]})); }

// ===== Player (cannon) =====
const player = { x: canvas.width/2, y: canvas.height-30, w: 50, h: 14, speed: 4, aimX: canvas.width/2, aimY: canvas.height/2 };

// bullets
const shots = [];

// balloons (targets)
const sections = [
  {id:'about', label:'About', color:'#9a6bff'},
  {id:'skills', label:'Skills', color:'#11e6ff'},
  {id:'projects', label:'Projects', color:'#ffd66b'},
  {id:'experience', label:'Experience', color:'#22c55e'},
  {id:'contact', label:'Contact', color:'#f472b6'}
];

let balloons = [];

function spawnWave(){
  balloons = sections.map((s,i)=>({
    id:s.id,label:s.label,color:s.color,
    x: 80 + i*170 + Math.random()*40,
    y: canvas.height + 40 + Math.random()*80,
    r: 24,
    vy: -(1.2 + Math.random()*0.6),
    sway: Math.random()*2+1,
    phase: Math.random()*Math.PI*2,
    popped:false
  }));
}

// ===== Input =====
const keys = new Set();
document.addEventListener('keydown', e=>{
  keys.add(e.key.toLowerCase());
  if(e.code==='Space'){ shoot(); }
});
document.addEventListener('keyup', e=> keys.delete(e.key.toLowerCase()));
canvas.addEventListener('mousemove', (e)=>{
  const rect = canvas.getBoundingClientRect();
  player.aimX = (e.clientX - rect.left) * (canvas.width / rect.width);
  player.aimY = (e.clientY - rect.top) * (canvas.height / rect.height);
});
canvas.addEventListener('click', shoot);

// mobile controls
const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');
const fireBtn = document.getElementById('fireBtn');
let leftHeld=false,rightHeld=false;
['pointerdown','touchstart'].forEach(ev=>{
  leftBtn.addEventListener(ev,()=>leftHeld=true);
  rightBtn.addEventListener(ev,()=>rightHeld=true);
  fireBtn.addEventListener(ev,shoot);
});
['pointerup','pointerleave','touchend','touchcancel'].forEach(ev=>{
  leftBtn.addEventListener(ev,()=>leftHeld=false);
  rightBtn.addEventListener(ev,()=>rightHeld=false);
});

// ===== Audio (tiny synth) =====
let audioCtx=null, muted=true;
function blip(freq=820, dur=0.12){ if(muted) return; if(!audioCtx) audioCtx=new (window.AudioContext||window.webkitAudioContext)(); const o=audioCtx.createOscillator(); const g=audioCtx.createGain(); o.type='square'; o.frequency.value=freq; g.gain.value=0.0008; o.connect(g); g.connect(audioCtx.destination); o.start(); g.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime+dur); setTimeout(()=>o.stop(),dur*1000); }

// ===== Core loop =====
function update(){
  // move player
  if(keys.has('a')||leftHeld) player.x -= player.speed;
  if(keys.has('d')||rightHeld) player.x += player.speed;
  player.x = Math.max(40, Math.min(canvas.width-40, player.x));

  // bullets
  for(const s of shots){ s.x += s.vx; s.y += s.vy; s.vy*=0.997; s.life--; }
  for(let i=shots.length-1;i>=0;i--){ if(shots[i].life<=0 || shots[i].y<-20) shots.splice(i,1); }

  // balloons
  for(const b of balloons){
    b.y += b.vy; b.x += Math.sin(perf/700 + b.phase) * 0.6 * b.sway;
    // string wiggle visual only
    if(!b.popped){
      // collision
      for(const s of shots){ if(dist(s.x,s.y,b.x,b.y) < b.r){ pop(b); s.life=0; break; } }
      // reached top -> reset
      if(b.y < -40){ b.y = canvas.height + 60; b.x = 80 + Math.random()*(canvas.width-160); }
    }
  }
}

function draw(){
  // sky
  const grd = ctx.createLinearGradient(0,0,0,canvas.height);
  grd.addColorStop(0,'#0b1538'); grd.addColorStop(1,'#0a1022');
  ctx.fillStyle = grd; ctx.fillRect(0,0,canvas.width,canvas.height);

  // subtle stars
  for(let i=0;i<60;i++){
    ctx.globalAlpha = 0.2 + Math.random()*0.3;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect((i*97 + (perf/10)%canvas.width)%canvas.width, (i*53)%canvas.height, 1, 1);
  }
  ctx.globalAlpha=1;

  // balloons
  for(const b of balloons){
    if(b.popped) continue;
    // string
    ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(b.x, b.y + b.r); ctx.lineTo(b.x, b.y + b.r + 30); ctx.stroke();
    // body
    const g = ctx.createRadialGradient(b.x-6,b.y-6,6,b.x,b.y,b.r);
    g.addColorStop(0,'#ffffff'); g.addColorStop(1,b.color);
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(b.x,b.y,b.r*0.9,b.r,0,0,Math.PI*2); ctx.fill();
    // label
    ctx.fillStyle='rgba(0,0,0,.6)'; ctx.font='bold 12px sans-serif'; const tw = ctx.measureText(b.label).width; ctx.fillRect(b.x-tw/2-6,b.y-8-12, tw+12,16);
    ctx.fillStyle='#eaf1ff'; ctx.fillText(b.label, b.x-tw/2, b.y-8);
  }

  // shots
  ctx.fillStyle = '#d1e3ff';
  for(const s of shots){ ctx.beginPath(); ctx.arc(s.x,s.y,2,0,Math.PI*2); ctx.fill(); }

  // player cannon
  ctx.save();
  const ang = Math.atan2(player.aimY - player.y, player.aimX - player.x);
  ctx.translate(player.x, player.y);
  // barrel
  ctx.rotate(ang);
  ctx.fillStyle = '#cfe0ff'; ctx.fillRect(0,-3,38,6);
  ctx.rotate(-ang);
  // base
  ctx.fillStyle = '#9fb1d1'; ctx.fillRect(-player.w/2,-player.h/2,player.w,player.h);
  ctx.restore();

  // UI aim dot
  ctx.beginPath(); ctx.arc(player.aimX, player.aimY, 3, 0, Math.PI*2); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fill();
}

// ===== Actions =====
function shoot(){
  const ang = Math.atan2(player.aimY - player.y, player.aimX - player.x);
  shots.push({x:player.x+Math.cos(ang)*36, y:player.y+Math.sin(ang)*36, vx:Math.cos(ang)*7, vy:Math.sin(ang)*7, life:80});
  blip(1100,0.08);
}

function pop(b){
  if(b.popped) return; b.popped=true; state.score += 50; reveal(b.id, b.label); blip(620,0.18); burst(b.x,b.y,b.color); updateHUD(); save();
  // respawn later
  setTimeout(()=>{ b.y = canvas.height + 80; b.popped=false; }, 2200);
}

function updateHUD(){
  HUD.scoreEl.textContent = state.score;
  HUD.poppedEl.textContent = Math.min(state.unlocked.size,5);
  HUD.bagEl.innerHTML='';
  [...state.unlocked].forEach(s=>{ const el=document.createElement('div'); el.className='pill'; el.textContent=s; HUD.bagEl.appendChild(el); });
}

function dist(a,b,c,d){ return Math.hypot(a-c,b-d); }

// ===== Particles =====
const particles = [];
function burst(x,y,color){
  for(let i=0;i<30;i++){
    particles.push({x,y,vx:(Math.random()-0.5)*3.4,vy:(Math.random()-0.5)*3.4,a:1,c:color});
  }
}
function drawParticles(){
  for(const p of particles){
    ctx.fillStyle = p.c.replace('#','')? p.c : '#ffffff';
    ctx.globalAlpha = p.a; ctx.fillRect(p.x,p.y,2,2); ctx.globalAlpha = 1;
    p.x+=p.vx; p.y+=p.vy; p.a-=0.02;
  }
  for(let i=particles.length-1;i>=0;i--){ if(particles[i].a<=0) particles.splice(i,1); }
  requestAnimationFrame(drawParticles);
}

// ===== Panel content =====
const panel = document.getElementById('panel');
const content = document.getElementById('content');
const panelTitle = document.getElementById('panelTitle');

function reveal(id,label){
  if(!state.unlocked.has(label)) state.unlocked.add(label);
  panelTitle.textContent = label; content.innerHTML = buildSection(id); panel.showModal();
}

function buildSection(id){
  if(id==='about') return `
    <div class="section">
      <h2>About</h2>
      <p style="color:var(--muted);line-height:1.6">Hi, I'm <strong>Himanshu</strong>, a <strong>Web Developer</strong> and <strong>Full‑Stack Developer</strong>. I craft responsive UIs and scalable backends, turning ideas into shipped features.</p>
    </div>
    <div class="section">
      <h2>Highlights</h2>
      <div class="pill">JavaScript / TypeScript</div>
      <div class="pill">React · Next.js</div>
      <div class="pill">Node.js · Express</div>
      <div class="pill">MongoDB · PostgreSQL</div>
      <div class="pill">REST · GraphQL</div>
      <div class="pill">Git · CI/CD</div>
      <div class="pill">Docker · Linux</div>
    </div>`;

  if(id==='skills') return `
    <div class="section">
      <h2>Skills & Stats</h2>
      ${skill('JavaScript/TypeScript', 90)}
      ${skill('React / Next.js', 88)}
      ${skill('Node.js / Express', 86)}
      ${skill('MongoDB / PostgreSQL', 80)}
      ${skill('HTML / CSS / Tailwind', 92)}
      ${skill('Git / CI‑CD', 84)}
      ${skill('Docker / Linux', 72)}
    </div>`;

  if(id==='projects') return `
    <div class="section">
      <h2>Projects</h2>
      <div class="pill">DevQuest — Gamified Resume</div>
      <div class="pill">ShopSphere — E‑commerce (MERN)</div>
      <div class="pill">TaskForge — Kanban + Realtime</div>
      <div class="pill">Portfolio — Next.js SSR/ISR</div>
      <p style="color:var(--muted);margin-top:8px">currently working on NEXTUP (professional marketing app).</p>
    </div>`;

  if(id==='experience') return `
    <div class="section">
      <h2>Experience (Sample)</h2>
      <ul style="margin:0;padding-left:18px;line-height:1.7;color:#cfe0ff">
        <li><strong>Full‑Stack Developer</strong> — Built MERN apps: auth, dashboards, file uploads, realtime Socket.IO.</li>
        <li><strong>API Developer</strong> — Designed REST/GraphQL APIs; caching, validation, logging, tests; CI with GitHub Actions.</li>
        <li><strong>Frontend Engineer</strong> — Next.js SPA; improved Web Vitals via code‑splitting & lazy‑loading.</li>
      </ul>
    </div>`;

  if(id==='contact') return `
    <div class="section">
      <h2>Contact</h2>
      <p style="color:#cfe0ff">Email:himanshu.jan26@gmail.com</em> · GitHub: <em>https://github.com/26Himanshu</em> · Location:DELHI(Johri enclave)</em></p>
    </div>`;

  return '<div class="section"><h2>Unknown</h2></div>'
}

function skill(name,pct){
  return `<div style="margin:10px 0"> <div style="display:flex;justify-content:space-between;margin-bottom:6px"><strong>${name}</strong><span style="color:var(--muted)">${pct}%</span></div> <div class="progress"><i style="width:${pct}%"></i></div> </div>`
}

// ===== UI buttons =====
const splash = document.getElementById('splash');
document.getElementById('startBtn').onclick=()=>{ muted=false; splash.style.display='none'; };
document.getElementById('muteOnStart').onclick=()=>{ muted=true; splash.style.display='none'; };
document.getElementById('soundBtn').onclick=()=>{ muted=!muted; toast(muted? 'Sound muted' : 'Sound on'); };
document.getElementById('closeBtn').onclick=()=>panel.close();
document.getElementById('gotIt').onclick=()=>panel.close();
document.getElementById('printBtn').onclick=()=>window.print();
document.getElementById('resetBtn').onclick=()=>{ localStorage.removeItem('balloonResumeState'); location.reload(); };
document.getElementById('copyLink').onclick=()=>{ const url = location.href.split('#')[0]; navigator.clipboard.writeText(url).then(()=>toast('Link copied!')).catch(()=>toast('Copy failed')) };

function toast(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.style.display='block'; clearTimeout(t._h); t._h=setTimeout(()=>t.style.display='none',1800); }

// ===== Game loop =====
let perf=0;
function loop(t){ perf=t; update(); draw(); requestAnimationFrame(loop); }

// ===== Init =====
function start(){ spawnWave(); updateHUD(); loop(0); }
start();
drawParticles();
