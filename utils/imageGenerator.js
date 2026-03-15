const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const W = 900;
const H = 340;

const FONT_DIR = path.join(__dirname, '../fonts');
const MONO_PATH = path.join(FONT_DIR, 'mono.ttf');
const SANS_PATH = path.join(FONT_DIR, 'sans.ttf');

let fontsLoaded = false;

async function loadFonts() {
  if (fontsLoaded) return;
  try {
    if (!fs.existsSync(FONT_DIR)) fs.mkdirSync(FONT_DIR, { recursive: true });

    const downloads = [
      {
        path: MONO_PATH,
        url: 'https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansMono/NotoSansMono-Bold.ttf',
        name: 'BotMono',
      },
      {
        path: SANS_PATH,
        url: 'https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf',
        name: 'BotSans',
      },
    ];

    for (const d of downloads) {
      if (!fs.existsSync(d.path)) {
        console.log(`[font] Downloading ${d.name}...`);
        const res = await fetch(d.url);
        fs.writeFileSync(d.path, Buffer.from(await res.arrayBuffer()));
        console.log(`[font] ${d.name} done`);
      }
      GlobalFonts.registerFromPath(d.path, d.name);
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

function pad(n, len = 2) { return String(n).padStart(len, '0'); }

function formatTime(totalSec) {
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60) % 60;
  const h = Math.floor(totalSec / 3600);

  if (h > 0) {
    return [
      { value: String(h), label: 'HRS' },
      { value: pad(m), label: 'MIN' },
      { value: pad(s), label: 'SEC' },
    ];
  }
  return [
    { value: pad(m), label: 'MIN' },
    { value: pad(s), label: 'SEC' },
  ];
}

function mulberry32(seed) {
  let s = seed;
  return () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function generateCountdownImage(remainingSeconds, targetLabel, designIndex = 0) {
  await loadFonts();
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const remaining = Math.max(0, remainingSeconds);
  const finished = remaining === 0;
  const design = DESIGN_NAMES[designIndex % DESIGN_NAMES.length];

  drawBackground(ctx, design);
  drawContent(ctx, design, remaining, targetLabel, finished, designIndex);

  return canvas.toBuffer('image/png');
}

function drawBackground(ctx, design) {
  const fills = {
    minimal_dark: () => {
      ctx.fillStyle = '#0e0e0e'; ctx.fillRect(0,0,W,H);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
      for (let y = 0; y < H; y += 60) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1.5;
      ctx.strokeRect(10,10,W-20,H-20);
    },
    neon_cyber: () => {
      ctx.fillStyle = '#020610'; ctx.fillRect(0,0,W,H);
      ctx.strokeStyle = 'rgba(0,255,255,0.04)'; ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 45) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
      for (let y = 0; y < H; y += 45) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
      const corner = (x, y, dx, dy) => {
        ctx.shadowColor = '#00ffff'; ctx.shadowBlur = 10;
        ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x+dx*28,y); ctx.lineTo(x,y); ctx.lineTo(x,y+dy*28); ctx.stroke();
        ctx.shadowBlur = 0;
      };
      corner(8,8,1,1); corner(W-8,8,-1,1); corner(8,H-8,1,-1); corner(W-8,H-8,-1,-1);
      ctx.strokeStyle = 'rgba(255,0,200,0.3)'; ctx.lineWidth = 1;
      ctx.strokeRect(8,8,W-16,H-16);
    },
    sunset: () => {
      const g = ctx.createLinearGradient(0,0,0,H);
      g.addColorStop(0,'#1a0533'); g.addColorStop(0.4,'#8b1a4a');
      g.addColorStop(0.75,'#e05c2a'); g.addColorStop(1,'#f5a623');
      ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
      const rand = mulberry32(7);
      for (let i = 0; i < 80; i++) {
        ctx.fillStyle = `rgba(255,255,255,${0.3+rand()*0.6})`;
        ctx.beginPath(); ctx.arc(rand()*W, rand()*H*0.55, rand()*1.5, 0, Math.PI*2); ctx.fill();
      }
    },
    space: () => {
      const bg = ctx.createRadialGradient(W*0.35,H*0.4,0,W*0.5,H*0.5,W*0.8);
      bg.addColorStop(0,'#0f1e4a'); bg.addColorStop(0.6,'#060d25'); bg.addColorStop(1,'#010208');
      ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);
      const rand = mulberry32(42);
      for (let i = 0; i < 260; i++) {
        const a = 0.3+rand()*0.7;
        ctx.fillStyle = rand()>0.9 ? `rgba(180,200,255,${a})` : `rgba(255,255,255,${a})`;
        ctx.beginPath(); ctx.arc(rand()*W, rand()*H, rand()*2, 0, Math.PI*2); ctx.fill();
      }
      const neb = ctx.createRadialGradient(W*0.72,H*0.3,0,W*0.72,H*0.3,200);
      neb.addColorStop(0,'rgba(80,40,180,0.18)'); neb.addColorStop(1,'transparent');
      ctx.fillStyle = neb; ctx.fillRect(0,0,W,H);
    },
    matrix: () => {
      ctx.fillStyle = '#000'; ctx.fillRect(0,0,W,H);
      const rand = mulberry32(99);
      const chars = '01ABCDEF0110';
      ctx.font = '13px monospace';
      for (let i = 0; i < 180; i++) {
        const a = 0.04 + rand()*0.08;
        ctx.fillStyle = `rgba(0,255,0,${a})`;
        ctx.fillText(chars[Math.floor(rand()*chars.length)], rand()*W, rand()*H);
      }
      ctx.shadowColor = '#00ff00'; ctx.shadowBlur = 8;
      ctx.strokeStyle = 'rgba(0,255,0,0.5)'; ctx.lineWidth = 1.5;
      ctx.strokeRect(8,8,W-16,H-16);
      ctx.shadowBlur = 0;
    },
    ocean: () => {
      const g = ctx.createLinearGradient(0,0,0,H);
      g.addColorStop(0,'#04111f'); g.addColorStop(0.6,'#0a3060'); g.addColorStop(1,'#0d5a9e');
      ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
      for (let w = 0; w < 5; w++) {
        ctx.beginPath(); ctx.strokeStyle = `rgba(100,200,255,${0.06+w*0.04})`; ctx.lineWidth = 2;
        for (let x = 0; x <= W; x+=4) {
          const y = H*0.5+w*24+Math.sin(x*0.018+w*0.8)*18;
          x===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
        }
        ctx.stroke();
      }
    },
    fire: () => {
      const g = ctx.createLinearGradient(0,H,0,0);
      g.addColorStop(0,'#0a0000'); g.addColorStop(0.2,'#5c0000'); g.addColorStop(0.5,'#c0392b');
      g.addColorStop(0.75,'#e67e22'); g.addColorStop(0.92,'#f1c40f'); g.addColorStop(1,'#fffde7');
      ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
    },
    aurora: () => {
      ctx.fillStyle = '#030d18'; ctx.fillRect(0,0,W,H);
      const rand = mulberry32(22);
      for (let i = 0; i < 80; i++) {
        ctx.fillStyle = `rgba(255,255,255,${0.2+rand()*0.5})`;
        ctx.beginPath(); ctx.arc(rand()*W, rand()*H, rand(), 0, Math.PI*2); ctx.fill();
      }
      [
        ['#00ff88', 55, 65, 40],
        ['#00cfff', 45, 105, 50],
        ['#9b59b6', 38, 145, 35],
      ].forEach(([color, alpha, oy, amp], i) => {
        const bg = ctx.createLinearGradient(0, oy-amp, 0, oy+amp+60);
        bg.addColorStop(0, `${color}00`);
        bg.addColorStop(0.4, `${color}${alpha.toString(16).padStart(2,'0')}`);
        bg.addColorStop(1, `${color}00`);
        ctx.fillStyle = bg;
        ctx.beginPath(); ctx.moveTo(0, oy);
        for (let x = 0; x <= W; x+=4) ctx.lineTo(x, oy+Math.sin(x*0.01+i*1.5)*amp);
        ctx.lineTo(W,H); ctx.lineTo(0,H); ctx.closePath(); ctx.fill();
      });
    },
    retro: () => {
      const g = ctx.createLinearGradient(0,0,W,H);
      g.addColorStop(0,'#12002a'); g.addColorStop(1,'#000820');
      ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
      ctx.strokeStyle = 'rgba(255,0,255,0.07)'; ctx.lineWidth = 1;
      for (let x = 0; x < W; x+=30) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
      for (let y = 0; y < H; y+=30) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
      for (let i = 0; i < 3; i++) {
        const c = i%2===0 ? '#ff00ff' : '#00ffff';
        ctx.shadowColor = c; ctx.shadowBlur = 14-i*4;
        ctx.strokeStyle = c; ctx.lineWidth = 2;
        ctx.strokeRect(8+i*5, 8+i*5, W-16-i*10, H-16-i*10);
      }
      ctx.shadowBlur = 0;
      for (let y = 0; y < H; y+=3) { ctx.fillStyle='rgba(0,0,0,0.14)'; ctx.fillRect(0,y,W,1.5); }
    },
    minimal_light: () => {
      ctx.fillStyle = '#f5f5f7'; ctx.fillRect(0,0,W,H);
      const accent = ctx.createLinearGradient(0,0,W,0);
      accent.addColorStop(0,'#5e5ce6'); accent.addColorStop(0.5,'#bf5af2'); accent.addColorStop(1,'#32d74b');
      ctx.fillStyle = accent; ctx.fillRect(0,0,W,5);
      ctx.strokeStyle = '#e0e0e5'; ctx.lineWidth = 1; ctx.strokeRect(18,18,W-36,H-36);
      const rand = mulberry32(33);
      for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = `rgba(94,92,230,${0.03+rand()*0.04})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(rand()*W, rand()*H, 50+rand()*80, 0, Math.PI*2); ctx.stroke();
      }
    },
  };
  (fills[design] || fills.minimal_dark)();
}

function drawContent(ctx, design, remaining, targetLabel, finished, designIndex) {
  const c = getDesignColors(design);
  const mono = fontsLoaded ? 'BotMono' : 'monospace';
  const sans = fontsLoaded ? 'BotSans' : 'sans-serif';

  ctx.textAlign = 'center';
  ctx.shadowBlur = 0;

  ctx.font = `bold 14px "${sans}"`;
  ctx.fillStyle = c.secondary;
  ctx.fillText('COUNTDOWN TIMER', W/2, 42);

  if (finished) {
    if (c.glow) { ctx.shadowColor = c.primary; ctx.shadowBlur = 30; }
    ctx.font = `bold 68px "${sans}"`;
    ctx.fillStyle = c.primary;
    ctx.fillText("TIME'S UP!", W/2, 195);
    ctx.shadowBlur = 0;
  } else {
    const parts = formatTime(remaining);
    const segW = W / parts.length;

    const maxValLen = Math.max(...parts.map(p => p.value.length));
    const fontSize = maxValLen <= 2 ? 110 : maxValLen <= 4 ? 86 : maxValLen <= 6 ? 70 : maxValLen <= 8 ? 58 : 46;

    parts.forEach((p, i) => {
      const x = segW * i + segW / 2;

      if (i > 0) {
        if (c.glow) { ctx.shadowColor = c.secondary; ctx.shadowBlur = 12; }
        ctx.font = `bold ${fontSize}px "${mono}"`;
        ctx.fillStyle = c.secondary;
        ctx.fillText(':', x - segW / 2, 198);
      }

      if (c.glow) { ctx.shadowColor = c.primary; ctx.shadowBlur = 26; }
      ctx.font = `bold ${fontSize}px "${mono}"`;
      ctx.fillStyle = c.primary;
      ctx.fillText(p.value, x, 198);
      ctx.shadowBlur = 0;

      ctx.font = `12px "${sans}"`;
      ctx.fillStyle = c.tertiary;
      ctx.fillText(p.label, x, 224);
    });
  }

  const now = new Date();
  const nowStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  ctx.font = `13px "${sans}"`;
  ctx.fillStyle = c.tertiary;
  ctx.fillText(`TARGET  ${targetLabel}`, W/2, 265);

  ctx.font = `11px "${sans}"`;
  ctx.textAlign = 'right';
  ctx.fillStyle = c.tertiary;
  ctx.fillText(DESIGN_LABELS[designIndex] ?? design, W-16, H-12);

  ctx.textAlign = 'left';
  ctx.fillText(nowStr, 16, H-12);
}

function getDesignColors(design) {
  const m = {
    minimal_dark:  { primary: '#f0f0f0', secondary: '#777',     tertiary: '#444',     glow: false },
    neon_cyber:    { primary: '#00ffee', secondary: '#ff00cc',  tertiary: '#00cc88',  glow: true  },
    sunset:        { primary: '#ffffff', secondary: 'rgba(255,255,255,0.75)', tertiary: 'rgba(255,210,160,0.7)', glow: false },
    space:         { primary: '#c8d8ff', secondary: '#6080bb',  tertiary: '#405080',  glow: true  },
    matrix:        { primary: '#00ff41', secondary: '#00bb2f',  tertiary: '#007720',  glow: true  },
    ocean:         { primary: '#e8f8ff', secondary: '#70c8ee',  tertiary: '#3898bb',  glow: false },
    fire:          { primary: '#fff8e1', secondary: '#ffcc44',  tertiary: '#ff9933',  glow: true  },
    aurora:        { primary: '#ffffff', secondary: '#00ff88',  tertiary: '#00b8ee',  glow: true  },
    retro:         { primary: '#ffff00', secondary: '#ff88ff',  tertiary: '#00ddff',  glow: true  },
    minimal_light: { primary: '#1c1c1e', secondary: '#48484a',  tertiary: '#8e8e93',  glow: false },
  };
  return m[design] ?? m.minimal_dark;
}

module.exports = { generateCountdownImage, DESIGN_NAMES, DESIGN_LABELS };
