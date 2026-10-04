// 放映機與敘事系統：前導片、幕間字卡、林默手記、結局片、倒數旁白、卡關提醒。
// 用法：node tools/test/cinema.mjs
import { withPage, report } from './harness.mjs';

const ok = await withPage(8771, async (page, errors) => {
  const checks = await page.evaluate(async () => {
    const { store, ctx, cinema, journal } = window.__act13;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const out = [];
    const add = (l, v, n = '') => out.push([l, !!v, n]);

    // ── 每一部片在整條時間軸上都畫得出來（不丟例外）──
    const c = document.createElement('canvas');
    c.width = 640; c.height = 360;
    const g = c.getContext('2d');
    const { createPrelude, PRELUDE_DURATION } = await import('/js/cinema/prelude.js');
    let bad = null;
    for (const minutes of [60, 75, 0]) {
      const film = createPrelude({ minutes });
      for (let t = -0.1; t <= PRELUDE_DURATION + 0.1 && !bad; t += 0.25) {
        try { film.render(g, 640, 360, t); } catch (e) { bad = `${minutes} 分 t=${t.toFixed(2)}：${e.message}`; }
      }
    }
    add('前導片整條時間軸都能繪製（含負數與超出片長）', !bad, bad || `${PRELUDE_DURATION} 秒 × 三種時限`);
    // 直立手機尺寸
    bad = null;
    const pf = createPrelude({ minutes: 60 });
    for (let t = 0; t <= PRELUDE_DURATION && !bad; t += 0.5) {
      try { pf.render(g, 390, 844, t); } catch (e) { bad = e.message; }
    }
    add('直立手機尺寸也能繪製', !bad, bad || '');

    // ── 開新局：前導片先播，跳過後進房間 ──
    store.newGame('standard');
    document.querySelector('.title-actions .btn--lead')?.click();
    await wait(300);
    add('進入房間時先播前導片', cinema.active && !document.getElementById('film').hidden);
    add('前導片期間倒數不會走', store.state.elapsed === 0);
    add('前導片有看得見的「跳過」鈕', !!document.querySelector('#film .film-skip:not([hidden])'));
    await wait(700);
    document.querySelector('#film .film-skip').click();
    await wait(400);
    add('按「跳過」後前導片結束', !cinema.active);
    add('跳過後房間已建好', !!ctx.world.room && !!ctx.world.stage);
    add('跳過後玩家可以走動', !ctx.controls.frozen && ctx.controls.enabled);
    await wait(300);
    add('跳過後 HUD 出現', !document.getElementById('hud').hidden);
    add('第一個目標指向邀請函', /邀請函/.test(document.querySelector('.hud-objective')?.textContent || ''));
    const { ambience } = await import('/js/core/score.js');
    add('環境聲已啟動', !!ambience.bus);

    // ── 幕間字卡：暫停倒數、空白鍵可繼續 ──
    const p = cinema.interlude({ kicker: '第 一 幕', title: '三種真相', sub: '測試' });
    await wait(200);
    const e0 = store.state.elapsed;
    await wait(600);
    add('幕間字卡播放時倒數暫停', store.state.elapsed === e0);
    add('幕間字卡期間玩家被凍結', ctx.controls.frozen);
    await wait(900);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    const r = await Promise.race([p, wait(800).then(() => 'timeout')]);
    add('空白鍵可以讓字卡繼續', r !== 'timeout' && r.skipped);
    add('字卡結束後恢復可操作', !ctx.controls.frozen);

    // ── 林默手記：解鎖即存檔，安靜時自動播放，線索本可重看 ──
    ctx.panel.close();
    store.complete('P01'); store.complete('P02');
    ctx.hud.clearSubtitle();
    store.complete('P03');
    add('P03 完成即解鎖手記一', store.hasMemory('m1'));
    let popped = false;
    for (let i = 0; i < 40 && !popped; i++) { await wait(100); popped = cinema.active; }
    add('畫面安靜後自動播放手記', popped);
    await wait(1400);
    cinema.stop();
    journal.open('memo');
    await wait(150);
    const memo = document.querySelector('#panel-root .memo:not(.memo--locked)');
    add('線索本「手記」分頁列出已解鎖的頁', !!memo && /一九三七/.test(memo.textContent));
    add('未解鎖的頁顯示為空白頁', document.querySelectorAll('#panel-root .memo--locked').length === 5);
    memo?.querySelector('.memo-replay')?.click();
    await wait(200);
    add('可以「再看一次」', cinema.active);
    cinema.stop();
    await wait(200);

    // ── 徽記解鎖對應的手記 ──
    store.addSigil('moon');
    add('取得月亮徽記解鎖「手記 · 聲」', store.hasMemory('m3'));
    await wait(200);
    cinema.stop();

    // ── 存讀檔保留手記 ──
    store.persistNow();
    store.state.memories = [];
    store.load();
    add('讀檔後手記還在', store.hasMemory('m1') && store.hasMemory('m3'));

    // ── 卡關提醒 ──
    for (let i = 0; i < 30 && cinema.active; i++) { cinema.stop(); await wait(100); }
    store.state.elapsed += 250;     // 模擬四分多鐘沒有進展
    await wait(300);
    const hintBtn = document.querySelector('.hud-btn[data-role="hint"]');
    add('太久沒進展時提示鈕發光', hintBtn?.classList.contains('is-nudge'));
    journal.open('hints');
    await wait(100);
    add('打開排練備忘後不再發光', !hintBtn?.classList.contains('is-nudge'));
    ctx.panel.close();

    // ── 清場倒數旁白 ──
    for (let i = 0; i < 30 && cinema.active; i++) { cinema.stop(); await wait(100); }
    store.state.elapsed = store.state.limit - 1795;   // 剛過 30 分鐘門檻
    await wait(300);
    add('剩 30 分鐘時有旁白', /三十分鐘/.test((document.querySelector('.hud-subtitle')?.textContent || '') + (document.querySelector('.hud-toasts')?.textContent || '')));
    add('計時器閃紅提醒', document.querySelector('.hud-timer')?.classList.contains('is-warn'));

    // ── 機關操作列：燈罩與靜默感測都有看得見的出口 ──
    ctx.world.room.setLampOn(true);
    store.state.done = { P01: 1 };
    ctx.game.trigger('P02');
    await wait(150);
    const bar = document.querySelector('.hud-modebar');
    add('調整燈罩時出現操作列', bar && !bar.hidden && bar.querySelectorAll('.mode-key').length === 3);
    const before = ctx.world.room.shadeAngle;
    const cw = bar.querySelector('[data-id="cw"]');
    cw.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 9 }));
    await wait(400);
    cw.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 9 }));
    await wait(300);
    add('按住 ▶ 會持續轉動燈罩', ctx.world.room.shadeAngle > before + 0.03, `${(ctx.world.room.shadeAngle - before).toFixed(3)} rad`);
    bar.querySelector('[data-id="exit"]').click();
    await wait(100);
    add('「退開」離開調整模式', !document.body.classList.contains('mode-adjust') && bar.hidden);

    ['P01', 'P02', 'P03', 'S01', 'S02', 'S03'].forEach((id) => store.complete(id));
    ctx.game.trigger('S04');
    await wait(150);
    add('靜默感測時出現「麥克風／離開」', bar.querySelector('[data-id="mic"]') && bar.querySelector('[data-id="exit"]'));
    bar.querySelector('[data-id="exit"]').click();
    await wait(100);
    add('「離開」結束靜默感測', !document.body.classList.contains('mode-silence'));

    // ── 結局片：謝幕後先播尾聲，再給結局卡 ──
    for (let i = 0; i < 30 && cinema.active; i++) { cinema.stop(); await wait(100); }
    store.state.limit = 0;
    ['P01','P02','P03','L01','L02','L03','L04','L05','S01','S02','S03','S04','S05','M01','M02','M03','M04','M05','G01','G02','G03','G04','G05','F01','F02'].forEach((id) => store.complete(id));
    store.setFlag('ending', 'reveal');
    for (let i = 0; i < 30 && cinema.active; i++) { cinema.stop(); await wait(100); }
    ctx.game.trigger('F03', { rope: 0 });
    ctx.game.trigger('F03', { rope: 1 });
    let endingFilm = false;
    for (let i = 0; i < 120 && !endingFilm; i++) {
      await wait(100);
      endingFilm = cinema.active && /尾聲|揭幕/.test(document.querySelector('.film-caption')?.textContent || '');
    }
    add('謝幕後播放尾聲片', endingFilm);
    add('尾聲片播放時結局卡還沒出現', !/再演一次/.test(document.getElementById('screen')?.textContent || ''));
    document.querySelector('#film .film-skip').click();
    await wait(1800);
    document.querySelector('#film .film-skip')?.click();
    await wait(800);
    add('跳過尾聲後出現結局卡', /揭幕/.test(document.getElementById('screen')?.textContent || ''));

    return out;
  });
  return report('放映機與敘事系統', checks, errors);
});

process.exit(ok ? 0 : 1);
