// 所有貼圖都在瀏覽器端用 Canvas 2D 生成，專案不含任何圖檔。
// 這讓整個遊戲的傳輸量只有程式碼大小，第一次開啟幾乎沒有等待。
// 若日後要換成 .glb / KTX2 貼圖，只需替換這一層的回傳值。

import THREE from '../core/three.js';

const cache = new Map();
function memo(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

function canvas2d(w = 512, h = 512) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  return { c, ctx };
}

function toTexture(c, { repeat = [1, 1], srgb = true, aniso = 4 } = {}) {
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = aniso;
  if (srgb && THREE.SRGBColorSpace && 'colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function grain(ctx, w, h, amount = 14, alpha = 0.06) {
  for (let i = 0; i < w * h / 26; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const v = (Math.random() * 2 - 1) * amount;
    ctx.fillStyle = `rgba(${128 + v},${128 + v},${128 + v},${alpha})`;
    ctx.fillRect(x, y, 1.6, 1.6);
  }
}

// ── 表面貼圖 ──────────────────────────────────────────────────
export const floorTexture = () => memo('floor', () => {
  const { c, ctx } = canvas2d(512, 512);
  ctx.fillStyle = '#4c3729';
  ctx.fillRect(0, 0, 512, 512);
  const plank = 64;
  for (let row = 0; row < 512 / plank; row++) {
    const offset = (row % 2) * plank * 0.5;
    for (let x = -plank; x < 512 + plank; x += plank * 2) {
      const shade = 54 + Math.random() * 30;
      ctx.fillStyle = `rgb(${shade + 30},${shade + 14},${shade})`;
      ctx.fillRect(x + offset, row * plank, plank * 2 - 3, plank - 3);
      // 木紋
      ctx.strokeStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.08})`;
      ctx.lineWidth = 1;
      for (let k = 0; k < 6; k++) {
        const y = row * plank + 6 + k * 9 + Math.random() * 3;
        ctx.beginPath();
        ctx.moveTo(x + offset, y);
        ctx.bezierCurveTo(x + offset + 40, y + 2, x + offset + 80, y - 2, x + offset + plank * 2, y + 1);
        ctx.stroke();
      }
    }
  }
  grain(ctx, 512, 512, 20, 0.05);
  return toTexture(c, { repeat: [4, 3] });
});

export const plasterTexture = () => memo('plaster', () => {
  const { c, ctx } = canvas2d(512, 512);
  ctx.fillStyle = '#6d6259';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 60; i++) {
    const g = ctx.createRadialGradient(Math.random() * 512, Math.random() * 512, 4, Math.random() * 512, Math.random() * 512, 60 + Math.random() * 120);
    g.addColorStop(0, `rgba(${86 + Math.random() * 34},${76 + Math.random() * 26},${68 + Math.random() * 22},0.45)`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
  }
  grain(ctx, 512, 512, 26, 0.08);
  return toTexture(c, { repeat: [3, 1.4] });
});

export const velvetTexture = () => memo('velvet', () => {
  const { c, ctx } = canvas2d(256, 512);
  const g = ctx.createLinearGradient(0, 0, 256, 0);
  g.addColorStop(0, '#3a0a13');
  g.addColorStop(0.5, '#6d1c2b');
  g.addColorStop(1, '#2c070f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 42; i++) {
    const x = Math.random() * 256;
    ctx.fillStyle = `rgba(${Math.random() > 0.5 ? 130 : 20},20,30,${0.06 + Math.random() * 0.1})`;
    ctx.fillRect(x, 0, 3 + Math.random() * 9, 512);
  }
  grain(ctx, 256, 512, 18, 0.05);
  return toTexture(c, { repeat: [6, 1] });
});

export const woodTexture = () => memo('wood', () => {
  const { c, ctx } = canvas2d(512, 256);
  ctx.fillStyle = '#63452a';
  ctx.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 90; i++) {
    ctx.strokeStyle = `rgba(${112 + Math.random() * 54},${80 + Math.random() * 34},${52 + Math.random() * 24},0.5)`;
    ctx.lineWidth = 0.6 + Math.random() * 2.4;
    const y = Math.random() * 256;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(170, y + (Math.random() * 16 - 8), 340, y + (Math.random() * 16 - 8), 512, y);
    ctx.stroke();
  }
  grain(ctx, 512, 256, 16, 0.05);
  return toTexture(c, { repeat: [1, 1] });
});

export const stoneTexture = () => memo('stone', () => {
  const { c, ctx } = canvas2d(256, 256);
  ctx.fillStyle = '#302e39';
  ctx.fillRect(0, 0, 256, 256);
  grain(ctx, 256, 256, 30, 0.1);
  return toTexture(c, { repeat: [2, 2] });
});

// ── 敘事貼圖 ──────────────────────────────────────────────────

/** 三張歷年海報；uv=true 時顯示 UV 燈下才看得到的眼睛姿勢 */
export function posterTexture(index, uv = false) {
  return memo(`poster-${index}-${uv}`, () => {
    const { c, ctx } = canvas2d(512, 768);
    ctx.fillStyle = uv ? '#0d1020' : '#e5d7b4';
    ctx.fillRect(0, 0, 512, 768);
    if (!uv) {
      const g = ctx.createRadialGradient(256, 300, 40, 256, 300, 420);
      g.addColorStop(0, '#f3e8c8');
      g.addColorStop(1, '#cbb98f');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 512, 768);
    }

    const titles = ['第七幕 · 消失的鴿子', '第十幕 · 空椅子', '第十二幕 · 兩個林默'];
    const years = ['一九三七', '一九四一', '一九四四'];
    const ink = uv ? '#2a3f6a' : '#2b1d12';

    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    ctx.font = '600 44px "Songti TC","Noto Serif TC",serif';
    ctx.fillText('林 默', 256, 108);
    ctx.font = '500 26px "Songti TC","Noto Serif TC",serif';
    ctx.fillText(titles[index], 256, 156);
    ctx.font = '400 20px "Songti TC","Noto Serif TC",serif';
    ctx.fillText(years[index], 256, 700);

    // 中央圖形：帽子／椅子／雙人剪影
    ctx.strokeStyle = ink;
    ctx.lineWidth = 4;
    ctx.beginPath();
    if (index === 0) {
      ctx.ellipse(256, 430, 150, 34, 0, 0, Math.PI * 2);
      ctx.moveTo(150, 424);
      ctx.lineTo(160, 320);
      ctx.lineTo(352, 320);
      ctx.lineTo(362, 424);
    } else if (index === 1) {
      ctx.rect(180, 380, 150, 20);
      ctx.moveTo(180, 400); ctx.lineTo(180, 520);
      ctx.moveTo(330, 400); ctx.lineTo(330, 520);
      ctx.moveTo(320, 380); ctx.lineTo(320, 250);
      ctx.moveTo(200, 250); ctx.lineTo(320, 250);
    } else {
      ctx.ellipse(196, 380, 52, 62, 0, 0, Math.PI * 2);
      ctx.ellipse(320, 380, 52, 62, 0, 0, Math.PI * 2);
      ctx.moveTo(150, 470); ctx.lineTo(150, 600);
      ctx.moveTo(366, 470); ctx.lineTo(366, 600);
    }
    ctx.stroke();

    if (uv) {
      // 被遮掉的圖層：眼睛姿勢 + 序號
      const eye = ['left', 'right', 'both'][index];
      ctx.save();
      ctx.translate(256, 580);
      ctx.strokeStyle = '#8ad8ff';
      ctx.fillStyle = '#8ad8ff';
      ctx.lineWidth = 5;
      const drawEye = (cx, closed) => {
        ctx.beginPath();
        if (closed) {
          ctx.moveTo(cx - 40, 0);
          ctx.quadraticCurveTo(cx, 22, cx + 40, 0);
          ctx.stroke();
          for (let i = -1; i <= 1; i++) {
            ctx.beginPath();
            ctx.moveTo(cx + i * 22, 14);
            ctx.lineTo(cx + i * 26, 30);
            ctx.stroke();
          }
        } else {
          ctx.ellipse(cx, 0, 42, 24, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(cx, 0, 11, 0, Math.PI * 2);
          ctx.fill();
        }
      };
      drawEye(-72, eye === 'left' || eye === 'both');
      drawEye(72, eye === 'right' || eye === 'both');
      ctx.font = '600 30px "Songti TC",serif';
      ctx.textAlign = 'center';
      ctx.fillText(['遮左', '遮右', '遮雙'][index], 0, 100);
      ctx.fillText(`第 ${index + 1}`, 0, 142);
      ctx.restore();
    }
    grain(ctx, 512, 768, 20, 0.07);
    return toTexture(c);
  });
}

/** 三幅肖像；cover = none / left / right / both */
export function portraitTexture(index, cover = 'none') {
  return memo(`portrait-${index}-${cover}`, () => {
    const { c, ctx } = canvas2d(384, 512);
    const bg = ['#2c2a26', '#262b2c', '#2b2622'][index];
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 384, 512);
    const g = ctx.createRadialGradient(192, 200, 30, 192, 240, 300);
    g.addColorStop(0, 'rgba(226,206,166,0.30)');
    g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 384, 512);

    // 頭肩剪影
    ctx.fillStyle = '#d9c49a';
    ctx.beginPath();
    ctx.ellipse(192, 200, 82, 104, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(60, 512);
    ctx.quadraticCurveTo(192, 300, 324, 512);
    ctx.fillStyle = ['#1d1b18', '#221d2a', '#1a2020'][index];
    ctx.fill();

    // 眼睛
    const eyeY = 188;
    const drawEye = (cx, closed) => {
      ctx.strokeStyle = '#3b2b1c';
      ctx.lineWidth = 4;
      ctx.beginPath();
      if (closed) {
        ctx.moveTo(cx - 22, eyeY);
        ctx.quadraticCurveTo(cx, eyeY + 12, cx + 22, eyeY);
        ctx.stroke();
      } else {
        ctx.ellipse(cx, eyeY, 24, 13, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#26201a';
        ctx.beginPath();
        ctx.arc(cx, eyeY, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    drawEye(154, cover === 'left' || cover === 'both');
    drawEye(230, cover === 'right' || cover === 'both');

    // 嘴與年份
    ctx.strokeStyle = '#4a3524';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(172, 246);
    ctx.quadraticCurveTo(192, 254 - index * 4, 212, 246);
    ctx.stroke();

    ctx.fillStyle = '#c8a44d';
    ctx.font = '500 20px "Songti TC",serif';
    ctx.textAlign = 'center';
    ctx.fillText(['一九三七', '一九四一', '一九四四'][index], 192, 486);

    if (cover !== 'none') {
      ctx.fillStyle = 'rgba(200,164,77,0.16)';
      ctx.fillRect(0, 0, 384, 512);
    }
    grain(ctx, 384, 512, 22, 0.08);
    return toTexture(c);
  });
}

/** 北牆鐘面：revealed=true 時顯示 0315 */
export function clockFaceTexture(revealed = false) {
  return memo(`clock-${revealed}`, () => {
    const { c, ctx } = canvas2d(512, 512);
    ctx.fillStyle = '#332c29';
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = revealed ? '#e8c063' : '#4b423d';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(256, 256, 210, 0, Math.PI * 2);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 1; i <= 12; i++) {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      ctx.fillStyle = revealed ? '#f0d48a' : '#4b423d';
      ctx.font = '500 40px "Songti TC",serif';
      ctx.fillText(String(i), 256 + Math.cos(a) * 168, 256 + Math.sin(a) * 168);
    }
    if (revealed) {
      ctx.fillStyle = '#f5e6b8';
      ctx.font = '600 76px "Songti TC",serif';
      ctx.fillText('0 3 1 5', 256, 300);
      ctx.font = '400 26px "Songti TC",serif';
      ctx.fillStyle = '#c8a44d';
      ctx.fillText('抽屜', 256, 372);
    }
    grain(ctx, 512, 512, 20, 0.07);
    return toTexture(c);
  });
}

/** 徽記圖案（太陽／月亮／星星） */
export function sigilTexture(kind) {
  return memo(`sigil-${kind}`, () => {
    const { c, ctx } = canvas2d(256, 256);
    ctx.fillStyle = '#141017';
    ctx.fillRect(0, 0, 256, 256);
    ctx.translate(128, 128);
    ctx.strokeStyle = '#f0d48a';
    ctx.fillStyle = '#f0d48a';
    ctx.lineWidth = 7;
    if (kind === 'sun') {
      ctx.beginPath(); ctx.arc(0, 0, 46, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 62, Math.sin(a) * 62);
        ctx.lineTo(Math.cos(a) * 92, Math.sin(a) * 92);
        ctx.stroke();
      }
      ctx.font = '600 40px "Songti TC",serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#141017';
      ctx.fillText('4', 0, 16);
    } else if (kind === 'moon') {
      ctx.beginPath();
      ctx.arc(6, 0, 74, Math.PI * 0.32, Math.PI * 1.68);
      ctx.arc(-26, 0, 76, Math.PI * 1.72, Math.PI * 0.28, true);
      ctx.fill();
      ctx.fillStyle = '#141017';
      ctx.font = '600 40px "Songti TC",serif';
      ctx.textAlign = 'center';
      ctx.fillText('7', -8, 16);
    } else {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 38 : 88;
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#141017';
      ctx.font = '600 34px "Songti TC",serif';
      ctx.textAlign = 'center';
      ctx.fillText('2', 0, 14);
    }
    return toTexture(c);
  });
}

/** 地面腳印感測區號碼 */
export function footPlateTexture(n) {
  return memo(`foot-${n}`, () => {
    const { c, ctx } = canvas2d(256, 256);
    ctx.fillStyle = '#221a15';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = 'rgba(200,164,77,0.5)';
    ctx.lineWidth = 5;
    ctx.setLineDash([14, 10]);
    ctx.strokeRect(16, 16, 224, 224);
    ctx.setLineDash([]);
    // 腳印輪廓
    ctx.fillStyle = 'rgba(200,164,77,0.22)';
    ctx.beginPath();
    ctx.ellipse(128, 112, 44, 62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(128, 196, 30, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f0d48a';
    ctx.font = '600 92px "Songti TC",serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(n), 128, 122);
    return toTexture(c);
  });
}

export function labelTexture(text, { w = 512, h = 128, size = 46, color = '#e8dcc0', bg = '#1a1620' } = {}) {
  return memo(`label-${text}-${w}-${h}-${size}`, () => {
    const { c, ctx } = canvas2d(w, h);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(200,164,77,0.45)';
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.fillStyle = color;
    ctx.font = `500 ${size}px "Songti TC","Noto Serif TC",serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 2);
    return toTexture(c);
  });
}

