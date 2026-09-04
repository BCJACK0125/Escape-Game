// 玩家視角模擬 · 第二段：聲音線（S01–S05）與物理線（M01–M05）
// 序幕的部分用「測試前置」直接補上，之後全程只用玩家動作。
// 用法：node tools/test/user-sim-2.mjs
import { withPage, report } from './harness.mjs';

const ok = await withPage(8862, async (page, errors) => {
  const result = await page.evaluate(async () => {
    const sim = await (await import('/tools/test/sim-lib.js')).createSim();
    const { store, ctx, step, note, wait, goAndTap, domClick, sortList, waitFor } = sim;

    await sim.start();
    // 測試前置：把序幕的結果補上（含畫面狀態）
    ['P01', 'P02', 'P03'].forEach((id) => store.complete(id));
    ['uv-lamp', 'red-filter', 'baton', 'half-photo'].forEach((id) => store.addItem(id));
    ctx.world.room.setLampOn(true);
    ctx.world.room.revealClock();
    ctx.world.room.setWorkLights(true);
    ctx.world.desk.openDrawer();
    await wait(300);
    step('前置：序幕已完成、三面牆亮燈', store.isDone('P03') && ctx.world.room.workLights.S.intensity > 0);

    // ── S01 票根電話 ──
    let r = await goAndTap('ticket-stubs', 1, ['phone']);   // 票根就放在電話旁，兩者都通往 S01
    step('走到東牆拿起票根', r.ok && ctx.panel.id === 'S01', `準心對到 ${r.hovered}`);
    // 錯誤順序先試一次
    domClick('.panel-actions .btn', (b) => /照這個順序/.test(b.textContent));
    await wait(300);
    step('票根順序錯會被退回', !document.querySelector('.dial'),
      document.querySelector('.panel-status')?.textContent || '');
    for (const i of [0, 1, 2]) {
      document.querySelectorAll('.order-item')[i]
        ?.querySelector('.order-arrows .arrow-btn:last-child')?.click();
      await wait(140);
    }
    domClick('.panel-actions .btn', (b) => /照這個順序/.test(b.textContent));
    await wait(400);
    step('依日期排好後出現轉盤', !!document.querySelector('.dial'));
    for (const d of '4172') {
      domClick('.dial-hole', (b) => b.textContent === d);
      await wait(1150);
    }
    await waitFor(() => store.isDone('S01'), 22000);
    step('撥號 4172 聽完留言（S01）', store.isDone('S01'), `線索 ${store.state.clues.length} 條`);

    // ── S02 聲紋唱片 ──
    r = await goAndTap('gramophone');
    step('點開聲紋唱機', r.ok && ctx.panel.id === 'S02', `準心對到 ${r.hovered}`);
    await sortList(['唱片 乙', '唱片 戊', '唱片 丁', '唱片 丙', '唱片 甲']);
    domClick('.panel-actions .btn', (b) => /放上唱盤/.test(b.textContent));
    await wait(600);
    step('五張唱片依年齡排序（S02）', store.isDone('S02'),
      store.hasClue('bell-order') ? '已記下 4-2-5-1-3' : '沒記下鐘繩順序');
    await wait(2300);
    if (ctx.panel.isOpen) ctx.panel.close();

    // ── S03 五條鐘繩 ──
    r = await goAndTap('rope-0');                    // 第一條應為 4，故意拉錯
    step('鐘繩拉錯會清除輸入', (store.flag('bellInput') || []).length === 0, `準心對到 ${r.hovered}`);
    r = await goAndTap('bell-replay');
    step('可以重播音序', r.ok, `準心對到 ${r.hovered}`);
    await wait(3600);
    for (const idx of [3, 1, 4, 0, 2]) {             // 4-2-5-1-3
      r = await goAndTap(`rope-${idx}`);
      if (!r.ok) note(`rope-${idx} 準心對到 ${r.hovered}`);
    }
    await waitFor(() => store.isDone('S03'), 4000);
    step('依 4-2-5-1-3 拉五條鐘繩（S03）', store.isDone('S03'));
    await wait(2000);

    // ── S04 靜默 ──
    r = await goAndTap('ear-sculpture');
    step('點耳朵雕塑進入聆聽模式', r.ok, `準心對到 ${r.hovered}`);
    const litBefore = ctx.world.sound.ledSegments.filter((s2) => s2.material.emissiveIntensity > 1).length;
    await wait(2500);
    const litMid = ctx.world.sound.ledSegments.filter((s2) => s2.material.emissiveIntensity > 1).length;
    step('不動時 LED 環會逐格亮起', litMid > litBefore, `${litBefore} → ${litMid} / 12 格`);
    // 故意動一下：走動期間進度應該立刻停止累積並開始退回
    const before = ctx.world.sound.ledSegments.filter((s2) => s2.material.emissiveIntensity > 1).length;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    await wait(1400);
    const litAfterMove = ctx.world.sound.ledSegments.filter((s2) => s2.material.emissiveIntensity > 1).length;
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
    step('走動時進度會停止並退回', litAfterMove <= before, `${before} → ${litAfterMove} / 12 格`);
    await wait(600);
    const filled = await waitFor(() => store.isDone('S04'), 16000);
    step('維持不動 8 秒讓 LED 填滿（S04）', filled);

    // ── S05 月之留言 ──
    r = await goAndTap('mini-gramophone');
    step('播放暗格裡的留聲機', r.ok, `準心對到 ${r.hovered}`);
    await waitFor(() => store.isDone('S05'), 22000);
    step('完整聽完證詞（S05）', store.isDone('S05'));
    r = await goAndTap('moon-sigil');
    step('取走月亮徽記', store.hasSigil('moon'), `準心對到 ${r.hovered}`);

    // ── M01 天平 ──
    r = await goAndTap('rehearsal-sheet');
    step('讀牆上的排練單', store.hasClue('balance-sheet'), `準心對到 ${r.hovered}`);
    r = await goAndTap('balance');
    step('點開道具天平', r.ok && ctx.panel.id === 'M01', `準心對到 ${r.hovered}`);
    const chip = (name, times) => {
      for (let i = 0; i < times; i++) {
        [...document.querySelectorAll('.chip')].find((c) => c.textContent.startsWith(name))?.click();
      }
    };
    chip('兔', 1);
    await wait(100);
    chip('帽', 2);
    await wait(100);
    chip('硬幣', 2);
    await wait(2700);
    step('讓天平平衡兩秒（M01）', store.isDone('M01') && store.hasItem('case-key'),
      document.querySelector('.balance-readout')?.textContent || '');
    if (ctx.panel.isOpen) ctx.panel.close();
    await wait(1800);

    // ── M02 磁取杖尖：真的把磁鐵沿縫隙帶過去 ──
    r = await goAndTap('glass-case');
    step('點開玻璃櫃的磁鐵機關', r.ok && ctx.panel.id === 'M02', `準心對到 ${r.hovered}`);
    const { MAZE } = await import('/js/puzzles/physical.js');
    const maze = document.querySelector('canvas.maze');
    if (maze) {
      let S = null;
      let E = null;
      MAZE.forEach((row, rr) => [...row].forEach((c, q) => {
        if (c === 'S') S = [q, rr];
        if (c === 'E') E = [q, rr];
      }));
      const prev = new Map();
      const seen = new Set([S.join()]);
      const queue = [S];
      while (queue.length) {
        const cur = queue.shift();
        if (cur[0] === E[0] && cur[1] === E[1]) break;
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = [cur[0] + dc, cur[1] + dr];
          if (MAZE[n[1]]?.[n[0]] === undefined || MAZE[n[1]][n[0]] === '#' || seen.has(n.join())) continue;
          seen.add(n.join());
          prev.set(n.join(), cur);
          queue.push(n);
        }
      }
      const path = [];
      let cur = E;
      while (cur) { path.unshift(cur); cur = prev.get(cur.join()); }
      note(`迷宮解出 ${path.length} 格路徑`);
      const rect = maze.getBoundingClientRect();
      const cellPx = rect.width / MAZE.length;
      let prevPt = null;
      for (const [c, rr] of path) {
        const px = rect.left + (c + 0.5) * cellPx;
        const py = rect.top + (rr + 0.5) * cellPx;
        // 磁鐵要慢慢移（約 60 px/s），杖尖才追得上；太快就會脫離磁場
        for (let k = 1; k <= 6; k++) {
          const x = prevPt ? prevPt[0] + ((px - prevPt[0]) * k) / 6 : px;
          const y = prevPt ? prevPt[1] + ((py - prevPt[1]) * k) / 6 : py;
          maze.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true }));
          await wait(75);
        }
        prevPt = [px, py];
        if (store.hasItem('wand-tip')) break;
      }
      await wait(500);
    }
    step('用磁鐵把杖尖帶到出口（M02）', store.hasItem('wand-tip'), maze ? '' : '找不到迷宮畫布');
    if (ctx.panel.isOpen) ctx.panel.close();
    await wait(1700);

    // ── M03 組裝魔杖 ──
    r = await goAndTap('wand-parts');
    step('點開三段魔杖', r.ok && ctx.panel.id === 'M03', `準心對到 ${r.hovered}`);
    for (let round = 0; round < 6 && !store.hasItem('wand'); round++) {
      for (const seg of [...document.querySelectorAll('.wand-seg')]) {
        if (!seg.classList.contains('is-aligned')) seg.click();
        await wait(70);
      }
    }
    await wait(2300);
    step('轉到木紋接成一條線（M03）', store.hasItem('wand'),
      store.hasClue('wand-directions') ? '已讀出北東南西' : '沒有讀出方向');
    if (ctx.panel.isOpen) ctx.panel.close();

    // ── M04 感測牆 ──
    r = await goAndTap('constellation-1');           // 第一個應為北，故意先碰東
    step('方位順序錯會清除', (store.flag('wandSeq') || []).length === 0, `準心對到 ${r.hovered}`);
    for (const id of ['constellation-0', 'constellation-1', 'constellation-2', 'constellation-3']) {
      r = await goAndTap(id);
      if (!r.ok) note(`${id} 準心對到 ${r.hovered}`);
    }
    step('依北東南西碰觸四個節點（M04）', store.isDone('M04'));

    // ── M05 星之核心 ──
    r = await goAndTap('automaton-side');
    step('把魔杖放進自動機側腹（M05）', store.hasSigil('star'), `準心對到 ${r.hovered}`);

    return { steps: sim.steps, log: sim.log, done: store.progress().done, sigils: Object.keys(store.state.sigils) };
  });

  console.log(`\n第二段完成節點：${result.done} / 26　徽記：${result.sigils.join('、') || '無'}`);
  if (result.log.length) console.log('過程備註：\n  ' + result.log.join('\n  '));
  return report('玩家視角模擬 · 聲音線與物理線', result.steps, errors);
});
process.exit(ok ? 0 : 1);
