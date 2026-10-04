// 前導片《消失的第十三幕》——約 50 秒的默片風格開場。
// 整部片是一個純函式 render(g, W, H, t)：同一個 t 永遠畫出同一格，
// 所以既能即時播放，也能逐格錄成影片。配樂在 js/core/score.js 的 preludeScore()，時間軸互相對齊。
//
//   0.0– 4.5  片頭倒數
//   4.5– 9.5  字卡：一九四七年 冬
//   9.5–15.5  節目單：只印了十二幕
//  15.5–26.5  舞台：林默舉手、燈滅、只剩一頂帽子
//  26.5–32.0  報紙頭版
//  32.0–40.0  工作室的門、齒輪
//  40.0–46.0  清場機關啟動
//  46.0–51.5  片名

import { PAL, FONT, rng, fade, ease, easeOut, clamp01, unit, text, subtitle, decoFrame, rule, gear, paper, weave, filmFX } from './film.js';

export const PRELUDE_DURATION = 51.5;

const ACTS = ['金色鳥籠', '消失的鴿子', '漂浮少女', '穿牆術', '鏡中人', '紙鶴', '水牢', '自動機', '千里眼', '子彈接手', '影子時鐘', '告別'];
const CN = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];

const LINES = [
  [9.8, 12.6, '節目單上，只印了十二幕。'],
  [12.8, 15.3, '第十三幕是什麼，只有林默自己知道。'],
  [15.9, 20.4, '一九四七年冬，告別公演的最後一夜。第十二幕謝幕，他舉起雙手——'],
  [22.6, 26.3, '燈再亮起時，舞台上只剩一頂帽子。'],
  [32.3, 36.6, '三天後，劇院派出檔案修復小組，打開他封存的工作室。'],
  [36.8, 39.9, '門開的那一刻，牆裡的齒輪開始轉動。']
];

export function createPrelude({ minutes = 60, reduced = false } = {}) {
  const env = { minutes, reduced };
  return {
    duration: PRELUDE_DURATION,
    render(g, W, H, t) {
      g.save();
      g.fillStyle = PAL.black;
      g.fillRect(0, 0, W, H);
      weave(g, t, W, H, env);
      if (t < 4.5) leader(g, W, H, t);
      else if (t < 9.5) yearCard(g, W, H, t);
      else if (t < 15.5) programme(g, W, H, t);
      else if (t < 26.5) stage(g, W, H, t, env);
      else if (t < 32) newspaper(g, W, H, t);
      else if (t < 40) door(g, W, H, t);
      else if (t < 46) wipeCard(g, W, H, t, env);
      else titleCard(g, W, H, t);
      g.restore();

      for (const [a, b, line] of LINES) {
        const al = fade(t, a, b, 0.35, 0.35);
        if (al > 0) subtitle(g, line, W, H, al);
      }
      filmFX(g, t, W, H, { reduced, grainAmt: t < 4.5 ? 1.3 : 1 });
    }
  };
}

// ── 0–4.5 片頭倒數 ───────────────────────────────────────────
function leader(g, W, H, t) {
  const u = unit(W, H);
  const cx = W / 2;
  const cy = H / 2;
  const r = Math.min(W, H) * 0.36;
  const end = 1 - ease((t - 4.1) / 0.4);
  g.globalAlpha = end;
  g.fillStyle = '#3a3024';
  g.fillRect(0, 0, W, H);
  const k = Math.floor((t - 0.6) / 1.2);
  const n = 3 - k;
  const local = ((t - 0.6) % 1.2) / 1.2;
  // 掃描扇形
  if (t >= 0.6 && n >= 1) {
    g.fillStyle = '#4c4031';
    g.beginPath();
    g.moveTo(cx, cy);
    g.arc(cx, cy, Math.hypot(W, H), -Math.PI / 2, -Math.PI / 2 + local * Math.PI * 2);
    g.closePath();
    g.fill();
  }
  g.strokeStyle = 'rgba(230,214,180,.7)';
  g.lineWidth = Math.max(1.5, u * 0.18);
  g.beginPath(); g.moveTo(0, cy); g.lineTo(W, cy); g.moveTo(cx, 0); g.lineTo(cx, H); g.stroke();
  for (const rr of [r, r * 0.82]) {
    g.beginPath(); g.arc(cx, cy, rr, 0, Math.PI * 2); g.stroke();
  }
  if (t >= 0.6 && n >= 1) {
    text(g, String(n), cx, cy + r * 0.04, r * 1.1, { color: '#efe2c4', font: FONT.display, weight: 600 });
  }
  g.globalAlpha = 1;
}

