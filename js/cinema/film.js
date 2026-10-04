// 膠卷畫面的共用畫筆：顆粒、刮痕、閃爍、暗角、片門晃動、裝飾藝術風邊框、文字排版。
// 所有效果都只依賴「時間 t」與以影格編號為種子的亂數，所以同一個 t 永遠畫出同一張圖——
// 這讓前導片可以即時播放，也可以逐格錄成影片（見 tools/record-prelude.html）。

export const FPS = 24;                 // 老膠卷的節奏：顆粒與刮痕以 24 格／秒跳動

export const PAL = {
  black: '#0b0806',
  ink: '#140f0a',
  sepia: '#d9c49a',
  sepiaDim: '#a8946c',
  paper: '#e6d6ae',
  paperDark: '#b8a47a',
  brass: '#d6b25e',
  brassLit: '#f3d993',
  velvet: '#7a2430',
  redInk: '#8e1f24'
};

export const FONT = {
  display: '"Songti TC", "Noto Serif TC", "Source Han Serif TC", "PMingLiU", "MingLiU", serif',
  hand: '"Kaiti TC", "BiauKai", "DFKai-SB", "KaiTi", "STKaiti", "Noto Serif TC", serif',
  ui: '"PingFang TC", "Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif'
};

// ── 亂數：mulberry32，以影格編號為種子 ──────────────────────────
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const ease = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
export const easeOut = (t) => { t = clamp01(t); return 1 - Math.pow(1 - t, 3); };

/** 在 [a, b] 區間內淡入淡出的透明度 */
export function fade(t, a, b, fin = 0.6, fout = 0.6) {
  if (t < a || t > b) return 0;
  return Math.min(ease((t - a) / fin), ease((b - t) / fout));
}

/** 版面單位：寬螢幕以高度為準、直立手機以寬度為準，讓字在兩種方向都讀得到 */
export function unit(W, H) {
  return Math.min(W, H * 1.6) / 100;
}

// ── 顆粒貼圖（預先產生三張，輪流使用）────────────────────────────
let grainTiles = null;
function grain() {
  if (grainTiles) return grainTiles;
  grainTiles = [0, 1, 2].map((k) => {
    const c = document.createElement('canvas');
    c.width = c.height = 192;
    const g = c.getContext('2d');
    const img = g.createImageData(192, 192);
    const r = rng(9001 + k * 77);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = r() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = r() < 0.5 ? 26 : 0;
    }
    g.putImageData(img, 0, 0);
    return c;
  });
  return grainTiles;
}

/** 片門晃動：在畫場景前呼叫，讓整格畫面輕微抖動 */
export function weave(g, t, W, H, { reduced = false } = {}) {
  if (reduced) return;
  const f = Math.floor(t * FPS);
  const r = rng(f * 13 + 5);
  const u = unit(W, H);
  g.translate((r() - 0.5) * u * 0.18, (r() - 0.5) * u * 0.28);
}

