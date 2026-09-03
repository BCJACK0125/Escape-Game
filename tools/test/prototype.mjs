// 原型頁測試：確認 WASD 移動、拖曳環顧、Raycaster 點擊與 alert 都正常。
import { withPage, report } from './harness.mjs';
import http from 'node:http';

const ok = await withPage(8761, async (page, errors) => {
  await page.goto('http://localhost:8761/prototype/index.html', { waitUntil: 'networkidle2' });
  await page.waitForFunction('window.__proto !== undefined', { timeout: 20000 });
  const alerts = [];
  page.on('dialog', async (d) => { alerts.push(d.message()); await d.dismiss(); });

  const checks = await page.evaluate(async () => {
    const p = window.__proto;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const out = [];
    const add = (l, v, n = '') => out.push([l, !!v, n]);

    add('場景建立完成', !!p.scene && p.clickable.length === 4, `可點擊物件 ${p.clickable.length}`);

    // WASD 前進
    const z0 = p.camera.position.z;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    await wait(500);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
    const moved = z0 - p.camera.position.z;
    add('W 會往前走', moved > 0.3, `前進 ${moved.toFixed(2)} m`);

    // 走進牆裡會被擋住
    for (let i = 0; i < 40; i++) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
      await wait(30);
    }
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
    add('不會穿牆或穿過自動機', p.camera.position.z > -4 && p.camera.position.z < 4);

    // 拖曳環顧
    const yaw0 = p.camera.rotation.y;
    const canvas = document.querySelector('canvas');
    canvas.dispatchEvent(new PointerEvent('pointerdown', { button: 0, clientX: 400, clientY: 300, bubbles: true }));
    for (let i = 1; i <= 6; i++) window.dispatchEvent(new PointerEvent('pointermove', { clientX: 400 + i * 20, clientY: 300, bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointerup', { button: 0, clientX: 520, clientY: 300, bubbles: true }));
    await wait(120);
    add('拖曳會改變視角', Math.abs(p.camera.rotation.y - yaw0) > 0.1, `Δyaw ${(p.camera.rotation.y - yaw0).toFixed(2)}`);
    return out;
  });

  // 走到聲音區方塊前面，正對它並點擊 → 應該跳 alert
  const fired = await page.evaluate(async () => {
    const p = window.__proto;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const sound = p.clickable.find((m) => m.userData.info.label === '聲音檔案區');
    p.camera.position.set(sound.position.x - 1.4, 1.62, sound.position.z);
    p.camera.rotation.set(0, -Math.PI / 2, 0, 'YXZ');
    // 替身 Raycaster 不做真實幾何求交，這裡直接給一次命中結果來驗證點擊路徑
    window.__stubHits = [{ object: sound, distance: 1.4 }];
    await wait(150);
    p.activate();
    await wait(200);
    const hovering = p.hovered === sound;
    window.__stubHits = [];
    return hovering;
  });

  await new Promise((r) => setTimeout(r, 300));
  checks.push(['準心對到方塊時會高亮並顯示名稱', fired]);
  checks.push(['點擊聲音區會彈出票根電話 alert', alerts.includes('你觸發了票根電話謎題'), alerts.join(' / ') || '沒有 alert']);
  return report('單一檔案原型', checks, errors);
});
process.exit(ok ? 0 : 1);