// ── 4.5–9.5 年份字卡 ─────────────────────────────────────────
function yearCard(g, W, H, t) {
  const u = unit(W, H);
  const a = fade(t, 4.5, 9.5, 0.8, 0.7);
  const fw = Math.min(W * 0.88, u * 92);
  const fh = Math.min(H * 0.72, u * 50);
  decoFrame(g, W / 2, H / 2, fw, fh, { alpha: a, u });
  text(g, '一九四七年　冬', W / 2, H / 2 - fh * 0.12, Math.min(u * 7.4, fw / 8), { color: PAL.sepia, alpha: a, spacing: 0.18 });
  rule(g, W / 2, H / 2 + fh * 0.07, Math.min(fw * 0.5, u * 30), { alpha: a * 0.9, u });
  text(g, '長明大戲院　·　魔術師林默告別公演', W / 2, H / 2 + fh * 0.22, Math.min(u * 3.2, fw / 17), {
    color: PAL.sepiaDim, alpha: fade(t, 5.4, 9.5, 0.8, 0.7), spacing: 0.16
  });
}

// ── 9.5–15.5 節目單 ──────────────────────────────────────────
function programme(g, W, H, t) {
  const u = unit(W, H);
  const a = fade(t, 9.5, 15.5, 0.6, 0.5);
  // 直立手機：讓紙張以螢幕寬度為準，字才不會太小
  const ph = Math.min(H * 0.74, Math.max(u * 64, W * 0.98));
  const pw = Math.min(W * 0.88, ph * 0.86);
  const cx = W / 2;
  const cy = H * 0.43 + (1 - easeOut((t - 9.5) / 1.2)) * H * 0.2;
  const zoom = 1 + (t - 9.5) * 0.006;
  g.save();
  g.globalAlpha = a;
  g.translate(cx, cy);
  g.scale(zoom, zoom);
  g.translate(-cx, -cy);
  paper(g, cx, cy, pw, ph, { seed: 21, rot: -0.012 });
  const k = ph / 64;
  const top = cy - ph / 2;
  text(g, '告 別 公 演', cx, top + k * 6, k * 3.6, { color: PAL.ink, weight: 600, spacing: 0.3 });
  text(g, '魔術師　林默', cx, top + k * 10.4, k * 2.4, { color: '#4a3a24', spacing: 0.24 });
  rule(g, cx, top + k * 13.6, pw * 0.6, { color: '#6e5530', u: k });
  // 十二幕，兩欄
  const colW = pw * 0.42;
  for (let i = 0; i < 12; i++) {
    const col = i < 6 ? 0 : 1;
    const row = i % 6;
    const x = cx + (col === 0 ? -colW * 0.55 : colW * 0.55);
    const y = top + k * 18.5 + row * k * 5.6;
    const appear = fade(t, 10.1 + i * 0.09, 99, 0.3, 0.1);
    text(g, `第${CN[i]}幕`, x - colW * 0.46, y, k * 1.9, { color: '#5a4426', align: 'left', alpha: appear });
    text(g, ACTS[i], x + colW * 0.46, y, k * 2.2, { color: PAL.ink, align: 'right', alpha: appear });
  }
  // 第十三幕：紅墨手寫，寫上之後被抹掉
  const y13 = top + k * 54;
  rule(g, cx, top + k * 50, pw * 0.7, { color: '#6e5530', u: k, alpha: 0.6 });
  text(g, '第十三幕', cx - pw * 0.2, y13, k * 2.4, { color: '#5a4426', alpha: fade(t, 12.6, 99, 0.4, 0.1) });
  const write = clamp01((t - 13.0) / 1.0);
  if (write > 0) {
    g.save();
    g.beginPath();
    g.rect(cx - pw * 0.05, y13 - k * 3, pw * 0.36 * write, k * 6);
    g.clip();
    text(g, '？？？', cx + pw * 0.12, y13, k * 3.2, { color: PAL.redInk, font: FONT.hand, weight: 600 });
    g.restore();
  }
  const smear = clamp01((t - 14.3) / 0.8);
  if (smear > 0) {
    g.strokeStyle = `rgba(110,26,30,${0.75 * smear})`;
    g.lineWidth = k * 1.6;
    g.lineCap = 'round';
    const sx = cx + pw * 0.12 - k * 6;
    g.beginPath();
    g.moveTo(sx, y13 + k * 0.1);
    g.lineTo(sx + k * 12 * smear, y13 - k * 0.7);
    g.stroke();
  }
  g.restore();
}