/** 工作檯上的排練單（重量關係） */
export const rehearsalSheetTexture = () => memo('sheet', () => {
  const { c, ctx } = canvas2d(512, 384);
  ctx.fillStyle = '#e6dcc0';
  ctx.fillRect(0, 0, 512, 384);
  ctx.fillStyle = '#2b1f14';
  ctx.font = '600 34px "Songti TC",serif';
  ctx.textAlign = 'left';
  ctx.fillText('排練單 · 道具重量', 36, 62);
  ctx.font = '400 30px "Songti TC",serif';
  ctx.fillText('兔 ＝ 帽 ＋ 硬幣', 44, 150);
  ctx.fillText('鴿 ＝ 硬幣 ＋ 硬幣', 44, 208);
  ctx.fillText('帽 ＞ 硬幣', 44, 266);
  ctx.strokeStyle = 'rgba(43,31,20,0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(36, 84); ctx.lineTo(476, 84); ctx.stroke();
  ctx.font = '400 22px "Songti TC",serif';
  ctx.fillText('※ 平衡後鎖扣自動開啟', 44, 336);
  grain(ctx, 512, 384, 18, 0.06);
  return toTexture(c);
});

// ── 共用材質 ──────────────────────────────────────────────────
export const M = {
  brass: (extra = {}) => new THREE.MeshStandardMaterial({
    color: 0xc8a44d, metalness: 0.9, roughness: 0.32,
    emissive: 0x2a1d06, emissiveIntensity: 1, ...extra
  }),
  darkMetal: (extra = {}) => new THREE.MeshStandardMaterial({
    color: 0x3a3a42, metalness: 0.8, roughness: 0.45,
    emissive: 0x0a0a0f, emissiveIntensity: 1, ...extra
  }),
  wood: (extra = {}) => new THREE.MeshStandardMaterial({
    map: woodTexture(), color: 0x9a7551, roughness: 0.72, metalness: 0.05,
    emissive: 0x0d0906, emissiveIntensity: 1, ...extra
  }),
  glass: (extra = {}) => new THREE.MeshStandardMaterial({
    color: 0xaad4e0, transparent: true, opacity: 0.22,
    metalness: 0.1, roughness: 0.08, side: THREE.DoubleSide, ...extra
  }),
  mirror: (extra = {}) => new THREE.MeshStandardMaterial({
    color: 0x9fb0c0, metalness: 1, roughness: 0.08,
    emissive: 0x10161c, emissiveIntensity: 1, ...extra
  }),
  glow: (color = 0xf0d48a, intensity = 1.6) => new THREE.MeshStandardMaterial({
    color: 0x0a0a0a, emissive: color, emissiveIntensity: intensity, roughness: 1, metalness: 0
  }),
  paper: (map, extra = {}) => new THREE.MeshStandardMaterial({
    map, roughness: 0.92, metalness: 0,
    emissive: 0x141010, emissiveIntensity: 1, ...extra
  }),
  velvet: (extra = {}) => new THREE.MeshStandardMaterial({
    map: velvetTexture(), color: 0x8c3040, roughness: 0.95, metalness: 0,
    emissive: 0x14060a, emissiveIntensity: 1, ...extra
  })
};

export function disposeTextureCache() {
  cache.forEach((tex) => tex?.dispose?.());
  cache.clear();
}