/** 疊在最上層的膠卷質感 */
export function filmFX(g, t, W, H, { grainAmt = 1, scratches = 1, flicker = 1, vignette = 1, reduced = false } = {}) {
  const f = Math.floor(t * FPS);
  const r = rng(f * 7919 + 17);
  const u = unit(W, H);

  // 閃爍：每格亮度微幅跳動
  if (flicker > 0) {
    const a = (reduced ? 0.02 : 0.05) * flicker * (0.4 + r());
    g.fillStyle = `rgba(0,0,0,${a})`;
    g.fillRect(0, 0, W, H);
  }

  // 顆粒
  if (grainAmt > 0) {
    const tiles = grain();
    const tile = tiles[((f % tiles.length) + tiles.length) % tiles.length];
    const pat = g.createPattern(tile, 'repeat');
    g.save();
    g.globalAlpha = 0.55 * grainAmt;
    g.globalCompositeOperation = 'overlay';
    g.translate(-r() * 192, -r() * 192);
    g.fillStyle = pat;
    g.fillRect(0, 0, W + 192, H + 192);
    g.restore();
  }

  // 刮痕與灰塵
  if (scratches > 0 && !reduced) {
    g.save();
    const n = r() < 0.55 ? 1 : r() < 0.6 ? 2 : 0;
    for (let i = 0; i < n; i++) {
      const x = r() * W;
      g.strokeStyle = `rgba(235,220,190,${0.08 + r() * 0.16 * scratches})`;
      g.lineWidth = Math.max(1, u * 0.06);
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x + (r() - 0.5) * u * 1.5, H);
      g.stroke();
    }
    const dust = Math.floor(r() * 4);
    for (let i = 0; i < dust; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(10,8,6,.55)' : 'rgba(240,228,200,.35)';
      g.beginPath();
      g.ellipse(r() * W, r() * H, u * (0.08 + r() * 0.3), u * (0.05 + r() * 0.2), r() * 3, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  // 暗角
  if (vignette > 0) {
    const grad = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.62);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(0,0,0,${0.75 * vignette})`);
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
  }
}

// ── 文字 ─────────────────────────────────────────────────────
export function text(g, str, x, y, size, {
  color = PAL.sepia, align = 'center', font = FONT.display, weight = 500,
  alpha = 1, spacing = 0, glow = 0, baseline = 'middle'
} = {}) {
  if (alpha <= 0) return;
  g.save();
  g.globalAlpha *= alpha;
  g.font = `${weight} ${size}px ${font}`;
  g.textAlign = align;
  g.textBaseline = baseline;
  if ('letterSpacing' in g) g.letterSpacing = `${spacing * size}px`;
  if (glow) {
    g.shadowColor = color;
    g.shadowBlur = glow;
  }
  g.fillStyle = color;
  // letterSpacing 會在字尾多留一格，置中時往右補半格
  const shift = align === 'center' && spacing ? spacing * size * 0.5 : 0;
  g.fillText(str, x + shift, y);
  g.restore();
}

/** 中文逐字換行，回傳行陣列 */
export function wrap(g, str, maxWidth, size, font = FONT.display) {
  g.save();
  g.font = `500 ${size}px ${font}`;
  const lines = [];
  for (const para of String(str).split('\n')) {
    let line = '';
    for (const ch of para) {
      const test = line + ch;
      if (g.measureText(test).width > maxWidth && line) {
        // 標點不放行首
        if (/[，。、；：！？」』）]/.test(ch)) { line += ch; continue; }
        lines.push(line);
        line = ch;
      } else {
        line = test;
      }
    }
    lines.push(line);
  }
  g.restore();
  return lines;
}

/** 字幕：畫面下方、帶陰影的白字 */
export function subtitle(g, str, W, H, alpha = 1) {
  if (alpha <= 0 || !str) return;
  const u = unit(W, H);
  const size = Math.max(15, u * 2.9);
  const lines = wrap(g, str, W * 0.86, size);
  const lh = size * 1.55;
  const baseY = H - Math.max(u * 6, 34) - (lines.length - 1) * lh;
  g.save();
  g.globalAlpha = alpha;
  const grad = g.createLinearGradient(0, baseY - lh, 0, H);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.5, 'rgba(0,0,0,.55)');
  grad.addColorStop(1, 'rgba(0,0,0,.7)');
  g.fillStyle = grad;
  g.fillRect(0, baseY - lh * 1.2, W, H - baseY + lh * 1.2);
  g.shadowColor = 'rgba(0,0,0,.9)';
  g.shadowBlur = size * 0.6;
  lines.forEach((l, i) => text(g, l, W / 2, baseY + i * lh, size, { color: '#f1e6cc', spacing: 0.04 }));
  g.restore();
}

// ── 裝飾藝術風邊框（默片字卡）────────────────────────────────────
export function decoFrame(g, cx, cy, w, h, { color = PAL.brass, alpha = 1, u = 8 } = {}) {
  g.save();
  g.globalAlpha *= alpha;
  g.strokeStyle = color;
  const x = cx - w / 2;
  const y = cy - h / 2;
  g.lineWidth = Math.max(1.2, u * 0.12);
  g.strokeRect(x, y, w, h);
  g.lineWidth = Math.max(1, u * 0.05);
  const m = u * 0.9;
  g.strokeRect(x + m, y + m, w - m * 2, h - m * 2);
  // 四角的扇形與菱形
  const corners = [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]];
  for (const [px, py, sx, sy] of corners) {
    // 以內框角為圓心、朝框內畫三道同心四分之一圓
    const ox = px + sx * m;
    const oy = py + sy * m;
    const a0 = sx > 0 ? 0 : Math.PI;
    const a1 = sy > 0 ? Math.PI / 2 : (sx > 0 ? -Math.PI / 2 : Math.PI * 1.5);
    g.beginPath();
    for (let k = 1; k <= 3; k++) {
      const R = m * (0.35 + k * 0.45);
      g.moveTo(ox + sx * R, oy);
      g.arc(ox, oy, R, a0, a1, sx * sy < 0);
    }
    g.stroke();
    g.beginPath();
    const dx = px + sx * m * 2.9;
    const dy = py + sy * m * 2.9;
    g.moveTo(dx, dy - u * 0.35);
    g.lineTo(dx + u * 0.35, dy);
    g.lineTo(dx, dy + u * 0.35);
    g.lineTo(dx - u * 0.35, dy);
    g.closePath();
    g.fillStyle = color;
    g.fill();
  }
  // 上下中央的放射線裝飾
  for (const sy of [-1, 1]) {
    const yy = cy + sy * (h / 2 - m);
    g.beginPath();
    for (let k = -3; k <= 3; k++) {
      g.moveTo(cx + k * u * 0.7, yy);
      g.lineTo(cx + k * u * 0.25, yy - sy * u * 0.9);
    }
    g.stroke();
  }
  g.restore();
}

/** 細分隔線＋中央菱形 */
export function rule(g, cx, cy, w, { color = PAL.brass, alpha = 1, u = 8 } = {}) {
  g.save();
  g.globalAlpha *= alpha;
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = Math.max(1, u * 0.06);
  g.beginPath();
  g.moveTo(cx - w / 2, cy);
  g.lineTo(cx - u * 0.6, cy);
  g.moveTo(cx + u * 0.6, cy);
  g.lineTo(cx + w / 2, cy);
  g.stroke();
  g.beginPath();
  g.moveTo(cx, cy - u * 0.3);
  g.lineTo(cx + u * 0.3, cy);
  g.lineTo(cx, cy + u * 0.3);
  g.lineTo(cx - u * 0.3, cy);
  g.closePath();
  g.fill();
  g.restore();
}

/** 齒輪（以 even-odd 路徑挖洞，不會把整張畫布打穿） */
export function gear(g, cx, cy, r, teeth, angle, { color = PAL.brass, alpha = 1 } = {}) {
  g.save();
  g.globalAlpha *= alpha;
  g.translate(cx, cy);
  g.rotate(angle);
  g.fillStyle = color;
  g.beginPath();
  const tw = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * tw;
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    g.lineTo(Math.cos(a + tw * 0.15) * r * 1.16, Math.sin(a + tw * 0.15) * r * 1.16);
    g.lineTo(Math.cos(a + tw * 0.45) * r * 1.16, Math.sin(a + tw * 0.45) * r * 1.16);
    g.lineTo(Math.cos(a + tw * 0.6) * r, Math.sin(a + tw * 0.6) * r);
  }
  g.closePath();
  g.moveTo(r * 0.32, 0);
  g.arc(0, 0, r * 0.32, 0, Math.PI * 2);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const hx = Math.cos(a) * r * 0.64;
    const hy = Math.sin(a) * r * 0.64;
    g.moveTo(hx + r * 0.15, hy);
    g.arc(hx, hy, r * 0.15, 0, Math.PI * 2);
  }
  g.fill('evenodd');
  g.restore();
}

/** 紙張：帶邊緣焦黃與纖維 */
export function paper(g, cx, cy, w, h, { color = PAL.paper, seed = 3, rot = 0 } = {}) {
  g.save();
  g.translate(cx, cy);
  g.rotate(rot);
  g.shadowColor = 'rgba(0,0,0,.6)';
  g.shadowBlur = Math.min(w, h) * 0.06;
  g.fillStyle = color;
  g.fillRect(-w / 2, -h / 2, w, h);
  g.shadowBlur = 0;
  const grad = g.createRadialGradient(0, 0, Math.min(w, h) * 0.3, 0, 0, Math.hypot(w, h) * 0.6);
  grad.addColorStop(0, 'rgba(120,90,40,0)');
  grad.addColorStop(1, 'rgba(110,72,28,.45)');
  g.fillStyle = grad;
  g.fillRect(-w / 2, -h / 2, w, h);
  const r = rng(seed);
  g.strokeStyle = 'rgba(90,64,30,.12)';
  g.lineWidth = 1;
  for (let i = 0; i < 26; i++) {
    const y = -h / 2 + r() * h;
    g.beginPath();
    g.moveTo(-w / 2, y);
    g.lineTo(w / 2, y + (r() - 0.5) * 6);
    g.stroke();
  }
  g.restore();
}