// ── 15.5–26.5 舞台 ───────────────────────────────────────────
function stage(g, W, H, t, env) {
  const u = unit(W, H);
  const a = fade(t, 15.5, 26.5, 0.8, 0.6);
  const flashAt = 20.8;
  const dark = t >= flashAt && t < 22.4;
  const after = t >= 22.4;
  const lightUp = after ? ease((t - 22.4) / 0.8) : 1;
  g.save();
  g.globalAlpha = a;

  const cx = W / 2;
  const floorY = H * 0.74;
  // 舞台背景：暗紅幕
  const bg = g.createLinearGradient(0, 0, 0, floorY);
  bg.addColorStop(0, '#1b0f0c');
  bg.addColorStop(1, '#2c1914');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, floorY);
  // 背幕褶皺
  for (let i = 0; i < 18; i++) {
    const x = (i / 18) * W;
    const grad = g.createLinearGradient(x, 0, x + W / 18, 0);
    grad.addColorStop(0, 'rgba(0,0,0,.35)');
    grad.addColorStop(0.5, 'rgba(120,50,40,.12)');
    grad.addColorStop(1, 'rgba(0,0,0,.35)');
    g.fillStyle = grad;
    g.fillRect(x, 0, W / 18, floorY);
  }
  // 地板（透視木紋）
  const fl = g.createLinearGradient(0, floorY, 0, H);
  fl.addColorStop(0, '#3a2a1c');
  fl.addColorStop(1, '#120c08');
  g.fillStyle = fl;
  g.fillRect(0, floorY, W, H - floorY);
  g.strokeStyle = 'rgba(0,0,0,.35)';
  g.lineWidth = 1;
  for (let i = -10; i <= 10; i++) {
    g.beginPath();
    g.moveTo(cx + i * W * 0.05, floorY);
    g.lineTo(cx + i * W * 0.16, H);
    g.stroke();
  }
  // 聚光燈
  const spotX = cx;
  const spotA = (dark ? 0 : lightUp) * 1;
  if (spotA > 0) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    const cone = g.createLinearGradient(0, 0, 0, floorY);
    cone.addColorStop(0, `rgba(255,236,190,${0.02 * spotA})`);
    cone.addColorStop(1, `rgba(255,226,170,${0.16 * spotA})`);
    g.fillStyle = cone;
    g.beginPath();
    g.moveTo(spotX - u * 2, 0);
    g.lineTo(spotX + u * 2, 0);
    g.lineTo(spotX + u * 15, floorY + u * 2);
    g.lineTo(spotX - u * 15, floorY + u * 2);
    g.closePath();
    g.fill();
    const pool = g.createRadialGradient(spotX, floorY + u * 2, 0, spotX, floorY + u * 2, u * 18);
    pool.addColorStop(0, `rgba(255,232,180,${0.32 * spotA})`);
    pool.addColorStop(1, 'rgba(255,232,180,0)');
    g.fillStyle = pool;
    g.beginPath();
    g.ellipse(spotX, floorY + u * 2, u * 18, u * 4.2, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  // 魔術師剪影
  const s = Math.min(H * 0.5, u * 40) / 40;   // 人物縮放
  if (t < flashAt) {
    const raise = ease((t - 18.0) / 2.2);
    magician(g, spotX, floorY + u * 1.5, s, raise);
  }
  if (after) {
    const rock = Math.sin((t - 22.4) * 5) * Math.exp(-(t - 22.4) * 0.9) * 0.25;
    hat(g, spotX + u * 0.5, floorY + u * 1.6, s, rock);
  }
  // 前景兩側紅幕與拱框
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? 0 : W;
    const w = W * 0.17;
    const grad = g.createLinearGradient(x0, 0, x0 - side * w, 0);
    grad.addColorStop(0, '#3d0d14');
    grad.addColorStop(0.6, '#6a1c26');
    grad.addColorStop(1, '#2a080d');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(x0, 0);
    g.lineTo(x0 - side * w, 0);
    g.quadraticCurveTo(x0 - side * w * 0.7, H * 0.5, x0 - side * w * 0.95, H);
    g.lineTo(x0, H);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,.35)';
    for (let k = 1; k < 5; k++) {
      g.beginPath();
      g.moveTo(x0 - side * w * (k / 5), 0);
      g.quadraticCurveTo(x0 - side * w * (k / 5) * 0.75, H * 0.5, x0 - side * w * (k / 5) * 0.92, H);
      g.stroke();
    }
  }
  const valance = g.createLinearGradient(0, 0, 0, H * 0.12);
  valance.addColorStop(0, '#2a080d');
  valance.addColorStop(1, '#5a1620');
  g.fillStyle = valance;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(W, 0);
  g.lineTo(W, H * 0.09);
  for (let i = 12; i >= 0; i--) g.quadraticCurveTo(W * ((i + 0.5) / 12), H * 0.13, W * (i / 12), H * 0.09);
  g.closePath();
  g.fill();

  // 燈滅
  if (dark) {
    const d = t < flashAt + 0.25 ? 0 : ease((t - flashAt - 0.25) / 0.3);
    g.fillStyle = `rgba(0,0,0,${0.94 * d})`;
    g.fillRect(-20, -20, W + 40, H + 40);
  }
  g.restore();

  // 爆閃（降低動態時改成柔和的亮起）
  if (t >= flashAt && t < flashAt + 0.9) {
    const k = 1 - (t - flashAt) / 0.9;
    g.fillStyle = `rgba(255,244,220,${(env.reduced ? 0.35 : 0.95) * k * k})`;
    g.fillRect(-20, -20, W + 40, H + 40);
  }
}

