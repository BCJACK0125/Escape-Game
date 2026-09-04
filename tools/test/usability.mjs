// 可用性稽核：從玩家視角量測每一個互動點。
// 回答三個問題：看得到嗎、走得到嗎、點得到嗎。
// 用法：node tools/test/usability.mjs
import { withPage, report } from './harness.mjs';

const ok = await withPage(8831, async (page, errors) => {
  const result = await page.evaluate(async () => {
    const { store, ctx } = window.__act13;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));

    store.newGame('rehearsal');
    document.querySelector('.title-actions .btn--lead')?.click();
    await wait(200);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    await wait(400);

    // 把所有節點打開，讓每個互動點都處於可用狀態才能稽核
    ['P01', 'P02', 'P03', 'L01', 'L02', 'L03', 'L04', 'S01', 'S02', 'S03', 'S04',
      'M01', 'M02', 'M03', 'M04'].forEach((id) => store.complete(id));
    ['uv-lamp', 'red-filter', 'baton', 'half-photo', 'case-key', 'wand-tip', 'wand'].forEach((id) => store.addItem(id));
    ctx.world.sound.openCompartment();
    ctx.world.sound.revealMoonSigil();
    ctx.world.gallery.openFrame();
    ctx.world.automaton.openSide();
    ctx.world.stage.openNiche();
    ctx.world.stage.showPlates(true);
    await wait(150);

    const stub = await import('/tools/test/three-stub.js');
    const registry = ctx.interaction.list();

    // 玩家站得到的位置（0.3 m 網格）
    const spots = [];
    for (let x = -5.7; x <= 5.7; x += 0.3) {
      for (let z = -3.7; z <= 3.7; z += 0.3) {
        if (ctx.controls.canStand(x, z)) spots.push([x, z]);
      }
    }

    // 以 1920×1080、垂直視角 62° 估算螢幕上的像素大小
    const pxPerRad = 1080 / (62 * Math.PI / 180);

    const rows = registry.map((entry) => {
      const box = stub.worldBox(
        entry.object.isMesh ? entry.object
          : (entry.object.children.find((c) => c.isMesh && c.material?.visible !== false) || entry.object)
      );
      // 整個群組的合併範圍
      let min = [Infinity, Infinity, Infinity];
      let max = [-Infinity, -Infinity, -Infinity];
      const visit = (n) => {
        if (n.isMesh && n.geometry && n.material?.visible !== false && !n.userData.__hitProxy) {
          const b = stub.worldBox(n);
          for (let i = 0; i < 3; i++) {
            min[i] = Math.min(min[i], b.center[i] - b.half[i]);
            max[i] = Math.max(max[i], b.center[i] + b.half[i]);
          }
        }
        (n.children || []).forEach(visit);
      };
      visit(entry.object);
      if (!Number.isFinite(min[0])) { min = box.center.map((c, i) => c - box.half[i]); max = box.center.map((c, i) => c + box.half[i]); }

      const center = [0, 1, 2].map((i) => (min[i] + max[i]) / 2);
      const size = [0, 1, 2].map((i) => max[i] - min[i]);
      const dist = entry.opts.distance ?? 3.4;

      // 瞄準點：有隱形命中框就用它（那才是設計上要點的區域）
      let aim = center;
      const proxy = [];
      const findProxy = (n) => {
        if (n.userData?.__hitProxy) proxy.push(stub.worldBox(n).center);
        (n.children || []).forEach(findProxy);
      };
      findProxy(entry.object);
      if (proxy.length) aim = proxy[0];

      // 最近可站位置
      let best = Infinity;
      let bestSpot = null;
      for (const [x, z] of spots) {
        const d = Math.hypot(x - aim[0], 1.62 - aim[1], z - aim[2]);
        if (d < best) { best = d; bestSpot = [x, z]; }
      }

      // 在所有「觸及得到」的站位裡，最舒服的仰角是幾度
      let bestPitch = Infinity;
      let comfySpot = null;
      for (const [x, z] of spots) {
        const d3 = Math.hypot(x - aim[0], 1.62 - aim[1], z - aim[2]);
        if (d3 > dist) continue;
        const flat = Math.hypot(x - aim[0], z - aim[2]);
        const pitch = Math.abs(Math.atan2(aim[1] - 1.62, Math.max(flat, 0.25)) * 180 / Math.PI);
        if (pitch < bestPitch) { bestPitch = pitch; comfySpot = [x, z]; }
      }
      if (!Number.isFinite(bestPitch)) bestPitch = 90;

      // 在互動距離處的視角像素大小：取兩個較大的邊
      const sorted = size.slice().sort((a, b) => b - a);
      const viewDist = Math.max(0.6, Math.min(best, dist));
      const pxBig = 2 * Math.atan(sorted[0] / 2 / viewDist) * pxPerRad;
      const pxSmall = 2 * Math.atan(sorted[1] / 2 / viewDist) * pxPerRad;

      return {
        pitch: bestPitch,
        comfySpot: comfySpot ? comfySpot.map((v) => +v.toFixed(1)) : null,
        id: entry.opts.id || '(未命名)',
        label: typeof entry.opts.label === 'function' ? entry.opts.label() : entry.opts.label,
        hasHint: !!entry.opts.hint,
        height: aim[1],
        size: size.map((v) => +v.toFixed(2)),
        nearest: +best.toFixed(2),
        reach: best <= dist,
        distance: dist,
        pxBig: Math.round(pxBig),
        pxSmall: Math.round(pxSmall),
        spot: bestSpot ? bestSpot.map((v) => +v.toFixed(1)) : null
      };
    });

    return { rows, spots: spots.length };
  });

  const rows = result.rows;
  const checks = [];
  const add = (l, v, n = '') => checks.push([l, !!v, n]);

  // 排序後印出完整稽核表
  console.log(`\n可站立取樣點 ${result.spots} 個，互動點 ${rows.length} 個`);
  console.log('\nID                    標籤                最近距離  門檻  螢幕大小(px)  高度  仰角   判定');
  console.log('─'.repeat(102));
  for (const r of rows.sort((a, b) => a.pxSmall - b.pxSmall)) {
    const verdict = !r.reach ? '走不到' : r.pxSmall < 14 ? '太小' : r.pitch > 42 ? '要仰頭' : 'ok';
    console.log(
      `${r.id.padEnd(22)}${String(r.label || '').padEnd(18)}${String(r.nearest).padStart(7)}${String(r.distance).padStart(6)}` +
      `${String(r.pxBig + '×' + r.pxSmall).padStart(13)}${r.height.toFixed(2).padStart(7)}${(r.pitch.toFixed(0) + '°').padStart(6)}   ${verdict}`
    );
  }

  const unreachable = rows.filter((r) => !r.reach);
  const tooSmall = rows.filter((r) => r.reach && r.pxSmall < 14);
  const tooHigh = rows.filter((r) => r.pitch > 42);
  const noLabel = rows.filter((r) => !r.label);
  const noHint = rows.filter((r) => !r.hasHint);

  add('每個互動點都有可站立的位置可以觸及', unreachable.length === 0,
    unreachable.map((r) => `${r.id} 最近 ${r.nearest}m > 門檻 ${r.distance}m`).join('；') || '全部可觸及');
  add('每個互動點在螢幕上都夠大（短邊 ≥ 14px）', tooSmall.length === 0,
    tooSmall.map((r) => `${r.id} ${r.pxBig}×${r.pxSmall}px`).join('；') || '全部足夠');
  add('沒有互動點需要仰頭超過 42°', tooHigh.length === 0,
    tooHigh.map((r) => `${r.id} 仰角 ${r.pitch.toFixed(0)}°`).join('；') || '全部合理');
  add('每個互動點都有名稱', noLabel.length === 0, noLabel.map((r) => r.id).join('；') || '全部有');
  add('每個互動點都有操作提示', noHint.length === 0, noHint.map((r) => r.id).join('；') || '全部有');

  return report('可用性稽核', checks, errors);
});

process.exit(ok ? 0 : 1);
