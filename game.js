'use strict';
// ============================================================
//  CONSTANTS
// ============================================================
const CELL   = 20;
const COLS   = 38;
const ROWS   = 24;
const W      = COLS * CELL;   // 760
const H      = ROWS * CELL;   // 480
const BORDER = 22;
const CW     = W + BORDER * 2; // 804
const CH     = H + BORDER * 2; // 524

const FRUIT_TYPES = [
  {key:'apple',  pts:1, glowR:220,glowG:50, glowB:50,  w:0.38},
  {key:'orange', pts:2, glowR:230,glowG:130,glowB:30,  w:0.26},
  {key:'grape',  pts:3, glowR:130,glowG:60, glowB:200, w:0.17},
  {key:'berry',  pts:4, glowR:200,glowG:30, glowB:80,  w:0.11},
  {key:'melon',  pts:3, glowR:60, glowG:200,glowB:80,  w:0.05},
  {key:'star',   pts:5, glowR:245,glowG:197,glowB:24,  w:0.03},
];

// Base tick speeds (ms) by level index 0-9
const BASE_SPEEDS  = [165,148,132,118,105,93,82,72,63,55];
const DIFF_MULT    = {easy:0.65,normal:1.00,hard:1.40,insane:1.85};
const BIAS_MULT    = [0.70,0.85,1.00,1.22,1.50];
const LV_THRESH    = [0,8,20,36,56,80,110,145,185,230];

// Blitz mode: fruit lifespan range (ms)
const BLITZ_LIFE_MIN = 4000;
const BLITZ_LIFE_MAX = 9000;
const BLITZ_MAX_FRUITS = 6;
const BLITZ_SPAWN_INTERVAL = 2200; // ms between spawns

const MAZE_LAYOUTS = [
  [{x:10,y:4},{x:10,y:5},{x:10,y:6},{x:10,y:7},{x:10,y:8},{x:10,y:15},{x:10,y:16},{x:10,y:17},{x:10,y:18},{x:10,y:19},{x:27,y:4},{x:27,y:5},{x:27,y:6},{x:27,y:7},{x:27,y:8},{x:27,y:15},{x:27,y:16},{x:27,y:17},{x:27,y:18},{x:27,y:19},{x:14,y:11},{x:15,y:11},{x:16,y:11},{x:21,y:11},{x:22,y:11},{x:23,y:11}],
  [{x:8,y:3},{x:8,y:4},{x:8,y:5},{x:8,y:6},{x:8,y:7},{x:8,y:8},{x:8,y:9},{x:8,y:10},{x:8,y:11},{x:19,y:12},{x:19,y:13},{x:19,y:14},{x:19,y:15},{x:19,y:16},{x:19,y:17},{x:19,y:18},{x:19,y:19},{x:19,y:20},{x:29,y:3},{x:29,y:4},{x:29,y:5},{x:29,y:6},{x:29,y:7},{x:29,y:8},{x:29,y:9},{x:29,y:10},{x:29,y:11}],
  [{x:7,y:5},{x:8,y:5},{x:9,y:5},{x:7,y:9},{x:8,y:9},{x:9,y:9},{x:7,y:6},{x:7,y:7},{x:7,y:8},{x:9,y:6},{x:9,y:7},{x:9,y:8},{x:28,y:5},{x:29,y:5},{x:30,y:5},{x:28,y:9},{x:29,y:9},{x:30,y:9},{x:28,y:6},{x:28,y:7},{x:28,y:8},{x:30,y:6},{x:30,y:7},{x:30,y:8},{x:17,y:9},{x:18,y:9},{x:19,y:9},{x:20,y:9},{x:17,y:14},{x:18,y:14},{x:19,y:14},{x:20,y:14},{x:17,y:10},{x:17,y:11},{x:17,y:12},{x:17,y:13},{x:20,y:10},{x:20,y:11},{x:20,y:12},{x:20,y:13}],
];

// ============================================================
//  SETTINGS
// ============================================================
let S = {
  color:'green',skin:'smooth',pattern:'round',eyeStyle:'slit',
  mode:'classic',diff:'normal',
  snakeSize:1,speedBias:2,
  sound:true,shake:true,grid:false,particles:true,trail:true,
};

function loadSettings(){
  try{ const s=localStorage.getItem('sp2_cfg'); if(s) Object.assign(S, JSON.parse(s)); }catch(e){}
}

// ============================================================
//  PALETTES
// ============================================================
const PALETTES = {
  green:  {head:'#52e030',body:'#2aaa14',dark:'#165a08'},
  lime:   {head:'#c8ff30',body:'#8acc10',dark:'#4a7800'},
  cyan:   {head:'#30d8e8',body:'#10a0c0',dark:'#085878'},
  blue:   {head:'#4080ff',body:'#2050d0',dark:'#102880'},
  purple: {head:'#a060ff',body:'#7030d0',dark:'#3a1070'},
  pink:   {head:'#ff50b0',body:'#d02080',dark:'#780040'},
  red:    {head:'#ff5040',body:'#d01820',dark:'#780008'},
  orange: {head:'#ff8820',body:'#d05808',dark:'#783000'},
  yellow: {head:'#ffe040',body:'#c0a000',dark:'#785000'},
  white:  {head:'#e8ffe8',body:'#a0c8a0',dark:'#507050'},
  teal:   {head:'#20e8b0',body:'#10b080',dark:'#085840'},
  magenta:{head:'#ff30c0',body:'#c010a0',dark:'#700060'},
};

// ============================================================
//  STATE
// ============================================================
let snake=[], dir={x:1,y:0}, dirBuffer=[];
let food=null;                  // classic/endless/timed/maze: single food
let blitzFruits=[];             // blitz mode: [{x,y,type,spawnTime,life}]
let blitzLastSpawn=0;
let walls=[];
let score=0, level=1, gameState='idle';
let tickTimer=null, animFrame=null;
let particles=[], floatTexts=[], trailDots=[];
let totalTicks=0;
let gameStartTime=0, timeLeft=90000;
let shakeFrames=0, shakeX=0, shakeY=0;
let bgCanvas=null, grassBlades=[];
let levelUpAnim=0;
let canvas, ctx;

// ============================================================
//  INIT
// ============================================================
function init(){
  loadSettings();
  canvas=document.getElementById('gameCanvas');
  ctx=canvas.getContext('2d',{alpha:false});
  canvas.width=CW; canvas.height=CH;

  buildBg();
  buildGrass();
  setupInput();
  setupMobile();
  startRenderLoop();
  showOverlay('start');
  updateStartDesc();
}