function magician(g, x, footY, s, raise) {
  g.save();
  g.translate(x, footY);
  g.scale(s, s);
  const ink = '#070505';
  // 斗篷（身後，舉手時被手臂撐開）
  g.fillStyle = '#120808';
  g.beginPath();
  g.moveTo(-4.2, -27.5);
  g.bezierCurveTo(-6 - raise * 1.5, -20, -7 - raise * 1.5, -8, -7.5 - raise * 2, -0.5);
  g.lineTo(7.5 + raise * 2, -0.5);
  g.bezierCurveTo(7 + raise * 1.5, -8, 6 + raise * 1.5, -20, 4.2, -27.5);
  g.closePath();
  g.fill();
  g.fillStyle = ink;
  // 褲管與皮鞋
  g.beginPath();
  g.moveTo(-2.4, -14); g.lineTo(-0.3, -14); g.lineTo(-0.6, -0.6); g.lineTo(-2.2, -0.6); g.closePath();
  g.moveTo(0.3, -14); g.lineTo(2.4, -14); g.lineTo(2.2, -0.6); g.lineTo(0.6, -0.6); g.closePath();
  g.fill();
  g.beginPath();
  g.ellipse(-1.9, -0.4, 1.6, 0.5, 0, 0, Math.PI * 2);
  g.ellipse(1.9, -0.4, 1.6, 0.5, 0, 0, Math.PI * 2);
  g.fill();
  // 燕尾服：寬肩、收腰、燕尾
  g.beginPath();
  g.moveTo(-4, -27.6);
  g.quadraticCurveTo(-3, -20, -2.6, -15);
  g.lineTo(-3.4, -9.5);
  g.lineTo(-1, -13.6);
  g.lineTo(1, -13.6);
  g.lineTo(3.4, -9.5);
  g.lineTo(2.6, -15);
  g.quadraticCurveTo(3, -20, 4, -27.6);
  g.closePath();
  g.fill();
  // 白襯衫的 V 領與領結
  g.fillStyle = '#cfc2a4';
  g.beginPath();
  g.moveTo(-1.1, -27.4); g.lineTo(0, -22.5); g.lineTo(1.1, -27.4); g.closePath();
  g.fill();
  g.fillStyle = ink;
  g.beginPath();
  g.moveTo(-1, -27.4); g.lineTo(0, -26.8); g.lineTo(1, -27.4); g.lineTo(1, -26.2); g.lineTo(0, -26.8); g.lineTo(-1, -26.2); g.closePath();
  g.fill();
  // 手臂：從垂在身側，到高舉成 V 字；白手套，右手持魔杖
  for (const side of [-1, 1]) {
    const ang = side * (0.18 + raise * 2.0);
    g.save();
    g.translate(side * 3.7, -26.8);
    g.rotate(ang);
    g.fillStyle = ink;
    g.beginPath();
    g.moveTo(-0.85, 0); g.lineTo(0.85, 0); g.lineTo(0.7, 10.2); g.lineTo(-0.7, 10.2); g.closePath();
    g.fill();
    g.fillStyle = '#e4d8bc';
    g.beginPath();
    g.ellipse(0, 11, 0.95, 1.15, 0, 0, Math.PI * 2);
    g.fill();
    if (side > 0) {
      g.strokeStyle = ink;
      g.lineWidth = 0.45;
      g.beginPath(); g.moveTo(0, 11); g.lineTo(-0.6, 16.5); g.stroke();
      g.fillStyle = '#efe4c8';
      g.beginPath(); g.arc(-0.62, 16.7, 0.35, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }
  // 頭、高帽
  g.fillStyle = ink;
  g.beginPath();
  g.ellipse(0, -30.6, 2.2, 2.6, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(0, -32.8, 4, 0.6, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(-2.4, -32.8); g.lineTo(-2.2, -39); g.lineTo(2.2, -39); g.lineTo(2.4, -32.8); g.closePath();
  g.fill();
  g.restore();
}

function hat(g, x, floorY, s, rock) {
  g.save();
  g.translate(x, floorY);
  g.scale(s, s);
  g.rotate(rock);
  g.fillStyle = '#0a0706';
  g.beginPath();
  g.ellipse(0, -0.5, 4.2, 0.9, 0, 0, Math.PI * 2);
  g.fill();
  g.fillRect(-2.5, -6.6, 5, 6.2);
  g.fillStyle = 'rgba(160,40,40,.7)';
  g.fillRect(-2.5, -2.2, 5, 0.9);
  g.restore();
}

// ── 26.5–32 報紙 ─────────────────────────────────────────────
function newspaper(g, W, H, t) {
  const u = unit(W, H);
  const a = fade(t, 26.5, 32, 0.15, 0.5);
  const spin = easeOut((t - 26.5) / 0.95);
  const scale = (0.06 + spin * 0.94) * (1 + (t - 27.4) * 0.012);
  const rot = (1 - spin) * Math.PI * 5;
  const ph = Math.min(H * 0.86, Math.max(u * 70, W * 0.9));
  const pw = Math.min(W * 0.94, ph * 1.05);
  g.save();
  g.globalAlpha = a;
  g.translate(W / 2, H * 0.46);
  g.rotate(rot - 0.03);
  g.scale(scale, scale);
  paper(g, 0, 0, pw, ph, { color: '#d8cba8', seed: 77 });
  const k = ph / 70;
  const top = -ph / 2;
  const left = -pw / 2;
  text(g, '夜 光 晚 報', 0, top + k * 7, k * 6, { color: '#120d08', weight: 700, spacing: 0.25 });
  g.fillStyle = '#2a2016';
  g.fillRect(left + pw * 0.05, top + k * 11.5, pw * 0.9, k * 0.45);
  text(g, '一九四七年十二月十九日　星期五　第三版', 0, top + k * 13.6, k * 1.6, { color: '#3a2c1c' });
  g.fillRect(left + pw * 0.05, top + k * 15.4, pw * 0.9, k * 0.2);
  text(g, '魔術師林默　謝幕後台上消失', 0, top + k * 22, Math.min(k * 5.6, pw / 13.5), { color: '#0e0a06', weight: 800 });
  text(g, '第十三幕臨時取消　劇院封存其工作室', 0, top + k * 28.6, Math.min(k * 2.7, pw / 19), { color: '#2a2016', weight: 600 });
  // 相片：舞台上的帽子
  const phx = left + pw * 0.06;
  const phy = top + k * 33;
  const phw = pw * 0.36;
  const phh = k * 27;
  g.fillStyle = '#2a221a';
  g.fillRect(phx, phy, phw, phh);
  const spot = g.createRadialGradient(phx + phw / 2, phy + phh * 0.7, 0, phx + phw / 2, phy + phh * 0.7, phw * 0.6);
  spot.addColorStop(0, 'rgba(230,214,180,.55)');
  spot.addColorStop(1, 'rgba(230,214,180,0)');
  g.fillStyle = spot;
  g.fillRect(phx, phy, phw, phh);
  hat(g, phx + phw / 2, phy + phh * 0.74, k * 1.6, -0.08);
  text(g, '▲ 舞台上只留下一頂高帽', phx + phw / 2, phy + phh + k * 2.2, k * 1.4, { color: '#3a2c1c' });
  // 內文：灰色行
  const r = rng(404);
  const colX = phx + phw + pw * 0.04;
  const colW = pw * 0.94 - phw - pw * 0.04;
  const lead = '本報訊　名魔術師林默昨夜於長明大戲院告別公演中，第十二幕謝幕時燈光熄滅三秒，復明後人已不見，僅餘高帽一頂。劇院表示，節目單所載「第十三幕」原定於當晚首演，現已取消。';
  const size = k * 1.55;
  let line = '';
  let y = phy + size;
  for (const ch of lead) {
    g.font = `500 ${size}px ${FONT.display}`;
    if (g.measureText(line + ch).width > colW) {
      text(g, line, colX, y, size, { color: '#1e160e', align: 'left' });
      line = ch;
      y += size * 1.7;
    } else line += ch;
  }
  text(g, line, colX, y, size, { color: '#1e160e', align: 'left' });
  y += size * 2.2;
  g.fillStyle = 'rgba(40,30,20,.32)';
  while (y < phy + phh + k * 3) {
    g.fillRect(colX, y - size * 0.3, colW * (0.55 + r() * 0.45), size * 0.55);
    y += size * 1.7;
  }
  g.restore();
}

// ── 32–40 工作室的門 ─────────────────────────────────────────
function door(g, W, H, t) {
  const u = unit(W, H);
  const a = fade(t, 32, 40, 0.7, 0.5);
  g.save();
  g.globalAlpha = a;
  const push = 1 + (t - 32) * 0.02;
  g.translate(W / 2, H / 2);
  g.scale(push, push);
  g.translate(-W / 2, -H / 2);
  // 走廊牆面
  g.fillStyle = '#17110c';
  g.fillRect(0, 0, W, H);
  const dh = Math.min(H * 0.78, u * 60);
  const dw = dh * 0.46;
  const dx = W / 2 - dw / 2;
  const dy = H * 0.86 - dh;
  // 門框
  g.fillStyle = '#2a1d12';
  g.fillRect(dx - u * 1.4, dy - u * 1.4, dw + u * 2.8, dh + u * 1.4);
  // 門後的光
  const open = ease((t - 34.3) / 2.6);
  if (open > 0) {
    const inner = g.createLinearGradient(dx, dy, dx + dw, dy + dh);
    inner.addColorStop(0, '#f2d79a');
    inner.addColorStop(1, '#a8743a');
    g.fillStyle = inner;
    g.fillRect(dx, dy, dw, dh);
    // 齒輪在光裡轉
    const ga = ease((t - 37.0) / 1.2);
    if (ga > 0) {
      g.save();
      g.beginPath(); g.rect(dx, dy, dw, dh); g.clip();
      const spin = (t - 37) * 0.9;
      gear(g, dx + dw * 0.3, dy + dh * 0.32, dw * 0.26, 14, spin, { color: 'rgba(90,58,24,.75)', alpha: ga });
      gear(g, dx + dw * 0.72, dy + dh * 0.5, dw * 0.19, 10, -spin * 1.4 + 0.2, { color: 'rgba(90,58,24,.75)', alpha: ga });
      gear(g, dx + dw * 0.42, dy + dh * 0.72, dw * 0.15, 9, spin * 1.7, { color: 'rgba(90,58,24,.7)', alpha: ga });
      g.restore();
    }
    // 地上的光
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = a * open * 0.5;
    const spill = g.createLinearGradient(0, dy + dh, 0, H);
    spill.addColorStop(0, 'rgba(240,200,130,.6)');
    spill.addColorStop(1, 'rgba(240,200,130,0)');
    g.fillStyle = spill;
    g.beginPath();
    g.moveTo(dx, dy + dh);
    g.lineTo(dx + dw, dy + dh);
    g.lineTo(dx + dw + dw * 0.9 * open, H);
    g.lineTo(dx - dw * 0.5 * open, H);
    g.closePath();
    g.fill();
    g.restore();
  }
  // 門板（往內開：寬度隨角度縮）
  const panelW = dw * Math.cos(open * Math.PI * 0.44);
  g.fillStyle = '#3b2716';
  g.fillRect(dx, dy, panelW, dh);
  g.strokeStyle = 'rgba(0,0,0,.4)';
  g.lineWidth = Math.max(1, u * 0.12);
  for (const [fy, fh] of [[0.08, 0.36], [0.52, 0.4]]) {
    g.strokeRect(dx + panelW * 0.14, dy + dh * fy, panelW * 0.72, dh * fh);
  }
  if (panelW > dw * 0.5) {
    // 銅牌與把手
    const plateW = panelW * 0.62;
    g.fillStyle = PAL.brass;
    g.fillRect(dx + panelW / 2 - plateW / 2, dy + dh * 0.2, plateW, dh * 0.08);
    text(g, '林默　工作室', dx + panelW / 2, dy + dh * 0.24, Math.min(dh * 0.038, plateW / 6.5), { color: '#2a1a0a', weight: 700, spacing: 0.1 });
    text(g, '閒人勿入', dx + panelW / 2, dy + dh * 0.33, dh * 0.026, { color: PAL.sepiaDim });
    g.fillStyle = PAL.brass;
    g.beginPath();
    g.arc(dx + panelW * 0.86, dy + dh * 0.55, dh * 0.016, 0, Math.PI * 2);
    g.fill();
  }
  // 封條（開門時被扯斷）
  if (open < 0.2) {
    g.save();
    g.globalAlpha = a * (1 - open * 5);
    g.translate(dx + dw / 2, dy + dh * 0.46);
    g.rotate(-0.5);
    g.fillStyle = '#d9cfb4';
    g.fillRect(-dw * 0.7, -dh * 0.025, dw * 1.4, dh * 0.05);
    text(g, '長明大戲院　封', 0, 0, dh * 0.026, { color: PAL.redInk, weight: 700 });
    g.restore();
  }
  g.restore();
}

// ── 40–46 清場機關啟動 ───────────────────────────────────────
function wipeCard(g, W, H, t, env) {
  const u = unit(W, H);
  const a = fade(t, 40, 46, 0.5, 0.5);
  const fw = Math.min(W * 0.88, u * 92);
  const fh = Math.min(H * 0.76, u * 54);
  // 背景齒輪
  const spin = (t - 40) * 0.5;
  gear(g, W / 2 - fw * 0.42, H / 2 + fh * 0.36, fh * 0.42, 18, spin, { color: 'rgba(120,90,40,.14)', alpha: a });
  gear(g, W / 2 + fw * 0.44, H / 2 - fh * 0.34, fh * 0.32, 14, -spin * 1.3, { color: 'rgba(120,90,40,.12)', alpha: a });
  decoFrame(g, W / 2, H / 2, fw, fh, { alpha: a, u, color: PAL.velvet });
  text(g, '清 場 機 關　已 啟 動', W / 2, H / 2 - fh * 0.27, Math.min(u * 3.6, fw / 14), { color: '#d05a4e', alpha: a, spacing: 0.2, weight: 600 });
  const limitless = !env.minutes;
  let digits = '—— : ——';
  if (!limitless) {
    const total = env.minutes * 60;
    const passed = Math.max(0, Math.floor(t - 41.5));
    const left = Math.max(0, total - passed);
    digits = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;
  }
  const da = fade(t, 40.6, 46, 0.4, 0.5);
  text(g, digits, W / 2, H / 2 + fh * 0.0, Math.min(u * 13, fw / 4.2), { color: PAL.brassLit, alpha: da, weight: 600, glow: u * 1.2, spacing: 0.06 });
  const note = limitless
    ? '（排練模式：發條被卸下了，你們有的是時間。）'
    : '時間一到，最後一場排練的全部紀錄都會被焚毀。';
  text(g, note, W / 2, H / 2 + fh * 0.28, Math.min(u * 2.5, fw / 21), { color: PAL.sepia, alpha: fade(t, 41.6, 46, 0.6, 0.5), spacing: 0.06 });
}

// ── 46–51.5 片名 ─────────────────────────────────────────────
function titleCard(g, W, H, t) {
  const u = unit(W, H);
  const out = 1 - ease((t - 50.4) / 1.1);
  g.save();
  g.globalAlpha = out;
  const kick = fade(t, 46.3, 99, 0.8, 0.1);
  text(g, '魔術師林默的最後房間', W / 2, H / 2 - Math.min(u * 10, W * 0.12), Math.min(u * 2.6, W / 18), { color: PAL.sepiaDim, alpha: kick, spacing: 0.4 });
  const title = '消失的第十三幕';
  const size = Math.min(u * 9.5, W / 9);
  g.font = `600 ${size}px ${FONT.display}`;
  const step = size * 1.12;
  const startX = W / 2 - (step * (title.length - 1)) / 2;
  [...title].forEach((ch, i) => {
    const ca = ease((t - 46.6 - i * 0.16) / 0.7);
    text(g, ch, startX + i * step, H / 2 + size * 0.1 + (1 - ca) * u * 1.2, size, { color: PAL.brassLit, alpha: ca, glow: u * 2.4, weight: 600 });
  });
  rule(g, W / 2, H / 2 + size * 1.0, Math.min(W * 0.5, u * 40), { alpha: fade(t, 47.8, 99, 0.8, 0.1), u });
  g.restore();
}
