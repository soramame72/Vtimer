const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const W = 960;
const H = 400;

const FONT_DIR = path.join(__dirname, '../fonts');
const MONO_PATH = path.join(FONT_DIR, 'mono.ttf');
const SANS_PATH = path.join(FONT_DIR, 'sans.ttf');

let fontsLoaded = false;

async function preloadFonts() {
  if (fontsLoaded) return;
  try {
    if (!fs.existsSync(FONT_DIR)) fs.mkdirSync(FONT_DIR, { recursive: true });
    const downloads = [
      {
        p: MONO_PATH,
        url: 'https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansMono/NotoSansMono-Bold.ttf',
        name: 'BotMono',
      },
      {
        p: SANS_PATH,
        url: 'https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf',
        name: 'BotSans',
      },
    ];
    for (const d of downloads) {
      if (!fs.existsSync(d.p)) {
        console.log(`[font] downloading ${d.name}...`);
        const res = await fetch(d.url);
        fs.writeFileSync(d.p, Buffer.from(await res.arrayBuffer()));
      }
      GlobalFonts.registerFromPath(d.p, d.name);
    }
    fontsLoaded = true;
  } catch (e) {
    console.error('[font] load failed:', e.message);
    fontsLoaded = true;
  }
}

const DESIGN_NAMES = [
  'minimal_dark', 'neon_cyber', 'sunset', 'space', 'matrix',
  'ocean', 'fire', 'aurora', 'retro', 'minimal_light',
];

const DESIGN_LABELS = [
  'Minimal Dark', 'Neon Cyber', 'Sunset', 'Space', 'Matrix',
  'Ocean', 'Fire', 'Aurora', 'Retro', 'Minimal Light',
];

function pad(n) { return String(n).padStart(2, '0'); }

function secsToHMS(t) {
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return `${h}:${pad(m)}:${pad(s)}`;
}

function fmtParts(totalSec) {
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60) % 60;
  const h = Math.floor(totalSec / 3600);
  if (h > 0) return [{ v: String(h), l: 'HRS' }, { v: pad(m), l: 'MIN' }, { v: pad(s), l: 'SEC' }];
  return [{ v: pad(m), l: 'MIN' }, { v: pad(s), l: 'SEC' }];
}

