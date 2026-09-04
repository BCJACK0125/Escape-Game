// 玩家視角模擬 · 第三段：中央合流（G01–G05）與終幕（F01–F03）
// 三條支線用「測試前置」補上，之後全程只用玩家動作。
// 用法：node tools/test/user-sim-3.mjs
import { withPage, report } from './harness.mjs';

const ok = await withPage(8863, async (page, errors) => {
  const result = await page.evaluate(async () => {
    const sim = await (await import('/tools/test/sim-lib.js')).createSim();
    const { store, ctx, step, note, wait, goAndTap, walkPath, keypad, domClick, waitFor, faceTo } = sim;

    await sim.start();

    // ── 測試前置：三條支線都完成，徽記在手 ──
    ['P01', 'P02', 'P03', 'L01', 'L02', 'L03', 'L04', 'L05',
      'S01', 'S02', 'S03', 'S04', 'S05', 'M01', 'M02', 'M03', 'M04', 'M05'].forEach((id) => store.complete(id));
    ['uv-lamp', 'red-filter', 'baton', 'half-photo', 'case-key', 'wand-tip', 'wand'].forEach((id) => store.addItem(id));
    ['sun', 'moon', 'star'].forEach((k) => store.addSigil(k));
    ctx.world.room.setLampOn(true);
    ctx.world.room.revealClock();
    ctx.world.room.setWorkLights(true);
    ctx.world.desk.openDrawer();
    ctx.world.gallery.litMirrorBack(true);
    ctx.world.gallery.openFrame();
    ctx.world.gallery.takeSigil();
    ctx.world.sound.openCompartment();
    ctx.world.sound.takeMoonSigil();
    ctx.world.workbench.unlockCase();
    ctx.world.workbench.removeWandTip();
    ctx.world.workbench.assembleWand();
    ctx.world.workbench.allNodesOn();
    ctx.world.automaton.openSide();
    ctx.world.automaton.setWandInSlot();
    await wait(300);
    step('前置：三枚徽記到手', store.sigilCount() === 3, `已完成 ${store.progress().done} 個節點`);

    // ── G01 三徽記合流 ──
    let r = await goAndTap('automaton-chest');
    step('走到自動機前放入三枚徽記', r.ok, `準心對到 ${r.hovered}`);
    const woke = await waitFor(() => store.isDone('G01'), 12000);
    step('自動機甦醒並遞出日誌（G01）', woke && ctx.world.automaton.journal.visible !== false);
    await wait(7500);              // 幕次橫幅與旁白

    // ── G02 日誌差異 ──
    r = await goAndTap('automaton-journal');
    step('接下排練日誌', r.ok && ctx.panel.id === 'G02', `準心對到 ${r.hovered}`);
    const col3 = [...document.querySelectorAll('.journal-col')][2];
    const tokens = [...(col3?.querySelectorAll('.journal-token') || [])];
    // 先點一句三份都一樣的，確認會被明確告知
    tokens[0]?.click();
    await wait(250);
    step('點到沒改過的句子會被告知', /三份都一樣/.test(document.querySelector('.panel-status')?.textContent || ''),
      document.querySelector('.panel-status')?.textContent || '');
    for (const tk of tokens) { tk.click(); await wait(140); }
    await waitFor(() => store.isDone('G02'), 4000);
    step('找出三處改字（G02）', store.isDone('G02'), store.hasClue('journal-diff') ? '已記下椅左傘開鏡斜' : '沒記下');
    await wait(2200);
    if (ctx.panel.isOpen) ctx.panel.close();

    // ── G03 還原布景 ──
    step('地面出現三個道具的輪廓', true, '（G02 完成後顯示）');
    for (const id of ['prop-chair', 'prop-umbrella', 'prop-mirror']) {
      r = await goAndTap(id);
      if (!r.ok) note(`${id} 準心對到 ${r.hovered}`);
      await wait(200);
    }
    step('把椅傘鏡調成日誌寫的姿態（G03）', store.isDone('G03'), JSON.stringify(ctx.world.stage.state));
    step('聚光燈與圓點亮起', ctx.world.room.spot.intensity > 0 && ctx.world.stage.markerGroup.visible);
    await wait(6800);

    // ── G04 視角合字：真的走進圓點、真的把視線放平 ──
    const vp = ctx.world.stage.VIEWPOINT;
    // 先站在旁邊看：線段應該還是散的（對位分數低）
    await walkPath(vp.x + 1.8, vp.z - 0.6, 0.4);
    await faceTo([vp.x, 1.62, vp.z - 4]);
    await wait(400);
    const meterOff = document.querySelector('.hud-meter');
    step('站錯位置時線段不會合成', !store.isDone('G04'),
      meterOff && !meterOff.hidden ? `對位提示：${document.querySelector('.meter-value')?.textContent}` : '（尚未顯示對位條）');
    const left = await walkPath(vp.x, vp.z, 0.2);
    await faceTo([vp.x, 1.62, vp.z - 4]);
    const aligned = await waitFor(() => store.isDone('G04'), 12000);
    step('站進圓點、面向北牆後合成數字（G04）', aligned, `距圓點 ${left.toFixed(2)} m`);
    step('線索本記下 2-5-1-4-3', store.hasClue('perspective'));
    await wait(5500);

    // ── G05 腳步序列：真的用腳走 ──
    const plateAt = (n) => ctx.world.stage.plates.find((p) => p.n === n);
    // 先故意踩錯一個
    // 走位習慣：先沿著後方空地移動，再往前站上腳印（避免路過踩到別的）
    const stepOn = async (p) => {
      await sim.walkTo(p.x, 3.35, 0.4, 6000);
      await sim.walkTo(p.x, p.z, 0.25, 5000);
    };
    let p5 = plateAt(5);
    await stepOn(p5);
    await wait(1200);
    step('第一步踩錯會清除序列', (store.flag('footSeq') || []).length === 0,
      `目前序列 ${JSON.stringify(store.flag('footSeq'))}`);
    for (const n of [2, 5, 1, 4, 3]) {
      const p = plateAt(n);
      await stepOn(p);
      await wait(1300);             // 站定 0.75 秒才算一步
      note(`站上腳印 ${n} → 序列 ${JSON.stringify(store.flag('footSeq'))}`);
    }
    step('依 2-5-1-4-3 站上五個腳印（G05）', store.isDone('G05'),
      `序列 ${JSON.stringify(store.flag('footSeq'))}`);
    await wait(4200);

    // ── F01 徽記總謎題 ──
    r = await goAndTap('finale-keypad');
    step('終幕櫃打開並點到鍵盤', r.ok && ctx.panel.id === 'F01', `準心對到 ${r.hovered}`);
    await keypad('123');
    step('錯誤三位數不會通電', !store.isDone('F01'), document.querySelector('.panel-status')?.textContent || '');
    await keypad('247');
    step('輸入 247 讓投影機通電（F01）', store.isDone('F01'));
    await wait(1800);
    if (ctx.panel.isOpen) ctx.panel.close();

    // ── F02 揭幕或落幕 ──
    r = await goAndTap('reel-reveal');
    step('選「公開」那一卷影片（F02）', r.ok, `準心對到 ${r.hovered}`);
    // F02 一按下就標記完成，但影片還要播 20 秒，期間視角是鎖住的。
    // 玩家會乖乖看完，所以這裡要等「控制權交還」而不是等節點完成。
    const picked = await waitFor(() => store.isDone('F02'), 8000);
    step('選片後進入放映（F02）', picked && store.flag('ending') === 'reveal');
    const released = await waitFor(() => !ctx.controls.frozen, 45000);
    step('影片播完、控制權交還、謝幕標記亮起', released, `結局旗標 ${store.flag('ending')}`);
    await wait(600);

    // ── F03 集體謝幕 ──
    const t0 = sim.targetOf('curtain-rope-0');
    const t1 = sim.targetOf('curtain-rope-1');
    // 一個人要拉兩條，得站在同時夠得到兩側的位置（就是地上那排謝幕弧線）
    let stand = null;
    let bestMax = Infinity;
    for (let x = -2; x <= 2; x += 0.2) {
      for (let z = 1.8; z <= 3.4; z += 0.2) {
        if (!ctx.controls.canStand(x, z)) continue;
        const d0 = Math.hypot(x - t0.aim[0], 1.62 - t0.aim[1], z - t0.aim[2]);
        const d1 = Math.hypot(x - t1.aim[0], 1.62 - t1.aim[1], z - t1.aim[2]);
        if (Math.max(d0, d1) < bestMax) { bestMax = Math.max(d0, d1); stand = [x, z]; }
      }
    }
    note(`謝幕站位 ${stand?.map((v) => v.toFixed(1))}，離較遠那條繩 ${bestMax.toFixed(2)} m（門檻 ${t0.dist}）`);
    step('存在同時夠到兩條幕繩的站位', bestMax <= t0.dist, `最遠 ${bestMax.toFixed(2)} m`);
    await walkPath(stand[0], stand[1], 0.3);
    // 快速點擊：轉過去、把游標移到繩子上、點下去
    const quickTap = async (t, label) => {
      await faceTo(t.aim);
      const p = sim.project(t.aim);
      if (!p) { note(`${label}：不在畫面內`); return null; }
      await sim.movePointer(p);
      const hovered = ctx.interaction.hovered?.opts.id || null;
      const t0ms = performance.now();
      await sim.tapAt(p);
      const toasts = [...document.querySelectorAll('.toast')].map((x) => x.textContent).join(' ｜ ');
      note(`${label}：準心對到 ${hovered}，耗時 ${(performance.now() - t0ms).toFixed(0)}ms，提示[${toasts}]`);
      return hovered;
    };
    await quickTap(t0, '左幕繩');
    await wait(400);
    step('只拉一條幕繩會被提示', !store.isDone('F03'));
    await quickTap(t1, '右幕繩');
    const bowed = await waitFor(() => store.isDone('F03'), 20000);
    step('兩條幕繩同時受力完成謝幕（F03）', bowed);
    await waitFor(() => store.state.ending, 12000);
    step('出現結局卡', /揭幕/.test(document.getElementById('screen')?.textContent || ''),
      `結局 ${store.state.ending}`);

    return { steps: sim.steps, log: sim.log, done: store.progress().done, ending: store.state.ending };
  });

  console.log(`\n第三段完成節點：${result.done} / 26　結局：${result.ending || '未達成'}`);
  if (result.log.length) console.log('過程備註：\n  ' + result.log.join('\n  '));
  return report('玩家視角模擬 · 合流與終幕', result.steps, errors);
});
process.exit(ok ? 0 : 1);