// ============================================================
//  BACKGROUND
// ============================================================
function buildBg(){
  bgCanvas=document.createElement('canvas');
  bgCanvas.width=CW; bgCanvas.height=CH;
  const b=bgCanvas.getContext('2d');

  // Rich grass border
  b.fillStyle='#2a6a10'; b.fillRect(0,0,CW,CH);
  const gg=b.createRadialGradient(CW/2,CH/2,0,CW/2,CH/2,CW*.72);
  gg.addColorStop(0,'rgba(80,170,30,.20)'); gg.addColorStop(1,'rgba(10,40,4,.44)');
  b.fillStyle=gg; b.fillRect(0,0,CW,CH);
  [[0,0],[CW,0],[0,CH],[CW,CH]].forEach(([cx,cy])=>{
    const cg=b.createRadialGradient(cx,cy,0,cx,cy,70);
    cg.addColorStop(0,'rgba(0,0,0,.33)'); cg.addColorStop(1,'rgba(0,0,0,0)');
    b.fillStyle=cg; b.fillRect(0,0,CW,CH);
  });

  // ── Colourful stylish flowers all around border ──
  const FDATA=[
    ['#ff60a0','#ffe060'],['#ff9030','#fff060'],['#ffe040','#ff8020'],
    ['#60c8ff','#ffffff'],['#c060ff','#ffe080'],['#ff4060','#ffe060'],
    ['#40e8b0','#ffffff'],['#ff80d0','#ffc040'],['#ffb030','#ff6020'],
    ['#80ff60','#ffff80'],['#ff50c0','#fff080'],['#50d0ff','#ffffff'],
    ['#ff6050','#ffffa0'],['#a0ff50','#ffff60'],['#ff40a0','#ffe0ff'],
  ];
  const irnd=n=>Math.floor(Math.random()*n);
  const rnd=n=>Math.random()*n;

  // Distribute flowers around all 4 edges inside the grass border
  const positions=[];
  // Top + Bottom edges
  for(let x=8; x<CW-8; x+=16+irnd(10)){
    positions.push({x:x+irnd(5)-2, y:4+irnd(9),     edge:'top'});
    positions.push({x:x+irnd(5)-2, y:CH-4-irnd(9),  edge:'bot'});
  }
  // Left + Right edges
  for(let y=8; y<CH-8; y+=16+irnd(10)){
    positions.push({x:4+irnd(9),    y:y+irnd(5)-2,  edge:'lt'});
    positions.push({x:CW-4-irnd(9), y:y+irnd(5)-2,  edge:'rt'});
  }

  positions.forEach(fp=>{
    const [fc,pc]=FDATA[irnd(FDATA.length)];
    const pr=2.5+rnd(1.8);  // petal radius
    const sl=6+rnd(5);       // stem length

    b.save();
    // Stem toward board interior
    b.strokeStyle='#3aaa14'; b.lineWidth=1.1; b.lineCap='round';
    let tx=fp.x, ty=fp.y;
    if(fp.edge==='top') ty=fp.y+sl;
    else if(fp.edge==='bot') ty=fp.y-sl;
    else if(fp.edge==='lt')  tx=fp.x+sl;
    else                     tx=fp.x-sl;
    b.beginPath(); b.moveTo(tx,ty); b.lineTo(fp.x,fp.y); b.stroke();

    // Petals
    b.translate(fp.x,fp.y);
    const np=5+irnd(2);
    for(let p=0;p<np;p++){
      const pa=p/np*Math.PI*2+rnd(0.4);
      b.fillStyle=fc+'bb';
      b.beginPath();
      b.ellipse(Math.cos(pa)*pr*1.3,Math.sin(pa)*pr*1.3,pr,pr*0.52,pa,0,Math.PI*2);
      b.fill();
    }
    // Centre
    b.fillStyle=pc;
    b.beginPath(); b.arc(0,0,pr*0.52,0,Math.PI*2); b.fill();
    b.restore();
  });

  // Dirt playing field
  b.fillStyle='#7a5c2e'; b.fillRect(BORDER,BORDER,W,H);
  for(let i=0;i<500;i++){
    const x=BORDER+Math.random()*W,y=BORDER+Math.random()*H,r=Math.random()*4+1;
    b.fillStyle=Math.random()>.5?`rgba(0,0,0,${Math.random()*.08})`:`rgba(180,140,60,${Math.random()*.06})`;
    b.beginPath();b.arc(x,y,r,0,Math.PI*2);b.fill();
  }
  const dv=b.createRadialGradient(BORDER+W/2,BORDER+H/2,H*.08,BORDER+W/2,BORDER+H/2,H*.80);
  dv.addColorStop(0,'rgba(0,0,0,0)'); dv.addColorStop(1,'rgba(0,0,0,.28)');
  b.fillStyle=dv; b.fillRect(BORDER,BORDER,W,H);
  b.strokeStyle='#4a3010'; b.lineWidth=3; b.strokeRect(BORDER-1.5,BORDER-1.5,W+3,H+3);
  b.strokeStyle='rgba(180,140,70,.22)'; b.lineWidth=1; b.strokeRect(BORDER+1,BORDER+1,W-2,H-2);
}

// ============================================================
//  GRASS BLADES (animated)
// ============================================================
function buildGrass(){
  grassBlades=[];
  const sp=7;
  const add=(x,y,d)=>grassBlades.push({x,y,dir:d,h:7+Math.random()*9,phase:Math.random()*Math.PI*2,speed:.38+Math.random()*.55,col:pickGC()});
  for(let x=3;x<CW-3;x+=sp){add(x,0,'dn');add(x,CH,'up');}
  for(let y=3;y<CH-3;y+=sp){add(0,y,'rt');add(CW,y,'lt');}
}
const GC=['#4fc020','#5dd428','#3aaa12','#6be030','#2e8a10','#7af040','#48c418','#62d82c'];
function pickGC(){return GC[Math.floor(Math.random()*GC.length)];}

function drawGrass(t){
  const M=1;
  grassBlades.forEach(b=>{
    const sw=Math.sin(t*b.speed+b.phase)*2.8;
    ctx.save();ctx.strokeStyle=b.col;ctx.lineWidth=1.4;ctx.lineCap='round';
    let x1,y1,x2,y2,cpx,cpy;
    if(b.dir==='dn'){x1=b.x;y1=M;y2=Math.min(BORDER-M,y1+b.h);x2=b.x+sw;cpx=b.x+sw*.5;cpy=y1+b.h*.6;}
    else if(b.dir==='up'){x1=b.x;y1=CH-M;y2=Math.max(CH-BORDER+M,y1-b.h);x2=b.x+sw;cpx=b.x+sw*.5;cpy=y1-b.h*.6;}
    else if(b.dir==='rt'){y1=b.y;x1=M;x2=Math.min(BORDER-M,x1+b.h);y2=b.y+sw;cpx=x1+b.h*.6;cpy=b.y+sw*.5;}
    else{y1=b.y;x1=CW-M;x2=Math.max(CW-BORDER+M,x1-b.h);y2=b.y+sw;cpx=x1-b.h*.6;cpy=b.y+sw*.5;}
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.quadraticCurveTo(cpx,cpy,x2,y2);ctx.stroke();
    ctx.restore();
  });
}

// ============================================================
//  HELPERS
// ============================================================
const gcx=c=>BORDER+c*CELL+CELL/2;
const gcy=r=>BORDER+r*CELL+CELL/2;
function lerp(a,b,t){return a+(b-a)*t;}
function hexToRgb(h){return[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];}
function lerpHex(h1,h2,t){const[r1,g1,b1]=hexToRgb(h1),[r2,g2,b2]=hexToRgb(h2);return`rgb(${Math.round(lerp(r1,r2,t))},${Math.round(lerp(g1,g2,t))},${Math.round(lerp(b1,b2,t))})`;}
function lightenRgb(rgb,a){const m=(rgb.match(/\d+/g)||[80,160,40]).map(Number);return`rgb(${Math.min(255,m[0]+a)},${Math.min(255,m[1]+a)},${Math.min(255,m[2]+a)})`;}
function getPal(){return PALETTES[S.color]||PALETTES.green;}
function getBodyR(){return CELL/2-0.5+(S.snakeSize||1)*0.7;}

