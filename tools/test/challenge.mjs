// 挑戰模式（標準場次預設）：目標不給答案、道具要自己拿出來試、提示依卡關時間解鎖。
// 用法：node tools/test/challenge.mjs
import { withPage, report } from './harness.mjs';

const ok = await withPage(8781, async (page, errors) => {
  const checks = await page.evaluate(async () => {
    const { store, ctx, cinema, journal } = window.__act13;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const out = [];
    const add = (l, v, n = '') => out.push([l, !!v, n]);
    const g = (id, extra) => ctx.game.trigger(id, extra);
    const toasts = () => document.querySelector('.hud-toasts')?.textContent || '';
    const objective = () => document.querySelector('.hud-objective')?.textContent || '';
    setInterval(() => { if (cinema.active) cinema.stop(); }, 50);

    document.querySelector('.title-actions .btn--lead')?.click();
    await wait(1200);
    add('標準場次是挑戰模式', store.challenge && store.state.mode === 'standard');

    // ── P01：信是純文字，答案是去拉繩子 ──
    g('P01');
    await wait(150);
    add('信上沒有可以點的首字框', document.querySelectorAll('#panel-root .letter-head').length === 0);
    add('首字只是墨色較深', document.querySelectorAll('#panel-root .letter-ink').length === 6);
    add('面板沒有「依序點出首字」的說明', !/依序點出/.test(document.querySelector('#panel-root')?.textContent || ''));
    ctx.panel.close();
    await wait(100);
    add('讀完信不會直接完成 P01', !store.isDone('P01'));
    add('目標只說「信裡藏著一句話」', /藏著一句話/.test(objective()), objective());
    add('信的全文記進線索本', store.hasClue('letter'));
    g('P01-cord');
    await wait(100);
    add('想通之後拉下燈繩就完成 P01', store.isDone('P01') && ctx.world.room.lampOn);
    add('接下來的目標不洩漏 03:15', !/03:15/.test(objective()), objective());

    // ── 提示依時間解鎖 ──
    store.markOpened();
    add('剛開始時第 1 級提示還沒解鎖', store.hintWait('P02') > 0, `${Math.round(store.hintWait('P02'))} 秒`);
    add('未解鎖時聽不到提示', store.useHint('P02') === null);
    journal.open('hints');
    await wait(120);
    add('備忘頁顯示倒數', !!document.querySelector('#panel-root .is-waiting'),
      document.querySelector('#panel-root .is-waiting')?.textContent || '');
    ctx.panel.close();
    store.state.elapsed += 125;
    add('卡住兩分鐘後第 1 級解鎖', store.hintWait('P02') === 0);
    const h1 = store.useHint('P02');
    add('可以聽第 1 級', h1?.level === 1);
    add('第 2 級還要再等', store.hintWait('P02') > 0, `${Math.round(store.hintWait('P02'))} 秒`);

    // ── P02、P03 ──
    store.complete('P02');
    g('P03');
    await wait(150);
    add('抽屜鍵盤沒有「時間就是密碼」的提示', !/時間就是密碼/.test(document.querySelector('#panel-root')?.textContent || ''));
    ['0', '3', '1', '5'].forEach((k) => [...document.querySelectorAll('.keypad-key')].find((b) => b.textContent === k)?.click());
    await wait(2600);
    ctx.panel.close();
    await wait(300);
    const chips = [...document.querySelectorAll('.hud-items .item-chip')].map((c) => c.dataset.item);
    add('抽屜的四樣東西出現在道具列', ['uv-lamp', 'red-filter', 'baton', 'half-photo'].every((id) => chips.includes(id)), chips.join(','));

    // ── 拿著不對的道具去點東西：派不上用場，自動收起 ──
    document.querySelector('.item-chip[data-item="baton"]').click();
    add('點道具會拿在手上', ctx.items.held === 'baton');
    g('M01-sheet');
    await wait(80);
    add('用錯地方會說派不上用場', /派不上用場/.test(toasts()), toasts().slice(-30));
    add('用錯之後道具收起來', ctx.items.held === null);

    // ── L04：沒有按鈕，要從面板下方拿出紅濾片 ──
    ['L01', 'L02', 'L03'].forEach((id) => store.complete(id));
    g('L04');
    await wait(150);
    add('濾片面板沒有現成的按鈕', !/蓋上紅濾片/.test(document.querySelector('#panel-root')?.textContent || ''));
    const tray = () => [...document.querySelectorAll('#panel-root .panel-tray .item-chip')];
    add('面板下方有「拿出」道具列', tray().length >= 3);
    tray().find((c) => c.dataset.item === 'baton')?.click();
    await wait(80);
    add('拿錯東西沒有作用', !store.isDone('L04') && /沒有作用/.test(document.querySelector('.panel-status')?.textContent || ''));
    tray().find((c) => c.dataset.item === 'red-filter')?.click();
    await wait(80);
    add('拿出紅濾片就讀到刻度（L04）', store.isDone('L04'));
    ctx.panel.close();
    await wait(100);

    // ── S01：票根與轉盤一起出現，不教你「依日期排序」 ──
    g('S01');
    await wait(150);
    add('票根面板沒有排序清單', !document.querySelector('#panel-root .order-list'));
    add('四張票根與轉盤同時擺出來', document.querySelectorAll('#panel-root .ticket').length === 4 && !!document.querySelector('#panel-root .dial'));
    ctx.panel.close();
    await wait(100);

    // ── S03 重播：要用指揮棒敲 ──
    store.complete('S01'); store.complete('S02');
    g('S03-replay');
    await wait(80);
    add('空手點指揮台不會重播', !/重播音序/.test(toasts()));
    document.querySelector('.item-chip[data-item="baton"]').click();
    g('S03-replay');
    await wait(80);
    add('拿著指揮棒敲就會重播', /重播音序/.test(toasts()));
    add('指揮棒可以重複用（還在手上）', ctx.items.held === 'baton');
    ctx.items.clear();

    // ── M02：要拿鑰匙開玻璃櫃 ──
    store.complete('M01');
    store.addItem('case-key');
    g('M02');
    await wait(100);
    add('空手點玻璃櫃是鎖著的', ctx.panel.id !== 'M02' && !store.flag('caseOpen', false));
    document.querySelector('.item-chip[data-item="case-key"]').click();
    g('M02');
    await wait(150);
    add('拿著鑰匙就打開玻璃櫃', store.flag('caseOpen', false) && ctx.panel.id === 'M02');
    add('鑰匙用掉後離開道具列', !document.querySelector('.item-chip[data-item="case-key"]'));
    ctx.panel.close();
    await wait(100);

    // ── M04：感測牆認的是拿在手上的魔杖 ──
    store.complete('M02'); store.addItem('wand-tip');
    store.complete('M03'); store.addItem('wand'); store.spendItem('wand-tip');
    g('M04', { dir: 'N', index: 0 });
    add('空手碰節點沒有反應', (store.flag('wandSeq', []) || []).length === 0);
    document.querySelector('.item-chip[data-item="wand"]').click();
    g('M04', { dir: 'N', index: 0 });
    add('拿著魔杖碰節點才算', (store.flag('wandSeq', []) || []).join() === 'N');
    add('碰完魔杖還在手上，可以繼續', ctx.items.held === 'wand');

    // ── G03 輪廓不寫答案 ──
    ctx.world.stage.showOutlines(true);
    const tags = ctx.world.stage.outlineTags;
    add('地上的輪廓沒有「椅 · 左」之類的字', tags.length === 3 && tags.every((t) => !t.visible));

    // ── 隨時可以切回引導 ──
    store.setGuide('guided');
    add('切換成引導後文案變直接', store.pick('A', 'B') === 'B' && store.hintWait('S03') === 0);

    return out;
  });
  return report('挑戰模式', checks, errors);
}, { query: '?guide=challenge' });

process.exit(ok ? 0 : 1);
