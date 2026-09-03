// 螢幕搖桿與觸控互動測試。
// 用法：node tools/test/touch.mjs
import { withPage, report } from './harness.mjs';

const ok = await withPage(8801, async (page, errors) => {
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

    const touch = window.__act13.touch;
    add('觸控 UI 已建立', !!touch && !!document.getElementById('touch'));

    // 桌機預設應該收起
    add('滑鼠裝置預設不顯示搖桿', document.getElementById('touch').hidden);

    // 強制開啟
    touch.setVisible(true);
    await wait(100);
    const root = document.getElementById('touch');
    add('強制開啟後會顯示', !root.hidden && getComputedStyle(root).display !== 'none');
    add('開啟後準心歸回畫面中央', Math.abs(ctx.controls.pointerNDC.x) < 0.001);

    // 搖桿：往上推應該前進（-Z）
    const stick = document.querySelector('.stick');
    const rect = stick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    // 出生點朝西，所以要量「平面上的總位移」而不是單一軸
    const p0 = { x: ctx.camera.position.x, z: ctx.camera.position.z };
    const dir0 = ctx.camera.getWorldDirection(new ctx.THREE.Vector3());
    stick.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 31, clientX: cx, clientY: cy, bubbles: true }));
    stick.dispatchEvent(new PointerEvent('pointermove', { pointerId: 31, clientX: cx, clientY: cy - 60, bubbles: true }));
    await wait(600);
    const dx = ctx.camera.position.x - p0.x;
    const dz = ctx.camera.position.z - p0.z;
    const moved = Math.hypot(dx, dz);
    const alongView = (dx * dir0.x + dz * dir0.z) / (moved || 1);
    add('搖桿往上推會走動', moved > 0.4, `位移 ${moved.toFixed(2)} m`);
    add('走的方向與視線一致', alongView > 0.9, `方向一致度 ${alongView.toFixed(2)}`);

    // 放開後應該停下
    stick.dispatchEvent(new PointerEvent('pointerup', { pointerId: 31, clientX: cx, clientY: cy - 60, bubbles: true }));
    await wait(400);
    const s1 = { x: ctx.camera.position.x, z: ctx.camera.position.z };
    await wait(400);
    const drift = Math.hypot(ctx.camera.position.x - s1.x, ctx.camera.position.z - s1.z);
    add('放開搖桿會停下', drift < 0.02, `殘留 ${drift.toFixed(3)} m`);

    // 搖桿不該被當成「在 3D 畫面上拖曳視角」
    const yaw0 = ctx.controls.yaw;
    stick.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 32, clientX: cx, clientY: cy, bubbles: true }));
    stick.dispatchEvent(new PointerEvent('pointermove', { pointerId: 32, clientX: cx + 50, clientY: cy, bubbles: true }));
    await wait(150);
    add('操作搖桿不會轉動視角', Math.abs(ctx.controls.yaw - yaw0) < 0.001, `Δyaw ${(ctx.controls.yaw - yaw0).toFixed(3)}`);

    // 一邊推搖桿，一邊用另一根手指拖曳看四周（多點觸控）
    const canvas = document.getElementById('scene');
    canvas.dispatchEvent(new PointerEvent('pointerdown', { button: 0, pointerId: 33, clientX: 500, clientY: 300, bubbles: true }));
    for (let i = 1; i <= 5; i++) {
      window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 33, clientX: 500 + i * 16, clientY: 300, bubbles: true }));
    }
    await wait(100);
    add('可同時推搖桿與拖曳視角', Math.abs(ctx.controls.yaw - yaw0) > 0.1, `Δyaw ${(ctx.controls.yaw - yaw0).toFixed(3)}`);
    window.dispatchEvent(new PointerEvent('pointerup', { button: 0, pointerId: 33, clientX: 580, clientY: 300, bubbles: true }));
    stick.dispatchEvent(new PointerEvent('pointerup', { pointerId: 32, clientX: cx, clientY: cy, bubbles: true }));
    await wait(200);

    // 「互動」鈕：以畫面中央為準心觸發
    const entry = ctx.interaction.get('invitation');
    let fired = 0;
    const original = entry.opts.onClick;
    entry.opts.onClick = () => { fired++; };
    window.__stubHits = [{ object: entry.object, distance: 1.2, point: new ctx.THREE.Vector3() }];
    await wait(120);
    [...document.querySelectorAll('.touch-btn')].find((b) => /互動/.test(b.textContent))?.click();
    await wait(120);
    add('「互動」鈕會觸發準心處的機關', fired === 1, `觸發 ${fired} 次`);

    // 太遠時「互動」鈕也要有距離門檻
    window.__stubHits = [{ object: entry.object, distance: 9, point: new ctx.THREE.Vector3() }];
    await wait(120);
    [...document.querySelectorAll('.touch-btn')].find((b) => /互動/.test(b.textContent))?.click();
    await wait(120);
    add('「互動」鈕同樣受距離限制', fired === 1);
    entry.opts.onClick = original;
    window.__stubHits = [];

    // 面板開啟時搖桿要讓位
    ctx.game.trigger('P01');
    await wait(300);
    add('面板開啟時搖桿收起', root.classList.contains('is-dimmed') && root.style.pointerEvents === 'none');
    ctx.panel.close();
    await wait(400);
    add('面板關閉後搖桿回來', !root.classList.contains('is-dimmed'));

    // 亮度設定
    ctx.engine.setExposure(1.9);
    add('亮度設定會套用到 renderer', Math.abs(ctx.engine.exposure - 1.9) < 0.001, `曝光 ${ctx.engine.exposure}`);
    ctx.engine.setExposure(5);
    add('亮度有上限保護', ctx.engine.exposure <= 2.4);

    // 選單裡的滑桿與下拉
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
    await wait(300);
    const brightInput = [...document.querySelectorAll('#screen .setting input[type="range"]')][0];
    add('暫停選單有亮度滑桿', !!brightInput);
    if (brightInput) {
      brightInput.value = '1.6';
      brightInput.dispatchEvent(new Event('input', { bubbles: true }));
      await wait(60);
      add('拉動滑桿會即時改變曝光並存檔',
        Math.abs(ctx.engine.exposure - 1.6) < 0.001 && Math.abs(store.settings.brightness - 1.6) < 0.001,
        `曝光 ${ctx.engine.exposure}`);
    }
    const select = document.querySelector('#screen .setting select');
    add('暫停選單有螢幕搖桿選項', !!select);
    if (select) {
      select.value = 'off';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await wait(120);
      add('可從選單關閉螢幕搖桿', document.getElementById('touch').hidden && store.settings.touchControls === 'off');
    }

    return out;
  });
  return report('螢幕搖桿與亮度設定', checks, errors);
});

process.exit(ok ? 0 : 1);