// ============================================================
//  GRID OVERLAY
// ============================================================
function drawGridOverlay(){
  if(!S.grid)return;
  ctx.save();ctx.strokeStyle='rgba(0,0,0,.07)';ctx.lineWidth=.5;
  for(let c=0;c<=COLS;c++){ctx.beginPath();ctx.moveTo(BORDER+c*CELL,BORDER);ctx.lineTo(BORDER+c*CELL,BORDER+H);ctx.stroke();}
  for(let r=0;r<=ROWS;r++){ctx.beginPath();ctx.moveTo(BORDER,BORDER+r*CELL);ctx.lineTo(BORDER+W,BORDER+r*CELL);ctx.stroke();}
  ctx.restore();
}

// ============================================================
//  WALLS
// ============================================================
function drawWalls(){
  walls.forEach(w=>{
    const wx=BORDER+w.x*CELL,wy=BORDER+w.y*CELL;
    const wg=ctx.createLinearGradient(wx,wy,wx+CELL,wy+CELL);
    wg.addColorStop(0,'#5a4530');wg.addColorStop(1,'#3a2a18');
    ctx.fillStyle=wg;ctx.fillRect(wx+1,wy+1,CELL-2,CELL-2);
    ctx.strokeStyle='rgba(200,160,80,.28)';ctx.lineWidth=1;ctx.strokeRect(wx+1.5,wy+1.5,CELL-3,CELL-3);
    ctx.fillStyle='rgba(255,220,120,.08)';ctx.fillRect(wx+1,wy+1,CELL-2,3);
  });
}

// ============================================================
//  SNAKE RENDERING
// ============================================================
function drawSnake(t){
  if(!snake.length)return;
  const pal=getPal(), r=getBodyR();

  // Ghost trail
  if(S.trail){
    trailDots.forEach(td=>{
      ctx.save();ctx.globalAlpha=td.life*.18;
      ctx.fillStyle=pal.body;ctx.beginPath();ctx.arc(td.x,td.y,r*.6,0,Math.PI*2);ctx.fill();ctx.restore();
    });
  }

  // Connections
  for(let i=snake.length-1;i>0;i--){
    const a=snake[i],b=snake[i-1],tc=i/snake.length;
    ctx.strokeStyle=lerpHex(pal.body,pal.dark,tc);
    ctx.lineWidth=r*2;ctx.lineCap='round';
  }

  // Body segments (tail → neck)
  for(let i=snake.length-1;i>=1;i--) drawSeg(i,pal,r,t);

  // Head
  drawHead(pal,r,t);
}

function drawSeg(i,pal,r,t){
  const s=snake[i],x=gcx(s.x),y=gcy(s.y);
  const tc=i/snake.length, col=lerpHex(pal.body,pal.dark,tc);
  const g=ctx.createRadialGradient(x-r*.3,y-r*.3,r*.04,x,y,r);
  g.addColorStop(0,lightenRgb(col,45));g.addColorStop(1,col);
  ctx.save();
  drawSegShape(ctx,x,y,r,g);
  applySkin(ctx,x,y,r,pal,i,t);
  ctx.strokeStyle='rgba(0,0,0,.2)';ctx.lineWidth=.9;
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();
  ctx.restore();
}

function drawSegShape(ctx,x,y,r,fill){
  ctx.fillStyle=fill;
  switch(S.pattern){
    case 'square':
      ctx.beginPath();
      if(ctx.roundRect) ctx.roundRect(x-r*.88,y-r*.88,r*1.76,r*1.76,3);
      else ctx.rect(x-r*.88,y-r*.88,r*1.76,r*1.76);
      ctx.fill();break;
    case 'pill':
      ctx.beginPath();ctx.ellipse(x,y,r*.88,r*.62,0,0,Math.PI*2);ctx.fill();break;
    case 'wave':
      ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,.12)';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.arc(x,y,r*.6,-.5,.5);ctx.stroke();break;
    case 'hex':
      ctx.beginPath();
      for(let k=0;k<6;k++){const a=k/6*Math.PI*2-Math.PI/6;ctx.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r);}
      ctx.closePath();ctx.fill();break;
    case 'star':
      ctx.beginPath();
      for(let k=0;k<5;k++){const oa=k/5*Math.PI*2-Math.PI/2,ia=(k+.5)/5*Math.PI*2-Math.PI/2;ctx.lineTo(x+Math.cos(oa)*r,y+Math.sin(oa)*r);ctx.lineTo(x+Math.cos(ia)*r*.5,y+Math.sin(ia)*r*.5);}
      ctx.closePath();ctx.fill();break;
    default: // round
      ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
  }
}

