const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const WIDTH = 900;
const HEIGHT = 340;

const FONT_DIR = path.join(__dirname, '../fonts');
const FONT_PATH = path.join(FONT_DIR, 'NotoSans-Bold.ttf');
const MONO_PATH = path.join(FONT_DIR, 'NotoSansMono-Regular.ttf');

let fontsLoaded = false;

async function loadFonts() {
  if (fontsLoaded) return;
  try {
    if (!fs.existsSync(FONT_DIR)) fs.mkdirSync(FONT_DIR, { recursive: true });
    if (!fs.existsSync(FONT_PATH)) {
      const res = await fetch(
        'https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSans/NotoSans-Bold.ttf'
      );
      fs.writeFileSync(FONT_PATH, Buffer.from(await res.arrayBuffer()));
    }
    if (!fs.existsSync(MONO_PATH)) {
      const res = await fetch(
        'https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansMono/NotoSansMono-Regular.ttf'
      );
      fs.writeFileSync(MONO_PATH, Buffer.from(await res.arrayBuffer()));
    }
    GlobalFonts.registerFromPath(FONT_PATH, 'NotoSans');
    GlobalFonts.registerFromPath(MONO_PATH, 'NotoMono');
    fontsLoaded = true;
  } catch {
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

function pad(n, len = 2) {
  return String(n).padStart(len, '0');
}

function formatTime(totalSeconds) {
  const sec = totalSeconds % 60;
  const min = Math.floor(totalSeconds / 60) % 60;
  const hr = Math.floor(totalSeconds / 3600) % 24;
  const day = Math.floor(totalSeconds / 86400);

  if (day > 0) {
    return {
      parts: [
        { value: String(day), label: '日' },
        { value: pad(hr), label: '時間' },
        { value: pad(min), label: '分' },
        { value: pad(sec), label: '秒' },
      ],
      colonStr: `${day}:${pad(hr)}:${pad(min)}:${pad(sec)}`,
    };
  }
  if (hr > 0) {
    return {
      parts: [
        { value: pad(hr), label: '時間' },
        { value: pad(min), label: '分' },
        { value: pad(sec), label: '秒' },
      ],
      colonStr: `${pad(hr)}:${pad(min)}:${pad(sec)}`,
    };
  }
  return {
    parts: [
      { value: pad(min), label: '分' },
      { value: pad(sec), label: '秒' },
    ],
    colonStr: `${pad(min)}:${pad(sec)}`,
  };
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
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  const remaining = Math.max(0, remainingSeconds);
  const finished = remaining === 0;
  const design = DESIGN_NAMES[designIndex % DESIGN_NAMES.length];

  drawBackground(ctx, design);
  drawContent(ctx, design, remaining, targetLabel, finished, designIndex);

  return canvas.toBuffer('image/png');
}

function drawBackground(ctx, design) {
  const W = WIDTH, H = HEIGHT;

  const fills = {
    minimal_dark: () => {
      ctx.fillStyle = '#0e0e0e';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
      for (let y = 0; y < H; y += 60) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
      const g = ctx.createLinearGradient(0,0,W,0);
      g.addColorStop(0,'rgba(255,255,255,0.15)'); g.addColorStop(1,'rgba(255,255,255,0.05)');
      ctx.strokeStyle = g; ctx.lineWidth = 2;
      ctx.strokeRect(10,10,W-20,H-20);
    },
    neon_cyber: () => {
      ctx.fillStyle = '#020610'; ctx.fillRect(0,0,W,H);
      ctx.strokeStyle = 'rgba(0,255,255,0.05)'; ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 45) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
      for (let y = 0; y < H; y += 45) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
      ['rgba(0,255,255,0.7)','rgba(255,0,200,0.7)'].forEach((c,i) => {
        ctx.shadowColor = c; ctx.shadowBlur = 20;
        ctx.strokeStyle = c; ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (i === 0) { ctx.moveTo(0,0); ctx.lineTo(W,0); ctx.moveTo(0,H); ctx.lineTo(W,H); }
        else { ctx.moveTo(0,0); ctx.lineTo(0,H); ctx.moveTo(W,0); ctx.lineTo(W,H); }
        ctx.stroke();
      });
      ctx.shadowBlur = 0;
      const corner = (x, y, dx, dy) => {
        ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x+dx*25,y); ctx.lineTo(x,y); ctx.lineTo(x,y+dy*25); ctx.stroke();
      };
      corner(8,8,1,1); corner(W-8,8,-1,1); corner(8,H-8,1,-1); corner(W-8,H-8,-1,-1);
    },
    sunset: () => {
      const g = ctx.createLinearGradient(0,0,0,H);
      g.addColorStop(0,'#1a0533'); g.addColorStop(0.4,'#8b1a4a'); g.addColorStop(0.75,'#e05c2a'); g.addColorStop(1,'#f5a623');
      ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
      const rand = mulberry32(7);
      for (let i = 0; i < 80; i++) {
        const sx = rand()*W, sy = rand()*H*0.6, sr = rand()*1.5;
        ctx.fillStyle = `rgba(255,255,255,${0.3+rand()*0.6})`;
        ctx.beginPath(); ctx.arc(sx,sy,sr,0,Math.PI*2); ctx.fill();
      }
      for (let w = 0; w < 3; w++) {
        const wg = ctx.createLinearGradient(0,H*0.7+w*20,0,H*0.9+w*20);
        wg.addColorStop(0,'rgba(255,100,50,0)'); wg.addColorStop(0.5,`rgba(255,120,60,0.12)`); wg.addColorStop(1,'rgba(255,100,50,0)');
        ctx.fillStyle = wg;
        ctx.beginPath(); ctx.moveTo(0,H*0.72+w*18);
        for (let x = 0; x <= W; x+=5) ctx.lineTo(x, H*0.72+w*18+Math.sin(x*0.02+w)*10);
        ctx.lineTo(W,H); ctx.lineTo(0,H); ctx.closePath(); ctx.fill();
      }
    },
    space: () => {
      const bg = ctx.createRadialGradient(W*0.3,H*0.4,0,W*0.5,H*0.5,W*0.8);
      bg.addColorStop(0,'#0f1e4a'); bg.addColorStop(0.5,'#070d2a'); bg.addColorStop(1,'#010208');
      ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);
      const rand = mulberry32(42);
      for (let i = 0; i < 250; i++) {
        const sx = rand()*W, sy = rand()*H, sr = rand()*2, a = 0.3+rand()*0.7;
        const hue = rand() > 0.85 ? [210+rand()*40, 0.8] : [0, 0];
        if (hue[1] > 0) ctx.fillStyle = `hsla(${hue[0]},80%,90%,${a})`;
        else ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.beginPath(); ctx.arc(sx,sy,sr,0,Math.PI*2); ctx.fill();
      }
      const nebula = ctx.createRadialGradient(W*0.7,H*0.3,0,W*0.7,H*0.3,200);
      nebula.addColorStop(0,'rgba(80,40,180,0.2)'); nebula.addColorStop(1,'transparent');
      ctx.fillStyle = nebula; ctx.fillRect(0,0,W,H);
    },
    matrix: () => {
      ctx.fillStyle = '#000'; ctx.fillRect(0,0,W,H);
      const rand = mulberry32(99);
      const chars = '01アイウエオカキクケコサシスセソタチツテト';
      ctx.fillStyle = 'rgba(0,255,0,0.07)'; ctx.font = '13px monospace';
      for (let i = 0; i < 120; i++) ctx.fillText(chars[Math.floor(rand()*chars.length)], rand()*W, rand()*H);
      ctx.fillStyle = 'rgba(0,255,0,0.04)'; ctx.font = '9px monospace';
      for (let i = 0; i < 200; i++) ctx.fillText(chars[Math.floor(rand()*chars.length)], rand()*W, rand()*H);
      ctx.strokeStyle = 'rgba(0,255,0,0.3)'; ctx.lineWidth = 1;
      ctx.strokeRect(8,8,W-16,H-16);
      ctx.strokeStyle = 'rgba(0,255,0,0.12)'; ctx.lineWidth = 1;
      ctx.strokeRect(14,14,W-28,H-28);
    },
    ocean: () => {
      const g = ctx.createLinearGradient(0,0,0,H);
      g.addColorStop(0,'#04111f'); g.addColorStop(0.6,'#0a3060'); g.addColorStop(1,'#0d5a9e');
      ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
      const rand = mulberry32(5);
      for (let i = 0; i < 60; i++) {
        const bx = rand()*W, by = rand()*H*0.7, br = rand()*1.2;
        ctx.fillStyle = `rgba(180,230,255,${0.15+rand()*0.3})`;
        ctx.beginPath(); ctx.arc(bx,by,br,0,Math.PI*2); ctx.fill();
      }
      for (let w = 0; w < 5; w++) {
        const alpha = 0.06+w*0.04;
        ctx.beginPath(); ctx.strokeStyle = `rgba(100,200,255,${alpha})`; ctx.lineWidth = 2;
        for (let x = 0; x <= W; x+=4) {
          const y = H*0.5+w*24+Math.sin(x*0.018+w*0.8)*18+Math.sin(x*0.008+w)*10;
          x===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
        }
        ctx.stroke();
      }
    },
    fire: () => {
      const g = ctx.createLinearGradient(0,H,0,0);
      g.addColorStop(0,'#0a0000'); g.addColorStop(0.2,'#5c0000'); g.addColorStop(0.5,'#c0392b');
      g.addColorStop(0.75,'#e67e22'); g.addColorStop(0.9,'#f1c40f'); g.addColorStop(1,'#fffde7');
      ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
      const rand = mulberry32(13);
      for (let i = 0; i < 30; i++) {
        const fx = rand()*W, fy = H*0.3+rand()*H*0.4;
        const fr = 3+rand()*8;
        const fg = ctx.createRadialGradient(fx,fy,0,fx,fy,fr);
        fg.addColorStop(0,'rgba(255,255,200,0.4)'); fg.addColorStop(1,'transparent');
        ctx.fillStyle = fg; ctx.fillRect(fx-fr,fy-fr,fr*2,fr*2);
      }
    },
    aurora: () => {
      ctx.fillStyle = '#030d18'; ctx.fillRect(0,0,W,H);
      const rand = mulberry32(22);
      for (let i = 0; i < 100; i++) {
        ctx.fillStyle = `rgba(255,255,255,${0.2+rand()*0.5})`;
        ctx.beginPath(); ctx.arc(rand()*W,rand()*H,rand(),0,Math.PI*2); ctx.fill();
      }
      const bands = [
        { color: '#00ff88', alpha: 55, oy: 60, amp: 40 },
        { color: '#00cfff', alpha: 45, oy: 100, amp: 50 },
        { color: '#9b59b6', alpha: 35, oy: 140, amp: 35 },
      ];
      bands.forEach(({ color, alpha, oy, amp }, i) => {
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
      ctx.strokeStyle = 'rgba(255,0,255,0.08)'; ctx.lineWidth = 1;
      for (let x = 0; x < W; x+=30) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
      for (let y = 0; y < H; y+=30) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
      for (let i = 0; i < 4; i++) {
        const c = i%2===0 ? '#ff00ff' : '#00ffff';
        ctx.shadowColor = c; ctx.shadowBlur = 15-i*3;
        ctx.strokeStyle = c; ctx.lineWidth = 2-i*0.3;
        ctx.strokeRect(8+i*4, 8+i*4, W-16-i*8, H-16-i*8);
      }
      ctx.shadowBlur = 0;
      for (let y = 0; y < H; y+=3) {
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(0,y,W,1.5);
      }
    },
    minimal_light: () => {
      ctx.fillStyle = '#f5f5f7'; ctx.fillRect(0,0,W,H);
      const accent = ctx.createLinearGradient(0,0,W,0);
      accent.addColorStop(0,'#5e5ce6'); accent.addColorStop(0.5,'#bf5af2'); accent.addColorStop(1,'#32d74b');
      ctx.fillStyle = accent; ctx.fillRect(0,0,W,5);
      ctx.fillStyle = 'rgba(0,0,0,0.04)'; ctx.fillRect(0,H-5,W,5);
      ctx.strokeStyle = '#e0e0e5'; ctx.lineWidth = 1;
      ctx.strokeRect(18,18,W-36,H-36);
      const rand = mulberry32(33);
      for (let i = 0; i < 5; i++) {
        const cx = rand()*W, cy = rand()*H, cr = 40+rand()*80;
        ctx.strokeStyle = `rgba(94,92,230,${0.03+rand()*0.04})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cx,cy,cr,0,Math.PI*2); ctx.stroke();
      }
    },
  };

  (fills[design] || fills.minimal_dark)();
}

function drawContent(ctx, design, remaining, targetLabel, finished, designIndex) {
  const colors = getDesignColors(design);
  const mono = fontsLoaded ? 'NotoMono' : 'monospace';
  const sans = fontsLoaded ? 'NotoSans' : 'sans-serif';

  ctx.textAlign = 'center';
  ctx.shadowBlur = 0;

  ctx.font = `bold 15px "${sans}"`;
  ctx.fillStyle = colors.secondary;
  ctx.fillText('⏰  COUNTDOWN TIMER', WIDTH / 2, 44);

  if (finished) {
    if (colors.glow) { ctx.shadowColor = colors.primary; ctx.shadowBlur = 30; }
    ctx.font = `bold 64px "${sans}"`;
    ctx.fillStyle = colors.primary;
    ctx.fillText('🎉  時間になりました！', WIDTH / 2, 195);
    ctx.shadowBlur = 0;
  } else {
    const { parts, colonStr } = formatTime(remaining);
    const segW = WIDTH / (parts.length + 0.5);
    const startX = WIDTH / 2 - segW * (parts.length - 1) / 2;

    const maxLen = Math.max(...parts.map(p => p.value.length));
    const fontSize = maxLen <= 2 ? 100 : maxLen <= 4 ? 80 : maxLen <= 6 ? 64 : 52;

    if (colors.glow) { ctx.shadowColor = colors.primary; ctx.shadowBlur = 28; }

    parts.forEach((p, i) => {
      const x = startX + i * segW;
      ctx.font = `bold ${fontSize}px "${mono}"`;
      ctx.fillStyle = colors.primary;
      ctx.fillText(p.value, x, 192);

      ctx.shadowBlur = 0;
      ctx.font = `13px "${sans}"`;
      ctx.fillStyle = colors.tertiary;
      ctx.fillText(p.label, x, 218);
      if (colors.glow) { ctx.shadowColor = colors.primary; ctx.shadowBlur = 28; }
    });

    if (parts.length > 1) {
      ctx.shadowBlur = 0;
      ctx.font = `bold ${fontSize}px "${mono}"`;
      ctx.fillStyle = colors.secondary;
      for (let i = 0; i < parts.length - 1; i++) {
        const x = startX + i * segW + segW * 0.5;
        ctx.fillText(':', x, 188);
      }
    }

    ctx.shadowBlur = 0;
  }

  ctx.font = `14px "${sans}"`;
  ctx.fillStyle = colors.tertiary;
  ctx.fillText(`目標  ${targetLabel}`, WIDTH / 2, 264);

  ctx.font = `12px "${sans}"`;
  ctx.fillStyle = colors.tertiary;
  ctx.textAlign = 'right';
  ctx.fillText(DESIGN_LABELS[designIndex] ?? design, WIDTH - 18, HEIGHT - 12);

  const now = new Date();
  const timeNow = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  ctx.textAlign = 'left';
  ctx.fillText(timeNow, 18, HEIGHT - 12);
}

function pad(n) { return String(n).padStart(2, '0'); }

function getDesignColors(design) {
  const m = {
    minimal_dark:  { primary: '#f0f0f0', secondary: '#888',     tertiary: '#555',     glow: false },
    neon_cyber:    { primary: '#00ffee', secondary: '#ff00cc',  tertiary: '#00ff88',  glow: true  },
    sunset:        { primary: '#fff',    secondary: 'rgba(255,255,255,0.8)', tertiary: 'rgba(255,220,180,0.7)', glow: false },
    space:         { primary: '#c8d8ff', secondary: '#7090cc',  tertiary: '#4a6090',  glow: true  },
    matrix:        { primary: '#00ff41', secondary: '#00cc33',  tertiary: '#008822',  glow: true  },
    ocean:         { primary: '#e8f8ff', secondary: '#80d0f0',  tertiary: '#4aa8cc',  glow: false },
    fire:          { primary: '#fff8e1', secondary: '#ffcc44',  tertiary: '#ff9933',  glow: true  },
    aurora:        { primary: '#ffffff', secondary: '#00ff88',  tertiary: '#00cfff',  glow: true  },
    retro:         { primary: '#ffff00', secondary: '#ff88ff',  tertiary: '#00eeff',  glow: true  },
    minimal_light: { primary: '#1c1c1e', secondary: '#48484a',  tertiary: '#8e8e93',  glow: false },
  };
  return m[design] ?? m.minimal_dark;
}

module.exports = { generateCountdownImage, DESIGN_NAMES, DESIGN_LABELS };