function rand32(seed) {
  let s = seed;
  return () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function generateCountdownImage({ remaining, elapsed, target, vcName, designIndex = 0 }) {
  if (!fontsLoaded) await preloadFonts();
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const design = DESIGN_NAMES[designIndex % DESIGN_NAMES.length];

  drawBg(ctx, design);
  drawUi(ctx, design, designIndex, {
    remaining: Math.max(0, remaining),
    elapsed:   Math.max(0, elapsed),
    target,
    vcName,
    finished:  remaining <= 0,
  });

  return canvas.toBuffer('image/png');
}

function drawBg(ctx, design) {
  const r = rand32;
  ({
    minimal_dark: () => {
      ctx.fillStyle = '#0c0c0c'; ctx.fillRect(0,0,W,H);
      ctx.strokeStyle = 'rgba(255,255,255,0.035)'; ctx.lineWidth = 1;
      for (let x=0;x<W;x+=60){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
      for (let y=0;y<H;y+=60){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
      ctx.strokeStyle='rgba(255,255,255,0.12)';ctx.lineWidth=1.5;ctx.strokeRect(10,10,W-20,H-20);
    },
    neon_cyber: () => {
      ctx.fillStyle='#020610';ctx.fillRect(0,0,W,H);
      ctx.strokeStyle='rgba(0,255,255,0.035)';ctx.lineWidth=1;
      for(let x=0;x<W;x+=45){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
      for(let y=0;y<H;y+=45){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
      const co=(x,y,dx,dy)=>{
        ctx.shadowColor='#00ffff';ctx.shadowBlur=12;ctx.strokeStyle='#00ffff';ctx.lineWidth=2;
        ctx.beginPath();ctx.moveTo(x+dx*30,y);ctx.lineTo(x,y);ctx.lineTo(x,y+dy*30);ctx.stroke();ctx.shadowBlur=0;
      };
      co(8,8,1,1);co(W-8,8,-1,1);co(8,H-8,1,-1);co(W-8,H-8,-1,-1);
      ctx.strokeStyle='rgba(255,0,200,0.2)';ctx.lineWidth=1;ctx.strokeRect(8,8,W-16,H-16);
    },
    sunset: () => {
      const g=ctx.createLinearGradient(0,0,0,H);
      g.addColorStop(0,'#1a0533');g.addColorStop(0.4,'#8b1a4a');g.addColorStop(0.75,'#e05c2a');g.addColorStop(1,'#f5a623');
      ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
      const rnd=r(7);
      for(let i=0;i<90;i++){
        ctx.fillStyle=`rgba(255,255,255,${0.25+rnd()*0.65})`;
        ctx.beginPath();ctx.arc(rnd()*W,rnd()*H*0.5,rnd()*1.6,0,Math.PI*2);ctx.fill();
      }
    },
    space: () => {
      const bg=ctx.createRadialGradient(W*.35,H*.4,0,W*.5,H*.5,W*.8);
      bg.addColorStop(0,'#0f1e4a');bg.addColorStop(0.6,'#060d25');bg.addColorStop(1,'#010208');
      ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
      const rnd=r(42);
      for(let i=0;i<280;i++){
        const a=0.3+rnd()*0.7;
        ctx.fillStyle=rnd()>.9?`rgba(180,200,255,${a})`:`rgba(255,255,255,${a})`;
        ctx.beginPath();ctx.arc(rnd()*W,rnd()*H,rnd()*2,0,Math.PI*2);ctx.fill();
      }
      const neb=ctx.createRadialGradient(W*.7,H*.3,0,W*.7,H*.3,200);
      neb.addColorStop(0,'rgba(80,40,180,0.16)');neb.addColorStop(1,'transparent');
      ctx.fillStyle=neb;ctx.fillRect(0,0,W,H);
    },
    matrix: () => {
      ctx.fillStyle='#000';ctx.fillRect(0,0,W,H);
      const rnd=r(99);const chars='01ABCDEF0110';ctx.font='13px monospace';
      for(let i=0;i<200;i++){
        ctx.fillStyle=`rgba(0,255,0,${0.03+rnd()*0.09})`;
        ctx.fillText(chars[Math.floor(rnd()*chars.length)],rnd()*W,rnd()*H);
      }
      ctx.shadowColor='#00ff00';ctx.shadowBlur=8;
      ctx.strokeStyle='rgba(0,255,0,0.45)';ctx.lineWidth=1.5;ctx.strokeRect(8,8,W-16,H-16);ctx.shadowBlur=0;
    },
    ocean: () => {
      const g=ctx.createLinearGradient(0,0,0,H);
      g.addColorStop(0,'#04111f');g.addColorStop(0.6,'#0a3060');g.addColorStop(1,'#0d5a9e');
      ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
      for(let w=0;w<6;w++){
        ctx.beginPath();ctx.strokeStyle=`rgba(100,200,255,${0.05+w*0.04})`;ctx.lineWidth=2;
        for(let x=0;x<=W;x+=4){const y=H*.5+w*24+Math.sin(x*.018+w*.8)*18;x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);}
        ctx.stroke();
      }
    },
    fire: () => {
      const g=ctx.createLinearGradient(0,H,0,0);
      g.addColorStop(0,'#0a0000');g.addColorStop(0.2,'#5c0000');g.addColorStop(0.5,'#c0392b');
      g.addColorStop(0.75,'#e67e22');g.addColorStop(0.92,'#f1c40f');g.addColorStop(1,'#fffde7');
      ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    },
    aurora: () => {
      ctx.fillStyle='#030d18';ctx.fillRect(0,0,W,H);
      const rnd=r(22);
      for(let i=0;i<90;i++){ctx.fillStyle=`rgba(255,255,255,${0.15+rnd()*.5})`;ctx.beginPath();ctx.arc(rnd()*W,rnd()*H,rnd(),0,Math.PI*2);ctx.fill();}
      [['#00ff88',55,70,45],['#00cfff',45,115,55],['#9b59b6',38,155,38]].forEach(([c,a,oy,amp],i)=>{
        const bg=ctx.createLinearGradient(0,oy-amp,0,oy+amp+70);
        bg.addColorStop(0,`${c}00`);bg.addColorStop(0.4,`${c}${a.toString(16).padStart(2,'0')}`);bg.addColorStop(1,`${c}00`);
        ctx.fillStyle=bg;ctx.beginPath();ctx.moveTo(0,oy);
        for(let x=0;x<=W;x+=4)ctx.lineTo(x,oy+Math.sin(x*.01+i*1.5)*amp);
        ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.closePath();ctx.fill();
      });
    },
    retro: () => {
      const g=ctx.createLinearGradient(0,0,W,H);
      g.addColorStop(0,'#12002a');g.addColorStop(1,'#000820');
      ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
      ctx.strokeStyle='rgba(255,0,255,0.06)';ctx.lineWidth=1;
      for(let x=0;x<W;x+=30){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
      for(let y=0;y<H;y+=30){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
      for(let i=0;i<3;i++){
        const c=i%2===0?'#ff00ff':'#00ffff';
        ctx.shadowColor=c;ctx.shadowBlur=12-i*3;ctx.strokeStyle=c;ctx.lineWidth=2;
        ctx.strokeRect(8+i*5,8+i*5,W-16-i*10,H-16-i*10);
      }
      ctx.shadowBlur=0;
      for(let y=0;y<H;y+=3){ctx.fillStyle='rgba(0,0,0,0.13)';ctx.fillRect(0,y,W,1.5);}
    },
    minimal_light: () => {
      ctx.fillStyle='#f5f5f7';ctx.fillRect(0,0,W,H);
      const acc=ctx.createLinearGradient(0,0,W,0);
      acc.addColorStop(0,'#5e5ce6');acc.addColorStop(0.5,'#bf5af2');acc.addColorStop(1,'#32d74b');
      ctx.fillStyle=acc;ctx.fillRect(0,0,W,6);
      ctx.strokeStyle='#dcdce0';ctx.lineWidth=1;ctx.strokeRect(18,18,W-36,H-36);
      const rnd=r(33);
      for(let i=0;i<4;i++){ctx.strokeStyle=`rgba(94,92,230,${0.03+rnd()*.04})`;ctx.lineWidth=1;ctx.beginPath();ctx.arc(rnd()*W,rnd()*H,50+rnd()*90,0,Math.PI*2);ctx.stroke();}
    },
  }[design] ?? (() => {ctx.fillStyle='#111';ctx.fillRect(0,0,W,H);}))();
}

function drawUi(ctx, design, designIndex, { remaining, elapsed, target, vcName, finished }) {
  const c = COLORS[design] ?? COLORS.minimal_dark;
  const mono = fontsLoaded ? 'BotMono' : 'monospace';
  const sans = fontsLoaded ? 'BotSans' : 'sans-serif';

  ctx.shadowBlur = 0;
  ctx.textAlign = 'center';

  const vcLabel = vcName ? (vcName.length > 28 ? vcName.slice(0,28)+'...' : vcName) : 'Voice Channel';
  ctx.font = `bold 13px "${sans}"`;
  ctx.fillStyle = c.secondary;
  ctx.fillText(`VC : ${vcLabel}`, W/2, 36);

  ctx.font = `12px "${sans}"`;
  ctx.fillStyle = c.tertiary;
  ctx.fillText(`TARGET ${target}`, W/2, 56);

  if (finished) {
    if (c.glow) { ctx.shadowColor = c.primary; ctx.shadowBlur = 32; }
    ctx.font = `bold 72px "${sans}"`;
    ctx.fillStyle = c.primary;
    ctx.fillText("TIME'S UP!", W/2, 220);
    ctx.shadowBlur = 0;
  } else {
    const parts = fmtParts(remaining);
    const segW = W / parts.length;
    const maxLen = Math.max(...parts.map(p => p.v.length));
    const fs = maxLen <= 2 ? 120 : maxLen <= 4 ? 94 : maxLen <= 6 ? 76 : maxLen <= 8 ? 62 : 50;

    parts.forEach((p, i) => {
      const x = segW * i + segW / 2;
      if (i > 0) {
        if (c.glow) { ctx.shadowColor = c.secondary; ctx.shadowBlur = 10; }
        ctx.font = `bold ${fs}px "${mono}"`;
        ctx.fillStyle = c.secondary;
        ctx.fillText(':', x - segW / 2, 226);
        ctx.shadowBlur = 0;
      }
      if (c.glow) { ctx.shadowColor = c.primary; ctx.shadowBlur = 28; }
      ctx.font = `bold ${fs}px "${mono}"`;
      ctx.fillStyle = c.primary;
      ctx.fillText(p.v, x, 226);
      ctx.shadowBlur = 0;
      ctx.font = `12px "${sans}"`;
      ctx.fillStyle = c.tertiary;
      ctx.fillText(p.l, x, 252);
    });
  }

  const barY = 290;
  const barW = W - 80;
  const barH = 6;
  const barX = 40;
  const progress = Math.min(1, elapsed / (elapsed + Math.max(remaining, 1)));

  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 3); ctx.fill();

  if (progress > 0) {
    const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    grad.addColorStop(0, c.primary);
    grad.addColorStop(1, c.secondary);
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.roundRect(barX, barY, barW * progress, barH, 3); ctx.fill();
  }

  ctx.font = `12px "${sans}"`;
  ctx.fillStyle = c.tertiary;
  ctx.textAlign = 'left';
  ctx.fillText(`ELAPSED  ${secsToHMS(elapsed)}`, barX, barY + 22);
  ctx.textAlign = 'right';
  ctx.fillText(`REMAINING  ${secsToHMS(remaining)}`, barX + barW, barY + 22);

  const now = new Date();
  const nowStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  ctx.font = `11px "${sans}"`;
  ctx.fillStyle = c.tertiary;
  ctx.textAlign = 'left';
  ctx.fillText(nowStr, 18, H - 14);
  ctx.textAlign = 'right';
  ctx.fillText(DESIGN_LABELS[designIndex] ?? design, W - 18, H - 14);
}

const COLORS = {
  minimal_dark:  { primary: '#f0f0f0', secondary: '#666',    tertiary: '#444',    glow: false },
  neon_cyber:    { primary: '#00ffee', secondary: '#ff00cc', tertiary: '#00cc88', glow: true  },
  sunset:        { primary: '#ffffff', secondary: 'rgba(255,255,255,0.7)', tertiary: 'rgba(255,200,140,0.65)', glow: false },
  space:         { primary: '#c8d8ff', secondary: '#5878b0', tertiary: '#3a5080', glow: true  },
  matrix:        { primary: '#00ff41', secondary: '#00aa2e', tertiary: '#006618', glow: true  },
  ocean:         { primary: '#e8f8ff', secondary: '#60c0e8', tertiary: '#3088aa', glow: false },
  fire:          { primary: '#fff8e1', secondary: '#ffcc44', tertiary: '#ff9933', glow: true  },
  aurora:        { primary: '#ffffff', secondary: '#00ff88', tertiary: '#00a8e0', glow: true  },
  retro:         { primary: '#ffff00', secondary: '#ff88ff', tertiary: '#00ddff', glow: true  },
  minimal_light: { primary: '#1c1c1e', secondary: '#48484a', tertiary: '#8e8e93', glow: false },
};

module.exports = { generateCountdownImage, preloadFonts, DESIGN_NAMES, DESIGN_LABELS };
