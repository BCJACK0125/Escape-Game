// 燈光預算檢查：算出幾個取樣點的大致照度，避免有人不小心把強度改回 0
// 造成「畫面全黑」重演。這不是視覺驗收，只是下限保護。
// 用法：node tools/test/lighting.mjs
import { withPage, report } from './harness.mjs';

const ok = await withPage(8811, async (page, errors) => {
  const checks = await page.evaluate(async () => {
    const { store, ctx } = window.__act13;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const out = [];
    const add = (l, v, n = '') => out.push([l, !!v, n]);

    store.newGame('rehearsal');
    document.querySelector('.title-actions .btn--lead')?.click();
    await wait(200);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    await wait(400);

    const lum = (hex) => {
      const r = ((hex >> 16) & 255) / 255, g = ((hex >> 8) & 255) / 255, b = (hex & 255) / 255;
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    // 取樣點：出生點、房間中央、三面牆前
    const points = [
      { name: '出生點', x: -1.0, z: 3.3 },
      { name: '房間中央', x: 0, z: 0 },
      { name: '北牆前（光影）', x: -3.0, z: -3.0 },
      { name: '東牆前（聲音）', x: 4.6, z: -0.6 },
      { name: '西牆前（物理）', x: -4.6, z: 0.8 }
    ];

    function illuminanceAt(p) {
      let total = 0;
      ctx.scene.traverse((o) => {
        if (!o.isLight || o.intensity <= 0) return;
        const L = lum(o.color.hex ?? 0xffffff);
        const type = o.constructor.name;
        if (/Ambient|Hemisphere/.test(type)) { total += L * o.intensity; return; }
        const d = Math.max(0.4, Math.hypot(o.position.x - p.x, o.position.y - 1.62, o.position.z - p.z));
        if (o.distance > 0 && d > o.distance) return;
        total += (L * o.intensity) / (d * d);   // decay = 2
      });
      return total;
    }

    const report1 = points.map((p) => `${p.name} ${illuminanceAt(p).toFixed(2)}`).join('　');
    const min1 = Math.min(...points.map(illuminanceAt));
    add('序幕（只有桌燈）每個取樣點都有基本照度', min1 > 0.25, report1);
    add('序幕不會有任何取樣點過曝', Math.max(...points.map(illuminanceAt)) < 14,
      `最亮 ${Math.max(...points.map(illuminanceAt)).toFixed(2)}`);

    // 打開吊燈與三面牆工作燈
    ctx.world.room.setLampOn(true);
    ctx.world.room.setWorkLights(true);
    await wait(100);
    const report2 = points.map((p) => `${p.name} ${illuminanceAt(p).toFixed(2)}`).join('　');
    const min2 = Math.min(...points.map(illuminanceAt));
    add('三面牆點燈後照度明顯提升', min2 > min1 * 1.4 && min2 > 0.6, report2);
    const max2 = Math.max(...points.map(illuminanceAt));
    add('點燈後也不會過曝成全白', max2 < 20, `最亮 ${max2.toFixed(2)}（超過 20 就會糊成白色）`);

    // 材質不該是「深色貼圖 × 深色底色」造成的近黑
    const albedo = [];
    ctx.scene.traverse((o) => {
      if (o.isMesh && o.material && o.material.map && o.material.color) albedo.push(lum(o.material.color.hex));
    });
    const avg = albedo.reduce((a, b) => a + b, 0) / (albedo.length || 1);
    add('有貼圖的材質底色夠亮（避免暗度平方）', avg > 0.5,
      `${albedo.length} 個材質，平均亮度 ${avg.toFixed(2)}`);

    add('曝光值在合理範圍', ctx.engine.exposure >= 0.8 && ctx.engine.exposure <= 1.6, `曝光 ${ctx.engine.exposure}`);

    // 直接量測程序化貼圖的實際平均亮度（讀 canvas 像素，不是估算）
    const mats = await import('/js/world/materials.js');
    const measure = (canvas) => {
      const c = document.createElement('canvas');
      c.width = 48; c.height = 48;
      const g = c.getContext('2d');
      g.drawImage(canvas, 0, 0, 48, 48);
      const d = g.getImageData(0, 0, 48, 48).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) {
        sum += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
      }
      return sum / (d.length / 4);
    };
    // 絨布幕本來就該是深酒紅，門檻另計；其餘表面必須是可辨識的中間調
    const samples = [
      { name: '地板', tex: mats.floorTexture(), min: 0.20, max: 0.75 },
      { name: '牆面', tex: mats.plasterTexture(), min: 0.20, max: 0.75 },
      { name: '木料', tex: mats.woodTexture(), min: 0.20, max: 0.75 },
      { name: '絨布', tex: mats.velvetTexture(), min: 0.07, max: 0.40 }
    ];
    const readings = samples.map((s2) => ({ ...s2, v: s2.tex.image ? measure(s2.tex.image) : 0 }));
    const detail = readings.map((r) => `${r.name} ${r.v.toFixed(2)}`).join('　');
    add('貼圖本身不是近黑（實際量測像素）',
      readings.every((r) => r.v > r.min && r.v < r.max), detail);

    return out;
  });
  return report('燈光預算', checks, errors);
});
process.exit(ok ? 0 : 1);
