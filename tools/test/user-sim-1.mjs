// 玩家視角模擬 · 第一段：序幕（P01–P03）與光影線（L01–L05）
// 只用走路、拖曳視角、點擊與面板按鈕；不呼叫任何內部函式。
// 用法：node tools/test/user-sim-1.mjs
import { withPage, report } from './harness.mjs';

const ok = await withPage(8861, async (page, errors) => {
  const result = await page.evaluate(async () => {
    const sim = await (await import('/tools/test/sim-lib.js')).createSim();
    const { store, ctx, step, note, wait, goAndTap, targetOf, keypad, domClick, waitFor, objective } = sim;

    await sim.start();
    step('進入房間並跳過開場', !!ctx.world.room && !ctx.controls.frozen, `目標：「${objective()}」`);

    // ── P01 邀請函 ──
    let r = await goAndTap('invitation');
    step('走到長桌點開邀請函', r.ok && ctx.panel.id === 'P01', `準心對到 ${r.hovered}，走完剩 ${r.walkLeft} m`);
    for (const h of [...document.querySelectorAll('.letter-head')]) { h.click(); await wait(60); }
    await waitFor(() => store.isDone('P01'), 4000);
    step('依序讀出六個首字（P01）', store.isDone('P01'));
    await wait(1900);          // 等旁白與目標提示更新（設計上晚 1.4 秒出現）
    if (ctx.panel.isOpen) ctx.panel.close();
    await wait(300);

    // ── 燈繩：玩家回報過「找不到繩子」的那一關 ──
    const cord = targetOf('pull-cord');
    note(`燈繩瞄準點 y=${cord.aim[1].toFixed(2)} m，建議站位 (${cord.spot})`);
    step('讀完信後有明確的位置指引', /房間中央|吊燈/.test(objective()), `目標：「${objective()}」`);
    r = await goAndTap('pull-cord');
    step('走過去拉下舞台燈繩', r.ok && ctx.world.room.lampOn, `準心對到 ${r.hovered}，走完剩 ${r.walkLeft} m`);

    // ── P02 影子時鐘 ──
    r = await goAndTap('lamp-shade');
    step('點燈罩進入調整模式', r.ok, `準心對到 ${r.hovered}`);
    // 玩家的做法：一邊轉一邊看 HUD 的時間讀數，看到 03:1x 就停手
    const readClock = () => document.querySelector('.meter-value')?.textContent || '';
    let presses = 0;
    while (presses < 260 && !store.isDone('P02')) {
      if (/^03:1[0-9]$/.test(readClock())) { await wait(300); continue; }
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD' }));
      presses++;
      await wait(28);
    }
    await wait(900);
    step('轉燈罩把影子調到 03:15（P02）', store.isDone('P02'),
      `HUD 讀數 ${readClock()}，按了 ${presses} 次`);

    // ── P03 抽屜 ──
    r = await goAndTap('drawer-keypad');
    step('找到桌下的四位數鍵盤', r.ok && ctx.panel.id === 'P03', `準心對到 ${r.hovered}`);
    await keypad('1234');
    step('錯誤密碼會清除並給回饋', !store.isDone('P03'),
      document.querySelector('.panel-status')?.textContent || '');
    await keypad('0315');
    step('輸入 0315 打開抽屜並取得道具（P03）', store.isDone('P03') && store.hasItem('uv-lamp'));
    await wait(2400);
    if (ctx.panel.isOpen) ctx.panel.close();
    step('三面牆的工作燈亮起', ctx.world.room.workLights.L.intensity > 0);

    // ── L01 UV 海報 ──
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyU' }));
    await wait(200);
    step('按 U 打開 UV 燈', store.flag('uvOn') === true);
    for (const id of ['poster-0', 'poster-1', 'poster-2']) {
      r = await goAndTap(id);
      if (!r.ok) note(`${id} 準心對到 ${r.hovered}`);
    }
    step('用 UV 燈看完三張海報（L01）', store.isDone('L01'), `目標：「${objective()}」`);

    // ── L02 肖像閉眼 ──
    r = await goAndTap('portrait-1-left');
    step('順序錯的話三幅肖像會全部復原', !store.isDone('L02') && store.flag('portraitStep', 0) === 0);
    for (const id of ['portrait-0-left', 'portrait-1-right', 'portrait-2-both']) {
      r = await goAndTap(id);
      if (!r.ok) note(`${id} 準心對到 ${r.hovered}`);
      await wait(200);
    }
    step('依海報順序遮住三幅肖像（L02）', store.isDone('L02'));

    // ── L03 星圖 ──
    r = await goAndTap('one-way-mirror');
    step('點開單向鏡後的星圖', r.ok && ctx.panel.id === 'L03', `準心對到 ${r.hovered}`);
    for (const sheet of [...document.querySelectorAll('.chart-sheet')]) {
      const m = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(sheet.style.transform || '');
      const sx = m ? parseFloat(m[1]) : 0;
      const sy = m ? parseFloat(m[2]) : 0;
      const id = 900 + Math.random() * 90 | 0;
      sheet.dispatchEvent(new PointerEvent('pointerdown', { pointerId: id, clientX: 400, clientY: 300, bubbles: true }));
      sheet.dispatchEvent(new PointerEvent('pointermove', { pointerId: id, clientX: 400 - sx, clientY: 300 - sy, bubbles: true }));
      sheet.dispatchEvent(new PointerEvent('pointerup', { pointerId: id, clientX: 400 - sx, clientY: 300 - sy, bubbles: true }));
      await wait(180);
    }
    await waitFor(() => store.isDone('L03'), 4000);
    step('拖曳兩片透明片對上星圖（L03）', store.isDone('L03'));

    // ── L04 紅濾片 ──
    await waitFor(() => ctx.panel.id === 'L04', 3000);
    step('自動接到濾片面板', ctx.panel.id === 'L04', `目前面板 ${ctx.panel.id}`);
    domClick('.panel-actions .btn', (b) => /紅濾片/.test(b.textContent));
    await wait(400);
    step('蓋上紅濾片讀出 30/60/45（L04）', store.isDone('L04'));
    if (ctx.panel.isOpen) ctx.panel.close();
    await wait(300);

    // ── L05 稜鏡導光 ──
    for (const [id, n] of [['mirror-0', 2], ['mirror-1', 4], ['mirror-2', 3]]) {
      r = await goAndTap(id, n);
      if (!r.ok) note(`${id} 準心對到 ${r.hovered}`);
    }
    step('把三面鏡架轉成 30/60/45（L05）', store.isDone('L05'),
      `目前角度 ${ctx.world.gallery.angles.join('/')}`);
    r = await goAndTap('sun-sigil');
    step('取走太陽徽記', store.hasSigil('sun'), `準心對到 ${r.hovered}`);

    return { steps: sim.steps, log: sim.log, done: store.progress().done };
  });

  console.log(`\n第一段完成節點：${result.done} / 26`);
  if (result.log.length) console.log('過程備註：\n  ' + result.log.join('\n  '));
  return report('玩家視角模擬 · 序幕與光影線', result.steps, errors);
});
process.exit(ok ? 0 : 1);
