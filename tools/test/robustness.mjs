// 韌性測試：錯誤輸入、前置鎖、Raycaster 點擊、存讀檔、倒數結束、第二結局。
// 用法：node tools/test/robustness.mjs
import { withPage, report } from './harness.mjs';

const ok = await withPage(8741, async (page, errors) => {
  const checks = await page.evaluate(async () => {
    const { store, ctx } = window.__act13;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const out = [];
    const add = (label, pass, note = '') => out.push([label, !!pass, note]);

    store.newGame('standard');
    document.querySelector('.title-actions .btn--lead')?.click();
    await wait(200);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));   // 跳過開場旁白
    await wait(400);
    add('開場旁白可跳過', !ctx.controls.frozen);

    // ── 前置鎖：沒完成前置就觸發，應該只給角色化回應，不改變狀態 ──
    ctx.game.trigger('L02', { portrait: 0, cover: 'left' });
    add('未解鎖節點不會誤判完成', !store.isDone('L02'));
    ctx.game.trigger('S03', { rope: 0 });
    add('鐘繩在沒有音序時仍可拉響但不記分', !store.isDone('S03'));

    // ── 錯誤輸入：邀請函順序錯了要清除 ──
    ctx.game.trigger('P01');
    await wait(120);
    const heads = [...document.querySelectorAll('.letter-head')];
    add('邀請函有六個首字', heads.length === 6, `實際 ${heads.length}`);
    heads[3]?.click();                       // 先點第四行 → 應被拒
    add('首字亂序不會被接受', !store.isDone('P01'));
    heads.forEach((h) => h.click());         // 依序點完
    await wait(1600);
    add('首字依序點完可完成 P01', store.isDone('P01'));
    ctx.panel.close();

    // ── 鍵盤錯碼 ──
    ctx.game.trigger('P01-cord');                 // 拉燈繩點亮吊燈
    add('拉燈繩會點亮吊燈', ctx.world.room.lampOn);
    ctx.game.trigger('P02');                      // 進入燈罩調整模式
    ctx.world.room.setShadeAngle((3.25 / 12) * Math.PI * 2);
    await wait(1500);
    add('影子時鐘停在 03:15 即通過', store.isDone('P02'));
    ctx.game.trigger('P03');
    await wait(120);
    const press = (code) => {
      for (const ch of code) [...document.querySelectorAll('.keypad-key')].find((b) => b.textContent === ch)?.click();
    };
    press('1234');
    await wait(400);
    add('錯誤密碼不會開抽屜', !store.isDone('P03'));
    add('錯誤密碼有明確回饋', /沒有反應|紅燈/.test(document.querySelector('.panel-status')?.textContent || ''));
    press('0315');
    await wait(500);
    add('正確密碼開抽屜並發道具', store.isDone('P03') && store.hasItem('uv-lamp'));
    await wait(1800);
    ctx.panel.close();

    // ── Raycaster 互動路徑（hover → 提示 → 點擊觸發）──
    const entry = ctx.interaction.get('invitation');
    add('互動點有被註冊', !!entry);
    window.__stubHits = [{ object: entry.object, distance: 1.2, point: new ctx.THREE.Vector3() }];
    await wait(120);
    const prompt = document.querySelector('.hud-prompt');
    add('看著物件時顯示名稱', prompt && !prompt.hidden && /邀請函/.test(prompt.textContent));
    let fired = 0;
    const original = entry.opts.onClick;
    entry.opts.onClick = () => { fired++; };
    const canvas = document.getElementById('scene');
    canvas.dispatchEvent(new PointerEvent('pointerdown', { button: 0, clientX: 400, clientY: 300, bubbles: true, pointerId: 1 }));
    window.dispatchEvent(new PointerEvent('pointerup', { button: 0, clientX: 401, clientY: 300, bubbles: true, pointerId: 1 }));
    await wait(60);
    add('點擊會觸發互動', fired === 1, `觸發 ${fired} 次`);
    // 距離門檻
    window.__stubHits = [{ object: entry.object, distance: 9, point: new ctx.THREE.Vector3() }];
    await wait(120);
    canvas.dispatchEvent(new PointerEvent('pointerdown', { button: 0, clientX: 400, clientY: 300, bubbles: true, pointerId: 2 }));
    window.dispatchEvent(new PointerEvent('pointerup', { button: 0, clientX: 400, clientY: 300, bubbles: true, pointerId: 2 }));
    await wait(60);
    add('太遠時不會觸發', fired === 1);
    add('太遠時顯示走近提示', /走近/.test(document.querySelector('.hud-prompt')?.textContent || ''));
    entry.opts.onClick = original;
    window.__stubHits = [];

    // ── 拖曳看四周不應被當成點擊 ──
    let dragFired = 0;
    window.__stubHits = [{ object: entry.object, distance: 1.2, point: new ctx.THREE.Vector3() }];
    entry.opts.onClick = () => { dragFired++; };
    await wait(80);
    canvas.dispatchEvent(new PointerEvent('pointerdown', { button: 0, clientX: 300, clientY: 300, bubbles: true, pointerId: 3 }));
    for (let i = 0; i < 8; i++) window.dispatchEvent(new PointerEvent('pointermove', { buttons: 1, clientX: 300 + i * 12, clientY: 300, bubbles: true, pointerId: 3 }));
    window.dispatchEvent(new PointerEvent('pointerup', { button: 0, clientX: 396, clientY: 300, bubbles: true, pointerId: 3 }));
    await wait(60);
    add('拖曳環顧不會誤觸物件', dragFired === 0, `觸發 ${dragFired} 次`);
    entry.opts.onClick = original;
    window.__stubHits = [];

    // ── 鐘繩錯誤序列會清除且不鎖死 ──
    store.complete('S01'); store.complete('S02');
    ctx.game.trigger('S03', { rope: 0 });      // 應為 4 → 錯
    add('鐘繩拉錯會清除輸入', (store.flag('bellInput') || []).length === 0);
    [4, 2, 5, 1, 3].forEach((n) => ctx.game.trigger('S03', { rope: n - 1 }));
    add('清除後仍可正常解開', store.isDone('S03'));

    // ── 存檔／讀檔 ──
    store.persistNow();
    const before = store.progress().done;
    const raw = localStorage.getItem('act13:save:v1');
    add('存檔已寫入 localStorage', !!raw && JSON.parse(raw).done.S03);
    store.state.done = {};
    store.load();
    add('讀檔還原節點進度', store.progress().done === before, `${store.progress().done} / ${before}`);

    // ── 提示階梯 ──
    const active = store.activeNodes()[0];
    const h1 = store.useHint(active.id);
    const h2 = store.useHint(active.id);
    add('提示分級且不重複', h1.level === 1 && h2.level === 2 && h1.text !== h2.text);

    // ── 倒數結束 ──
    store.state.elapsed = store.state.limit - 0.05;
    await wait(400);
    add('時間到會結束該場', store.state.finished && store.state.ending === 'timeout');
    await wait(3000);
    add('顯示抹除結局畫面', /抹除/.test(document.getElementById('screen')?.textContent || ''));

    // ── 第二結局（落幕）──
    document.querySelector('#screen .btn--ghost')?.click();   // 繼續留在房間（無時限）
    await wait(300);
    add('可切換為排練模式繼續', store.state.limit === 0 && !store.state.finished);
    ['P01','P02','P03','L01','L02','L03','L04','L05','S01','S02','S03','S04','S05','M01','M02','M03','M04','M05','G01','G02','G03','G04','G05','F01'].forEach((id) => store.complete(id));
    ['sun','moon','star'].forEach((s) => store.addSigil(s));
    ctx.game.trigger('F02', { reel: 'protect' });
    await wait(21000);
    add('第二結局（保護）可完成', store.isDone('F02') && store.flag('ending') === 'protect');
    ctx.game.trigger('F03', { rope: 0 });
    ctx.game.trigger('F03', { rope: 1 });
    await wait(9000);
    add('謝幕後給出落幕結局卡', store.state.ending === 'protect' && /落幕/.test(document.getElementById('screen')?.textContent || ''));

    return out;
  });
  return report('韌性測試', checks, errors);
});

process.exit(ok ? 0 : 1);