function applySkin(ctx,x,y,r,pal,idx,t){
  switch(S.skin){
    case 'scales':
      if(idx%2===0){ctx.fillStyle='rgba(0,0,0,.16)';ctx.beginPath();ctx.ellipse(x,y,r*.67,r*.47,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(255,255,255,.07)';ctx.beginPath();ctx.ellipse(x-r*.1,y-r*.1,r*.5,r*.33,-.3,0,Math.PI*2);ctx.fill();}break;
    case 'diamond':
      ctx.fillStyle='rgba(255,255,255,.18)';ctx.beginPath();ctx.moveTo(x,y-r*.72);ctx.lineTo(x+r*.52,y);ctx.lineTo(x,y+r*.72);ctx.lineTo(x-r*.52,y);ctx.closePath();ctx.fill();break;
    case 'neon':
      ctx.save();ctx.shadowColor=pal.head;ctx.shadowBlur=10;ctx.strokeStyle=pal.head+'70';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,r-1,0,Math.PI*2);ctx.stroke();ctx.restore();break;
    case 'dashed':
      if(idx%3===0){ctx.fillStyle='rgba(255,255,255,.26)';ctx.beginPath();ctx.arc(x,y,r*.33,0,Math.PI*2);ctx.fill();}break;
    case 'fire':
      if(idx%2===0){ctx.fillStyle='rgba(255,100,0,.22)';ctx.beginPath();ctx.arc(x,y-r*.15,r*.53,0,Math.PI*2);ctx.fill();}break;
    case 'dots':
      [{dx:r*.35,dy:0},{dx:-r*.35,dy:0},{dx:0,dy:r*.35},{dx:0,dy:-r*.35}].forEach(p=>{
        ctx.fillStyle='rgba(255,255,255,.22)';ctx.beginPath();ctx.arc(x+p.dx,y+p.dy,r*.13,0,Math.PI*2);ctx.fill();});break;
    case 'stripes':
      for(let k=-1;k<=1;k++){ctx.fillStyle='rgba(0,0,0,.12)';ctx.fillRect(x+k*r*.34-1,y-r*.88,2,r*1.76);}break;
  }
}

function drawHead(pal,r,t){
  if(!snake.length)return;
  const h=snake[0],x=gcx(h.x),y=gcy(h.y),angle=Math.atan2(dir.y,dir.x);
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);
  // body connect
  if(snake.length>1){
    const n=snake[1],dx=gcx(n.x)-x,dy=gcy(n.y)-y;
    ctx.save();ctx.rotate(-angle);ctx.strokeStyle=pal.body;ctx.lineWidth=r*2;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(dx*.5,dy*.5);ctx.stroke();ctx.restore();
  }
  const g=ctx.createRadialGradient(-r*.2,-r*.25,r*.04,0,0,r*1.1);
  g.addColorStop(0,pal.head);g.addColorStop(.5,pal.body);g.addColorStop(1,pal.dark);
  ctx.beginPath();ctx.ellipse(0,0,r*1.1,r,0,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,.3)';ctx.lineWidth=1.4;ctx.stroke();
  if(S.skin==='neon'){ctx.save();ctx.shadowColor=pal.head;ctx.shadowBlur=14;ctx.strokeStyle=pal.head+'90';ctx.lineWidth=1.8;ctx.beginPath();ctx.ellipse(0,0,r*1.1,r,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
  ctx.fillStyle='rgba(255,255,255,.15)';ctx.beginPath();ctx.ellipse(-r*.1,-r*.27,r*.52,r*.27,-.2,0,Math.PI*2);ctx.fill();
  drawEyes(ctx,r,t);
  drawTongue(ctx,r,t);
  ctx.restore();
}

function drawEyes(ctx,r,t){
  const ey=r*.5,ex=r*.35;
  [-1,1].forEach(side=>{
    ctx.beginPath();ctx.arc(ex,side*ey,r*.27,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();
    ctx.strokeStyle='#222';ctx.lineWidth=.7;ctx.stroke();
    ctx.save();ctx.translate(ex+r*.06,side*ey);
    switch(S.eyeStyle){
      case 'slit':  ctx.beginPath();ctx.ellipse(0,0,r*.09,r*.19,0,0,Math.PI*2);ctx.fillStyle='#111';ctx.fill();break;
      case 'round': ctx.beginPath();ctx.arc(0,0,r*.16,0,Math.PI*2);ctx.fillStyle='#111';ctx.fill();break;
      case 'angry': ctx.beginPath();ctx.arc(0,0,r*.13,0,Math.PI*2);ctx.fillStyle='#300';ctx.fill();ctx.strokeStyle='#f00';ctx.lineWidth=.5;ctx.stroke();break;
      case 'cute':  ctx.beginPath();ctx.arc(0,0,r*.18,0,Math.PI*2);ctx.fillStyle='#224';ctx.fill();ctx.fillStyle='rgba(100,180,255,.48)';ctx.beginPath();ctx.arc(0,0,r*.08,0,Math.PI*2);ctx.fill();break;
      case 'alien': ctx.beginPath();ctx.ellipse(0,0,r*.19,r*.1,0,0,Math.PI*2);ctx.fillStyle='#050';ctx.fill();break;
    }
    ctx.restore();
    ctx.beginPath();ctx.arc(ex-r*.04,side*ey-r*.08,r*.07,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,.85)';ctx.fill();
  });
}

function drawTongue(ctx,r,t){
  const tw=Math.sin(t*8)*.4,tl=r*.52;
  ctx.strokeStyle='#dd2060';ctx.lineWidth=1.7;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(r,0);ctx.lineTo(r+tl*.5,0);ctx.stroke();
  ctx.beginPath();ctx.moveTo(r+tl*.4,0);ctx.lineTo(r+tl,-r*.3+tw*r);ctx.stroke();
  ctx.beginPath();ctx.moveTo(r+tl*.4,0);ctx.lineTo(r+tl, r*.3+tw*r);ctx.stroke();
}

// ============================================================
//  FRUIT DRAWING
// ============================================================
function pickFruitType(){
  const rnd=Math.random();let acc=0;
  for(const f of FRUIT_TYPES){acc+=f.w;if(rnd<acc)return f;}
  return FRUIT_TYPES[0];
}

function drawFood(t){
  if(!food)return;
  drawFruitAt(food.x,food.y,food.type,t,1.0);
}

function drawBlitzFruits(t){
  const now=Date.now();
  blitzFruits.forEach(bf=>{
    const age=now-bf.spawnTime;
    const lifeRatio=1-age/bf.life; // 1.0 → 0.0
    if(lifeRatio<=0)return;
    drawFruitAt(bf.x,bf.y,bf.type,t,lifeRatio);
    // Timer ring around fruit
    const cx2=gcx(bf.x),cy2=gcy(bf.y);
    ctx.save();
    ctx.strokeStyle=lifeRatio>.4?`rgba(58,255,80,${lifeRatio*.7})`:`rgba(255,80,40,${lifeRatio*.9})`;
    ctx.lineWidth=2.5;
    ctx.beginPath();ctx.arc(cx2,cy2,CELL*.7,-.5*Math.PI,-.5*Math.PI+lifeRatio*Math.PI*2);ctx.stroke();
    // Points label
    ctx.font=`bold 9px 'Orbitron',monospace`;ctx.textAlign='center';ctx.fillStyle=`rgba(255,255,255,${lifeRatio*.8})`;
    ctx.fillText('+'+bf.type.pts,cx2,cy2+CELL*.85);
    ctx.restore();
  });
}

function drawFruitAt(fx,fy,ft,t,alpha){
  const x=gcx(fx),y=gcy(fy);
  const bob=Math.sin(t*2.5)*2.5;
  const pulse=1+Math.sin(t*4)*.05;
  const r=CELL/2-2;
  ctx.save();
  ctx.globalAlpha=alpha;
  ctx.translate(x,y+bob);ctx.scale(pulse,pulse);
  // shadow
  ctx.fillStyle='rgba(0,0,0,.2)';ctx.beginPath();ctx.ellipse(0,CELL/2+3,r*.72,r*.26,0,0,Math.PI*2);ctx.fill();
  // glow
  const gl=ctx.createRadialGradient(0,0,2,0,0,CELL);
  gl.addColorStop(0,`rgba(${ft.glowR},${ft.glowG},${ft.glowB},.48)`);gl.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=gl;ctx.beginPath();ctx.arc(0,0,CELL,0,Math.PI*2);ctx.fill();
  switch(ft.key){
    case 'apple':  drawApple(ctx,r);break;
    case 'orange': drawOrange(ctx,r);break;
    case 'grape':  drawGrape(ctx,r);break;
    case 'berry':  drawBerry(ctx,r);break;
    case 'melon':  drawMelon(ctx,r);break;
    case 'star':   drawStar(ctx,r,t);break;
  }
  ctx.restore();
}

function drawApple(c,r){const g=c.createRadialGradient(-r*.25,-r*.3,r*.04,0,0,r);g.addColorStop(0,'#ff7070');g.addColorStop(.5,'#e8250a');g.addColorStop(1,'#8b0000');c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.fillStyle=g;c.fill();c.fillStyle='rgba(0,0,0,.12)';c.beginPath();c.arc(0,-r*.8,r*.27,0,Math.PI*2);c.fill();c.fillStyle='rgba(255,255,255,.38)';c.beginPath();c.ellipse(-r*.23,-r*.36,r*.26,r*.16,-.4,0,Math.PI*2);c.fill();c.strokeStyle='#4a2800';c.lineWidth=2;c.lineCap='round';c.beginPath();c.moveTo(0,-r);c.quadraticCurveTo(5,-r-7,3,-r-11);c.stroke();c.fillStyle='#3aaa10';c.beginPath();c.ellipse(5.5,-r-7.5,6,2.5,-.5,0,Math.PI*2);c.fill();}
function drawOrange(c,r){const g=c.createRadialGradient(-r*.2,-r*.25,r*.04,0,0,r);g.addColorStop(0,'#ffb040');g.addColorStop(.6,'#e87010');g.addColorStop(1,'#a04800');c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.fillStyle=g;c.fill();for(let i=0;i<14;i++){const a=i/14*Math.PI*2,d=r*(.45+Math.random()*.33);c.fillStyle='rgba(0,0,0,.07)';c.beginPath();c.arc(Math.cos(a)*d,Math.sin(a)*d,1,0,Math.PI*2);c.fill();}c.fillStyle='rgba(255,255,255,.33)';c.beginPath();c.ellipse(-r*.22,-r*.31,r*.24,r*.14,-.4,0,Math.PI*2);c.fill();c.fillStyle='#4a2800';c.beginPath();c.arc(0,-r*.92,r*.12,0,Math.PI*2);c.fill();}
function drawGrape(c,r){const pos=[[-r*.35,-r*.25],[r*.35,-r*.25],[0,-r*.08],[0,r*.28],[-r*.35,r*.18],[r*.35,r*.18]];const gr=r*.37;pos.forEach(([px,py])=>{const gg=c.createRadialGradient(px-gr*.24,py-gr*.24,gr*.04,px,py,gr);gg.addColorStop(0,'#cc88ff');gg.addColorStop(.6,'#7030c0');gg.addColorStop(1,'#3a0870');c.beginPath();c.arc(px,py,gr,0,Math.PI*2);c.fillStyle=gg;c.fill();c.fillStyle='rgba(255,255,255,.27)';c.beginPath();c.arc(px-gr*.23,py-gr*.27,gr*.26,0,Math.PI*2);c.fill();});c.strokeStyle='#4a2800';c.lineWidth=2;c.lineCap='round';c.beginPath();c.moveTo(0,-r*.65);c.quadraticCurveTo(4,-r-4,2,-r-8);c.stroke();}
function drawBerry(c,r){const g=c.createRadialGradient(-r*.22,-r*.28,r*.04,0,0,r);g.addColorStop(0,'#ff7090');g.addColorStop(.5,'#d81050');g.addColorStop(1,'#700028');c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.fillStyle=g;c.fill();for(let i=0;i<8;i++){const a=i/8*Math.PI*2,d=r*.52;c.fillStyle='rgba(255,255,255,.2)';c.beginPath();c.arc(Math.cos(a)*d,Math.sin(a)*d,1.4,0,Math.PI*2);c.fill();}c.fillStyle='rgba(255,255,255,.36)';c.beginPath();c.ellipse(-r*.22,-r*.33,r*.26,r*.15,-.4,0,Math.PI*2);c.fill();c.fillStyle='#3aaa10';c.beginPath();c.ellipse(-r*.2,-r-r*.08,r*.32,r*.13,-1,0,Math.PI*2);c.fill();c.beginPath();c.ellipse(r*.2,-r-r*.08,r*.32,r*.13,1,0,Math.PI*2);c.fill();}
function drawMelon(c,r){const g=c.createRadialGradient(-r*.2,-r*.25,r*.04,0,0,r);g.addColorStop(0,'#80ff60');g.addColorStop(.5,'#28c030');g.addColorStop(1,'#0a6010');c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.fillStyle=g;c.fill();for(let i=-2;i<=2;i++){c.save();c.rotate(i*.34);c.fillStyle='rgba(0,0,0,.11)';c.fillRect(-1,-r,2,r*2);c.restore();}c.fillStyle='rgba(255,255,255,.3)';c.beginPath();c.ellipse(-r*.2,-r*.31,r*.24,r*.13,-.4,0,Math.PI*2);c.fill();c.strokeStyle='#4a2800';c.lineWidth=2;c.lineCap='round';c.beginPath();c.moveTo(0,-r);c.lineTo(2,-r-9);c.stroke();}
function drawStar(c,r,t){c.save();c.rotate(t*1.2);const g=c.createRadialGradient(0,0,r*.08,0,0,r);g.addColorStop(0,'#fff8a0');g.addColorStop(.4,'#f5c518');g.addColorStop(1,'#c07800');c.fillStyle=g;c.beginPath();for(let i=0;i<5;i++){const oa=i/5*Math.PI*2-Math.PI/2,ia=(i+.5)/5*Math.PI*2-Math.PI/2;if(i===0)c.moveTo(Math.cos(oa)*r,Math.sin(oa)*r);else c.lineTo(Math.cos(oa)*r,Math.sin(oa)*r);c.lineTo(Math.cos(ia)*r*.44,Math.sin(ia)*r*.44);}c.closePath();c.fill();c.strokeStyle='rgba(180,100,0,.4)';c.lineWidth=1;c.stroke();c.fillStyle='rgba(255,255,255,.37)';c.beginPath();c.arc(-r*.1,-r*.24,r*.21,0,Math.PI*2);c.fill();c.restore();}

// ============================================================
//  PARTICLES & FLOATS
// ============================================================
function spawnEatParticles(ft,fx,fy){
  if(!S.particles)return;
  for(let i=0;i<22;i++){
    const a=Math.random()*Math.PI*2,sp=1.5+Math.random()*4.5;
    particles.push({x:gcx(fx),y:gcy(fy),vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-2,r:1.5+Math.random()*3.5,col:`rgb(${ft.glowR},${ft.glowG},${ft.glowB})`,life:1,decay:.022+Math.random()*.018});
  }
}
function spawnFloatText(fx,fy,text,color){
  floatTexts.push({x:gcx(fx),y:gcy(fy)-CELL/2,text,color,vy:-1.4,life:1,decay:.016});
}
function spawnDeathParticles(){
  if(!S.particles)return;
  snake.forEach(s=>{for(let k=0;k<3;k++){const a=Math.random()*Math.PI*2,sp=1+Math.random()*3;particles.push({x:gcx(s.x),y:gcy(s.y),vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-.5,r:Math.random()*3+1.5,col:`hsl(${100+Math.random()*50},70%,50%)`,life:1,decay:.015});}});
}
function updateParticles(){
  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx;p.y+=p.vy;p.vy+=.17;p.vx*=.97;p.life-=p.decay;if(p.life<=0)particles.splice(i,1);}
}
function drawParticles(){
  particles.forEach(p=>{ctx.save();ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle=p.col;ctx.shadowColor=p.col;ctx.shadowBlur=5;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();ctx.restore();});
}
function updateFloats(){
  for(let i=floatTexts.length-1;i>=0;i--){const f=floatTexts[i];f.y+=f.vy;f.vy*=.94;f.life-=f.decay;if(f.life<=0)floatTexts.splice(i,1);}
}
function drawFloats(){
  floatTexts.forEach(f=>{ctx.save();ctx.globalAlpha=Math.max(0,f.life);ctx.font=`bold 14px 'Orbitron',monospace`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=f.color;ctx.shadowColor=f.color;ctx.shadowBlur=9;ctx.fillText(f.text,f.x,f.y);ctx.restore();});
}
function updateTrail(){
  if(!S.trail)return;
  if(snake.length){const h=snake[0];trailDots.push({x:gcx(h.x),y:gcy(h.y),life:1});}
  for(let i=trailDots.length-1;i>=0;i--){trailDots[i].life-=.12;if(trailDots[i].life<=0)trailDots.splice(i,1);}
}

// ============================================================
//  LEVEL-UP ANIM
// ============================================================
function drawLvAnim(){
  if(levelUpAnim<=0)return;
  const al=Math.min(1,levelUpAnim/15),sc=1+(1-levelUpAnim/30)*.3;
  ctx.save();ctx.globalAlpha=al;ctx.translate(BORDER+W/2,BORDER+H/2);ctx.scale(sc,sc);
  ctx.font=`bold 36px 'Orbitron',monospace`;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillStyle='#f5c518';ctx.shadowColor='#f5c518';ctx.shadowBlur=20;ctx.fillText('LEVEL UP!',0,0);ctx.restore();
  levelUpAnim--;
}

// ============================================================
//  HUD
// ============================================================
function updateHUD(){
  const el=id=>document.getElementById(id);
  el('hudScore').textContent=score;
  el('hudLevel').textContent=level;
  el('hudLen').textContent=snake.length;
  el('hudMode').textContent=S.mode.toUpperCase();
  el('hudDiff').textContent=S.diff.toUpperCase();

  // Speed dots
  document.querySelectorAll('.spd-dot').forEach((d,i)=>d.classList.toggle('active',i<Math.min(5,level)));

  // Level bar
  if(S.mode==='endless'||S.mode==='timed'||S.mode==='zen'||S.mode==='blitz'){
    el('lvBarFill').style.width='100%';
  } else {
    const lv=Math.min(level-1,LV_THRESH.length-1),nxt=LV_THRESH[Math.min(level,LV_THRESH.length-1)],prv=LV_THRESH[lv];
    const pct=nxt>prv?Math.min(100,((score-prv)/(nxt-prv))*100):100;
    el('lvBarFill').style.width=pct+'%';
  }

  // Timer
  const te=el('hudTimer');
  if(S.mode==='timed'){
    te.style.display='block';
    const sec=Math.ceil(timeLeft/1000);
    te.textContent=sec+'s';te.style.color=sec<=10?'#ff4040':sec<=30?'#ff8820':'#3aff50';
  } else te.style.display='none';
}

function updateStartDesc(){
  const ml={classic:'Classic Mode',endless:'Endless Mode',timed:'Time Attack (90s)',maze:'Maze Mode',blitz:'Fruit Blitz',zen:'Zen Mode'};
  const dl={easy:'Easy',normal:'Normal',hard:'Hard',insane:'Insane'};
  const el=document.getElementById('startDesc');
  if(el) el.textContent=(ml[S.mode]||'Classic')+' · '+(dl[S.diff]||'Normal');
}

// ============================================================
//  FOOD / BLITZ MANAGEMENT
// ============================================================
function occupiedSet(){
  const s=new Set(snake.map(s=>s.x+','+s.y));
  walls.forEach(w=>s.add(w.x+','+w.y));
  if(food) s.add(food.x+','+food.y);
  blitzFruits.forEach(b=>s.add(b.x+','+b.y));
  return s;
}
function randomFreeCell(){
  const occ=occupiedSet();
  let x,y,tries=0;
  do{x=Math.floor(Math.random()*COLS);y=Math.floor(Math.random()*ROWS);tries++;}
  while(occ.has(x+','+y)&&tries<COLS*ROWS);
  return{x,y};
}
function spawnFood(){
  const c=randomFreeCell();
  food={x:c.x,y:c.y,type:pickFruitType()};
}
function spawnBlitzFruit(){
  if(blitzFruits.length>=BLITZ_MAX_FRUITS)return;
  const c=randomFreeCell();
  const life=BLITZ_LIFE_MIN+(Math.random()*(BLITZ_LIFE_MAX-BLITZ_LIFE_MIN));
  blitzFruits.push({x:c.x,y:c.y,type:pickFruitType(),spawnTime:Date.now(),life});
}
function tickBlitz(){
  const now=Date.now();
  // Remove expired fruits
  const before=blitzFruits.length;
  blitzFruits=blitzFruits.filter(b=>(now-b.spawnTime)<b.life);
  // Spawn if interval passed
  if(now-blitzLastSpawn>BLITZ_SPAWN_INTERVAL){
    spawnBlitzFruit();blitzLastSpawn=now;
  }
}

// ============================================================
//  LEVEL
// ============================================================
function computeLevel(s){
  if(['endless','timed','zen','blitz'].includes(S.mode))return 1;
  let lv=1;
  for(let i=1;i<LV_THRESH.length;i++){if(s>=LV_THRESH[i])lv=i+1;else break;}
  return Math.min(lv,LV_THRESH.length);
}
function getSpeed(){
  const li=Math.min(level-1,BASE_SPEEDS.length-1);
  const dm=DIFF_MULT[S.diff]||1,bm=BIAS_MULT[S.speedBias]||1;
  return Math.max(40,Math.round(BASE_SPEEDS[li]/dm/bm));
}

// ============================================================
//  SHAKE
// ============================================================
function trigShake(){if(!S.shake)return;shakeFrames=14;}
function updShake(){
  if(shakeFrames>0){shakeX=(Math.random()-.5)*8*(shakeFrames/14);shakeY=(Math.random()-.5)*8*(shakeFrames/14);shakeFrames--;}
  else{shakeX=0;shakeY=0;}
}

// ============================================================
//  GAME TICK
// ============================================================
function gameTick(){
  if(gameState!=='playing')return;

  // Apply direction from buffer
  if(dirBuffer.length>0){
    const c=dirBuffer.shift();
    if(!(c.x===-dir.x&&c.y===-dir.y))dir=c;
  }

  totalTicks++;
  const now=Date.now();

  // Timed mode time check
  if(S.mode==='timed'){
    timeLeft=90000-(now-gameStartTime);
    if(timeLeft<=0){timeLeft=0;updateHUD();doGameOver();return;}
  }

  // Blitz: expire old fruits, spawn new
  if(S.mode==='blitz') tickBlitz();

  // Compute new head
  let nx=snake[0].x+dir.x, ny=snake[0].y+dir.y;

  // Wall wrap (zen mode always wraps; others only if opted)
  const wrap=S.mode==='zen'||(S.mode!=='timed'&&S.mode!=='maze');
  if(wrap&&S.mode!=='timed'&&S.mode!=='maze'){
    nx=(nx+COLS)%COLS; ny=(ny+ROWS)%ROWS;
  } else {
    if(nx<0||nx>=COLS||ny<0||ny>=ROWS){doGameOver();return;}
  }

  const newHead={x:nx,y:ny};

  // Self collision (zen: no death by self)
  if(S.mode!=='zen'){
    for(let i=0;i<snake.length-1;i++){
      if(snake[i].x===nx&&snake[i].y===ny){doGameOver();return;}
    }
  } else {
    // Zen: if head hits self, just don't grow but don't die
  }

  // Wall collision (maze)
  for(const w of walls){if(w.x===nx&&w.y===ny){doGameOver();return;}}

  snake.unshift(newHead);

  // Check food (classic/endless/timed/maze/zen)
  let ate=false;
  if(food&&nx===food.x&&ny===food.y){
    const pts=food.type.pts;
    score+=pts;ate=true;
    spawnEatParticles(food.type,food.x,food.y);
    spawnFloatText(food.x,food.y,'+'+pts,'#c8ff80');
    const prev=level;level=computeLevel(score);
    if(level>prev){levelUpAnim=40;playSound('levelup');}else playSound('eat');
    spawnFood();updateHUD();
  }

  // Check blitz fruits
  if(S.mode==='blitz'){
    for(let i=blitzFruits.length-1;i>=0;i--){
      const bf=blitzFruits[i];
      if(bf.x===nx&&bf.y===ny){
        const pts=bf.type.pts;score+=pts;ate=true;
        spawnEatParticles(bf.type,bf.x,bf.y);
        spawnFloatText(bf.x,bf.y,'+'+pts,'#c8ff80');
        playSound('eat');updateHUD();
        blitzFruits.splice(i,1);
      }
    }
    // Ensure at least one fruit exists
    if(blitzFruits.length===0) spawnBlitzFruit();
  }

  if(!ate) snake.pop();

  updateHUD();
  reschedule();
}

function reschedule(){
  clearTimeout(tickTimer);
  if(gameState==='playing') tickTimer=setTimeout(gameTick,getSpeed());
}

// ============================================================
//  GAME OVER
// ============================================================
function doGameOver(){
  gameState='over';clearTimeout(tickTimer);
  trigShake();spawnDeathParticles();playSound('die');

  const rec={score,mode:S.mode,diff:S.diff,length:snake.length,ts:Date.now(),duration:Date.now()-gameStartTime};
  sessionStorage.setItem('sp2_lastRecord',JSON.stringify(rec));

  setTimeout(()=>showOverlay('gameover'),700);
}

// ============================================================
//  START / PAUSE / RESUME
// ============================================================
function startGame(){
  snake=[];
  const sx=Math.floor(COLS*.3),sy=Math.floor(ROWS/2);
  for(let i=0;i<3;i++)snake.push({x:sx-i,y:sy});
  dir={x:1,y:0};dirBuffer=[];
  score=0;level=1;totalTicks=0;
  particles=[];floatTexts=[];trailDots=[];levelUpAnim=0;shakeFrames=0;
  gameStartTime=Date.now();timeLeft=90000;
  blitzFruits=[];blitzLastSpawn=Date.now();

  walls=S.mode==='maze'?[...MAZE_LAYOUTS[Math.floor(Math.random()*MAZE_LAYOUTS.length)]]:[];

  hideOverlays();
  if(S.mode==='blitz'){
    // Spawn initial fruits
    for(let i=0;i<3;i++) spawnBlitzFruit();
  } else {
    spawnFood();
  }
  gameState='playing';
  updateHUD();
  reschedule();
}

function pauseGame(){
  if(gameState!=='playing')return;
  gameState='paused';clearTimeout(tickTimer);showOverlay('pause');
}
function resumeGame(){
  if(gameState!=='paused')return;
  gameState='playing';hideOverlays();reschedule();
}

// ============================================================
//  OVERLAYS
// ============================================================
function showOverlay(name){
  hideOverlays();
  const el=document.getElementById('ov-'+name);
  if(el)el.style.display='flex';
  if(name==='gameover'){
    document.getElementById('goScore').textContent='Score: '+score;
    document.getElementById('goLen').textContent='Length: '+snake.length;
    document.getElementById('goMode').textContent=S.mode.toUpperCase();
    document.getElementById('goDiff').textContent=S.diff;
    document.getElementById('goDur').textContent=fmtDur(Date.now()-gameStartTime);
  }
}
function hideOverlays(){['start','gameover','pause'].forEach(n=>{const e=document.getElementById('ov-'+n);if(e)e.style.display='none';});}
function fmtDur(ms){const s=Math.floor(ms/1000),m=Math.floor(s/60),sec=s%60;return m>0?`${m}m ${sec}s`:`${sec}s`;}

// ============================================================
//  INPUT
// ============================================================
function tryDir(c){
  if(gameState!=='playing')return;
  const eff=dirBuffer.length>0?dirBuffer[dirBuffer.length-1]:dir;
  if(c.x===-eff.x&&c.y===-eff.y)return;
  if(c.x===eff.x&&c.y===eff.y)return;
  if(dirBuffer.length<2)dirBuffer.push(c);
}

function setupInput(){
  document.addEventListener('keydown',e=>{
    switch(e.key){
      case 'ArrowUp':   case 'w':case 'W': e.preventDefault();tryDir({x:0,y:-1});break;
      case 'ArrowDown': case 's':case 'S': e.preventDefault();tryDir({x:0,y:1});break;
      case 'ArrowLeft': case 'a':case 'A': e.preventDefault();tryDir({x:-1,y:0});break;
      case 'ArrowRight':case 'd':case 'D': e.preventDefault();tryDir({x:1,y:0});break;
      case 'p':case 'P': if(gameState==='playing')pauseGame();else if(gameState==='paused')resumeGame();break;
      case 'Escape':     if(gameState==='playing')pauseGame();else if(gameState==='paused')resumeGame();break;
      case 'r':case 'R': if(gameState==='over'||gameState==='paused')startGame();break;
    }
  });

  // Touch swipe
  let tx=0,ty=0,tActive=false;
  canvas.addEventListener('touchstart',e=>{e.preventDefault();tx=e.touches[0].clientX;ty=e.touches[0].clientY;tActive=true;},{passive:false});
  canvas.addEventListener('touchend',e=>{
    if(!tActive)return;tActive=false;
    const dx=e.changedTouches[0].clientX-tx,dy=e.changedTouches[0].clientY-ty;
    if(Math.abs(dx)<12&&Math.abs(dy)<12)return;
    if(Math.abs(dx)>Math.abs(dy))tryDir(dx>0?{x:1,y:0}:{x:-1,y:0});
    else tryDir(dy>0?{x:0,y:1}:{x:0,y:-1});
  },{passive:true});
}

function setupMobile(){
  [['mb-up',{x:0,y:-1}],['mb-dn',{x:0,y:1}],['mb-lt',{x:-1,y:0}],['mb-rt',{x:1,y:0}]].forEach(([id,d])=>{
    const el=document.getElementById(id);if(!el)return;
    el.addEventListener('touchstart',e=>{e.preventDefault();tryDir(d);},{passive:false});
    el.addEventListener('click',()=>tryDir(d));
  });
}

// ============================================================
//  SOUND (Web Audio)
// ============================================================
let aCtx=null;
function getAudio(){if(!aCtx)try{aCtx=new(window.AudioContext||window.webkitAudioContext)();}catch(e){}return aCtx;}
function playSound(type){
  if(!S.sound)return;
  const ac=getAudio();if(!ac)return;
  try{
    const o=ac.createOscillator(),g=ac.createGain();o.connect(g);g.connect(ac.destination);const n=ac.currentTime;
    switch(type){
      case 'eat':     o.type='square';o.frequency.setValueAtTime(440,n);o.frequency.exponentialRampToValueAtTime(880,n+.08);g.gain.setValueAtTime(.1,n);g.gain.exponentialRampToValueAtTime(.001,n+.15);o.start(n);o.stop(n+.15);break;
      case 'levelup': o.type='sawtooth';o.frequency.setValueAtTime(523,n);o.frequency.setValueAtTime(659,n+.1);o.frequency.setValueAtTime(784,n+.2);g.gain.setValueAtTime(.12,n);g.gain.exponentialRampToValueAtTime(.001,n+.4);o.start(n);o.stop(n+.4);break;
      case 'die':     o.type='sawtooth';o.frequency.setValueAtTime(440,n);o.frequency.exponentialRampToValueAtTime(55,n+.5);g.gain.setValueAtTime(.15,n);g.gain.exponentialRampToValueAtTime(.001,n+.6);o.start(n);o.stop(n+.6);break;
    }
  }catch(e){}
}

// ============================================================
//  RENDER LOOP
// ============================================================
function startRenderLoop(){
  function loop(ts){
    const t=ts/1000;
    updShake();updateParticles();updateFloats();updateTrail();

    ctx.save();if(shakeX||shakeY)ctx.translate(shakeX,shakeY);

    // Background
    ctx.drawImage(bgCanvas,0,0);

    // ── Per-mode board atmosphere (drawn over dirt, under fruit/snake) ──
    if(gameState==='playing'||gameState==='paused'){
      ctx.save();
      switch(S.mode){
        case 'endless':
          // Deep blue night tint
          ctx.fillStyle='rgba(20,40,120,.07)';ctx.fillRect(BORDER,BORDER,W,H);
          break;
        case 'timed':
          // Red urgency — pulses faster as time runs low
          {const pulse=timeLeft<20000?0.5+Math.sin(t*8)*.5:timeLeft<45000?0.5+Math.sin(t*4)*.5:0.4;
           ctx.fillStyle=`rgba(180,30,30,${pulse*.06})`;ctx.fillRect(BORDER,BORDER,W,H);}
          break;
        case 'maze':
          // Dark purple dungeon tint + corner torch glow
          ctx.fillStyle='rgba(60,0,120,.10)';ctx.fillRect(BORDER,BORDER,W,H);
          // Torch corner glows
          [[BORDER,BORDER],[BORDER+W,BORDER],[BORDER,BORDER+H],[BORDER+W,BORDER+H]].forEach(([tx,ty])=>{
            const tg=ctx.createRadialGradient(tx,ty,0,tx,ty,90);
            const flicker=0.12+Math.sin(t*7+tx)*.04;
            tg.addColorStop(0,`rgba(255,140,20,${flicker})`);tg.addColorStop(1,'rgba(0,0,0,0)');
            ctx.fillStyle=tg;ctx.fillRect(BORDER,BORDER,W,H);
          });
          break;
        case 'blitz':
          // Warm orange pulse
          {const bp=0.5+Math.sin(t*3)*.5;
           ctx.fillStyle=`rgba(220,100,0,${bp*.055})`;ctx.fillRect(BORDER,BORDER,W,H);}
          break;
        case 'zen':
          // Soft cyan breathing glow from centre
          {const zp=0.5+Math.sin(t*1.2)*.5;
           const zg=ctx.createRadialGradient(BORDER+W/2,BORDER+H/2,30,BORDER+W/2,BORDER+H/2,W*.6);
           zg.addColorStop(0,`rgba(20,200,180,${zp*.05})`);zg.addColorStop(1,'rgba(0,0,0,0)');
           ctx.fillStyle=zg;ctx.fillRect(BORDER,BORDER,W,H);}
          break;
        // classic: no extra tint — clean
      }
      // Mode name watermark corner label
      const modeLabel={classic:'CLASSIC',endless:'ENDLESS',timed:'TIMED',maze:'MAZE',blitz:'BLITZ',zen:'ZEN'};
      const modeColor={classic:'rgba(58,255,80,.07)',endless:'rgba(80,130,255,.08)',timed:'rgba(255,60,60,.08)',maze:'rgba(160,60,255,.08)',blitz:'rgba(255,140,30,.08)',zen:'rgba(40,220,200,.07)'};
      ctx.font=`bold 64px 'Orbitron',monospace`;
      ctx.textAlign='right';ctx.textBaseline='bottom';
      ctx.fillStyle=modeColor[S.mode]||'rgba(255,255,255,.04)';
      ctx.fillText(modeLabel[S.mode]||'',BORDER+W-12,BORDER+H-12);
      ctx.restore();
    }

    // Grid
    drawGridOverlay();

    // Grass
    drawGrass(t);

    // Walls
    drawWalls();

    // Watermark
    if(gameState!=='idle'){
      ctx.save();ctx.font=`bold 88px 'Orbitron',monospace`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='rgba(255,255,255,.028)';ctx.fillText(score,BORDER+W/2,BORDER+H/2);ctx.restore();
    }

    // Fruits
    if(S.mode==='blitz') drawBlitzFruits(t);
    else drawFood(t);

    // Snake
    if(gameState!=='idle') drawSnake(t);

    // FX
    drawParticles();drawFloats();drawLvAnim();

    // Timed bar
    if(S.mode==='timed'&&gameState==='playing'){
      const pct=timeLeft/90000,bX=BORDER+10,bY=BORDER+H-13,bW=W-20,bH=5;
      ctx.fillStyle='rgba(0,0,0,.38)';ctx.fillRect(bX,bY,bW,bH);
      const tc=pct>.5?`hsl(120,70%,44%)`:`hsl(${Math.round(pct*240)},80%,44%)`;
      const tg=ctx.createLinearGradient(bX,0,bX+bW*pct,0);tg.addColorStop(0,tc);tg.addColorStop(1,'rgba(255,255,255,.25)');
      ctx.fillStyle=tg;ctx.fillRect(bX,bY,bW*pct,bH);
      ctx.strokeStyle='rgba(255,255,255,.1)';ctx.lineWidth=1;ctx.strokeRect(bX,bY,bW,bH);
    }

    // Blitz: timer bars per fruit (already drawn inside drawBlitzFruits)

    ctx.restore();
    animFrame=requestAnimationFrame(loop);
  }
  animFrame=requestAnimationFrame(loop);
}

// ============================================================
//  RESPONSIVE CANVAS FIT
// ============================================================
function fitCanvas(){
  const area=document.getElementById('game-area');
  if(!area||!canvas)return;
  const aw=area.clientWidth,ah=area.clientHeight;
  const scale=Math.min(aw/CW,ah/CH,1);
  canvas.style.width =Math.floor(CW*scale)+'px';
  canvas.style.height=Math.floor(CH*scale)+'px';
}

// ============================================================
//  EXPOSE GLOBALS
// ============================================================
window.startGame  = startGame;
window.pauseGame  = pauseGame;
window.resumeGame = resumeGame;
window.goBack     = ()=>{clearTimeout(tickTimer);cancelAnimationFrame(animFrame);window.location.href='index.html';};

window.addEventListener('DOMContentLoaded',()=>{
  init();
  fitCanvas();
  window.addEventListener('resize',fitCanvas);
});
