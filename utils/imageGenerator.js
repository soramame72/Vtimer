const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const WIDTH = 820;
const HEIGHT = 320;

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
  'minimal_dark',
  'neon_cyber',
  'sunset',
  'space',
  'matrix',
  'ocean',
  'fire',
  'aurora',
  'retro',
  'minimal_light',
];

const DESIGN_LABELS = [
  'Minimal Dark',
  'Neon Cyber',
  'Sunset',
  'Space',
  'Matrix',
  'Ocean',
  'Fire',
  'Aurora',
  'Retro',
  'Minimal Light',
];

function pad(n) {
  return String(n).padStart(2, '0');
}

function parseTime(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return { h, m, s, str: `${pad(h)}:${pad(m)}:${pad(s)}` };
}

function mulberry32(seed) {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function generateCountdownImage(remainingSeconds, targetTimeStr, designIndex = 0) {
  await loadFonts();
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  const time = parseTime(Math.max(0, remainingSeconds));
  const design = DESIGN_NAMES[designIndex % DESIGN_NAMES.length];
  const finished = remainingSeconds <= 0;

  drawBackground(ctx, design);
  drawContent(ctx, design, time, targetTimeStr, finished);

  return canvas.toBuffer('image/png');
}

function drawBackground(ctx, design) {
  switch (design) {
    case 'minimal_dark': {
      ctx.fillStyle = '#111111';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      const grad = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
      grad.addColorStop(0, 'rgba(255,255,255,0.08)');
      grad.addColorStop(1, 'rgba(255,255,255,0.02)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(12, 12, WIDTH - 24, HEIGHT - 24);
      break;
    }

    case 'neon_cyber': {
      ctx.fillStyle = '#03040e';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.strokeStyle = 'rgba(0,255,255,0.07)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= WIDTH; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, HEIGHT);
        ctx.stroke();
      }
      for (let y = 0; y <= HEIGHT; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(WIDTH, y);
        ctx.stroke();
      }
      const glow1 = ctx.createLinearGradient(0, 0, WIDTH, 0);
      glow1.addColorStop(0, 'rgba(0,255,255,0.4)');
      glow1.addColorStop(0.5, 'rgba(255,0,255,0.4)');
      glow1.addColorStop(1, 'rgba(0,255,255,0.4)');
      ctx.strokeStyle = glow1;
      ctx.lineWidth = 2;
      ctx.strokeRect(8, 8, WIDTH - 16, HEIGHT - 16);
      break;
    }

    case 'sunset': {
      const grad = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
      grad.addColorStop(0, '#c0392b');
      grad.addColorStop(0.4, '#e67e22');
      grad.addColorStop(0.8, '#f39c12');
      grad.addColorStop(1, '#f1c40f');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(0, HEIGHT * 0.65, WIDTH, HEIGHT * 0.35);
      break;
    }

    case 'space': {
      const bg = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 0, WIDTH / 2, HEIGHT / 2, WIDTH * 0.7);
      bg.addColorStop(0, '#0d1b3e');
      bg.addColorStop(1, '#020408');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      const rand = mulberry32(42);
      for (let i = 0; i < 200; i++) {
        const x = rand() * WIDTH;
        const y = rand() * HEIGHT;
        const r = rand() * 1.8;
        const a = 0.4 + rand() * 0.6;
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case 'matrix': {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      const rand = mulberry32(99);
      const chars = '01アイウエオカキクケコ';
      ctx.font = '12px monospace';
      ctx.fillStyle = 'rgba(0,255,0,0.12)';
      for (let i = 0; i < 60; i++) {
        const x = rand() * WIDTH;
        const y = rand() * HEIGHT;
        ctx.fillText(chars[Math.floor(rand() * chars.length)], x, y);
      }
      ctx.strokeStyle = 'rgba(0,255,0,0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(10, 10, WIDTH - 20, HEIGHT - 20);
      break;
    }

    case 'ocean': {
      const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      grad.addColorStop(0, '#0a1628');
      grad.addColorStop(0.5, '#0d3b6e');
      grad.addColorStop(1, '#1565c0');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      for (let w = 0; w < 4; w++) {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(255,255,255,${0.05 + w * 0.03})`;
        ctx.lineWidth = 1.5;
        for (let x = 0; x <= WIDTH; x += 4) {
          const y = HEIGHT * 0.55 + w * 22 + Math.sin(x * 0.025 + w * 1.2) * 14;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      break;
    }

    case 'fire': {
      const grad = ctx.createLinearGradient(0, HEIGHT, 0, 0);
      grad.addColorStop(0, '#1a0000');
      grad.addColorStop(0.25, '#7f0000');
      grad.addColorStop(0.55, '#e84118');
      grad.addColorStop(0.8, '#e1b12c');
      grad.addColorStop(1, '#ffeaa7');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      break;
    }

    case 'aurora': {
      const grad = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
      grad.addColorStop(0, '#050820');
      grad.addColorStop(0.5, '#0d1f3c');
      grad.addColorStop(1, '#061a0a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      [[0, '#00ffaa', 60], [1, '#7f00ff', 90], [2, '#00cfff', 40]].forEach(
        ([i, color, alpha]) => {
          const band = ctx.createLinearGradient(0, 80 + i * 30, 0, 200 + i * 30);
          band.addColorStop(0, `${color}00`);
          band.addColorStop(0.5, `${color}${alpha.toString(16).padStart(2, '0')}`);
          band.addColorStop(1, `${color}00`);
          ctx.fillStyle = band;
          ctx.beginPath();
          ctx.moveTo(0, 90 + i * 25);
          for (let x = 0; x <= WIDTH; x += 5) {
            ctx.lineTo(x, 90 + i * 25 + Math.sin(x * 0.012 + i * 2) * 35);
          }
          ctx.lineTo(WIDTH, 220);
          ctx.lineTo(0, 220);
          ctx.closePath();
          ctx.fill();
        }
      );
      break;
    }

    case 'retro': {
      ctx.fillStyle = '#1a0a2e';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      for (let y = 0; y < HEIGHT; y += 4) {
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(0, y, WIDTH, 2);
      }
      ctx.strokeStyle = '#ff00ff';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ff00ff';
      ctx.shadowBlur = 12;
      ctx.strokeRect(10, 10, WIDTH - 20, HEIGHT - 20);
      ctx.shadowBlur = 0;
      break;
    }

    case 'minimal_light': {
      ctx.fillStyle = '#f9f9fb';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      const accent = ctx.createLinearGradient(0, 0, WIDTH, 0);
      accent.addColorStop(0, '#6c63ff');
      accent.addColorStop(1, '#48cae4');
      ctx.fillStyle = accent;
      ctx.fillRect(0, 0, WIDTH, 6);
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 1;
      ctx.strokeRect(20, 20, WIDTH - 40, HEIGHT - 40);
      break;
    }

    default:
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }
}

function drawContent(ctx, design, time, targetTimeStr, finished) {
  const colors = getDesignColors(design);
  const fontFamily = fontsLoaded ? 'NotoSans' : 'sans-serif';
  const monoFamily = fontsLoaded ? 'NotoMono' : 'monospace';

  ctx.textAlign = 'center';
  ctx.shadowBlur = 0;

  ctx.font = `18px "${fontFamily}"`;
  ctx.fillStyle = colors.secondary;
  ctx.fillText('⏰  COUNTDOWN', WIDTH / 2, 52);

  if (colors.glow) {
    ctx.shadowColor = colors.primary;
    ctx.shadowBlur = 24;
  }

  if (finished) {
    ctx.font = `bold 72px "${fontFamily}"`;
    ctx.fillStyle = colors.primary;
    ctx.fillText('🎉  時間になりました！', WIDTH / 2, 185);
  } else {
    ctx.font = `bold 108px "${monoFamily}"`;
    ctx.fillStyle = colors.primary;
    ctx.fillText(time.str, WIDTH / 2, 196);
  }

  ctx.shadowBlur = 0;

  ctx.font = `16px "${fontFamily}"`;
  ctx.fillStyle = colors.tertiary;
  ctx.fillText(`目標時刻  ${targetTimeStr}`, WIDTH / 2, 242);

  if (!finished) {
    ctx.font = `13px "${fontFamily}"`;
    ctx.fillStyle = colors.tertiary;
    const cx = WIDTH / 2;
    ctx.fillText('時間', cx - 208, 216);
    ctx.fillText('分', cx, 216);
    ctx.fillText('秒', cx + 208, 216);
  }

  ctx.font = `12px "${fontFamily}"`;
  ctx.fillStyle = colors.tertiary;
  ctx.textAlign = 'right';
  ctx.fillText(DESIGN_LABELS[DESIGN_NAMES.indexOf(design)] ?? design, WIDTH - 20, HEIGHT - 14);
}

function getDesignColors(design) {
  const map = {
    minimal_dark: { primary: '#ffffff', secondary: '#aaaaaa', tertiary: '#666666', glow: false },
    neon_cyber: { primary: '#00ffff', secondary: '#ff00ff', tertiary: '#00ff88', glow: true },
    sunset: { primary: '#ffffff', secondary: 'rgba(255,255,255,0.85)', tertiary: 'rgba(255,255,255,0.6)', glow: false },
    space: { primary: '#d4d8ff', secondary: '#8899cc', tertiary: '#5566aa', glow: true },
    matrix: { primary: '#00ff41', secondary: '#00bb30', tertiary: '#007720', glow: true },
    ocean: { primary: '#ffffff', secondary: '#90d5f0', tertiary: '#5bb0d4', glow: false },
    fire: { primary: '#ffffff', secondary: '#ffd580', tertiary: '#ffaa44', glow: true },
    aurora: { primary: '#ffffff', secondary: '#00ff96', tertiary: '#00cfff', glow: true },
    retro: { primary: '#ffff00', secondary: '#ff88ff', tertiary: '#00eeff', glow: true },
    minimal_light: { primary: '#212121', secondary: '#555555', tertiary: '#9e9e9e', glow: false },
  };
  return map[design] ?? map.minimal_dark;
}

module.exports = { generateCountdownImage, DESIGN_NAMES, DESIGN_LABELS };
