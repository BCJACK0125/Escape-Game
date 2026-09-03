// 無頭瀏覽器整合測試（開發用）。
// 做法：本機起一個靜態伺服器，用請求攔截把 three.js CDN 換成測試替身，
// 然後在真實 DOM 裡走完 26 個節點，確認狀態機、面板與 3D 互動註冊都沒有炸掉。
//
// 用法：node tools/test/playthrough.mjs
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, normalize } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire('/home/claude/.npm-global/lib/node_modules/@mermaid-js/mermaid-cli/index.js');
const puppeteer = require('puppeteer');

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const PORT = 8731;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^\/+/, '') || 'index.html';
    const file = join(ROOT, rel);
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((r) => server.listen(PORT, r));

const stub = await readFile(join(ROOT, 'tools/test/three-stub.js'), 'utf8');

const browser = await puppeteer.launch({
  headless: 'shell',
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
});
const page = await browser.newPage();
const errors = [];
const logs = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  const t = m.text();
  logs.push(`${m.type()}: ${t}`);
  if (m.type() === 'error' && !/favicon|WebGL|Failed to load resource/i.test(t)) errors.push(`console: ${t}`);
});

await page.setRequestInterception(true);
page.on('request', (r) => {
  const u = r.url();
  if (/unpkg\.com|jsdelivr|esm\.sh/.test(u)) {
    r.respond({
      status: 200,
      contentType: 'text/javascript',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: stub
    });
    return;
  }
  r.continue();
});

await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle2' });
await page.waitForFunction('window.__act13 !== undefined', { timeout: 15000 });

// ── 用內部 API 驅動整場遊戲 ─────────────────────────────────
const result = await page.evaluate(async () => {
  const { store, ctx, menu } = window.__act13;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = [];
  const fail = [];

  // 開新局（不重載頁面）
  store.newGame('rehearsal');
  menu.hide();
  // main.js 的 startGame 會建世界；標題按鈕在 DOM 裡，直接點它
  const leadBtn = document.querySelector('.title-actions .btn--lead');
  if (leadBtn) leadBtn.click();
  await wait(200);
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));   // 跳過開場旁白
  await wait(400);
  if (!ctx.world.room) fail.push('世界沒有建立');
  if (ctx.controls.frozen) fail.push('開場跳過後仍處於凍結狀態');

  const g = (id, extra) => ctx.game.trigger(id, extra);
  const done = (id) => store.isDone(id);
  const step = (label, fn) => {
    try { fn(); } catch (e) { fail.push(`${label}: ${e.message}`); }
  };

  // 序幕
  step('P01', () => { store.complete('P01'); g('P01-cord'); });
  if (!ctx.world.room.lampOn) fail.push('燈繩沒有點亮吊燈');
  step('P02', () => {
    g('P02');
    ctx.world.room.setShadeAngle((3.25 / 12) * Math.PI * 2);
  });
  // 讓燈罩轉到位並讓 update 迴圈判定
  await wait(1600);
  if (!done('P02')) fail.push('影子時鐘沒有判定成功');
  step('P03-open', () => g('P03'));
  await wait(100);
  // 直接在面板裡輸入密碼
  const type = (code) => {
    for (const ch of code) {
      const btn = [...document.querySelectorAll('.keypad-key')].find((b) => b.textContent === ch);
      btn?.click();
    }
  };
  type('0315');
  await wait(600);
  if (!done('P03')) fail.push('P03 抽屜沒有開啟');
  await wait(1800);

  // 光影線
  store.setFlag('uvOn', true);
  step('L01', () => { g('L01', { poster: 0 }); g('L01', { poster: 1 }); g('L01', { poster: 2 }); });
  if (!done('L01')) fail.push('L01 未完成');
  step('L02', () => {
    g('L02', { portrait: 0, cover: 'left' });
    g('L02', { portrait: 1, cover: 'right' });
    g('L02', { portrait: 2, cover: 'both' });
  });
  if (!done('L02')) fail.push('L02 未完成');
  // L02 錯誤路徑
  store.setFlag('portraitStep', 0);
  step('L03', () => { store.complete('L03'); g('L04'); });
  await wait(100);
  const filterBtn = [...document.querySelectorAll('.panel-actions .btn')].find((b) => /紅濾片/.test(b.textContent));
  filterBtn?.click();
  await wait(200);
  if (!done('L04')) fail.push('L04 未完成');
  ctx.panel.close();
  step('L05', () => {
    // 30 / 60 / 45 度：每次點 15 度
    for (let i = 0; i < 2; i++) g('L05', { mirror: 0 });
    for (let i = 0; i < 4; i++) g('L05', { mirror: 1 });
    for (let i = 0; i < 3; i++) g('L05', { mirror: 2 });
  });
  if (!done('L05')) fail.push(`L05 未完成，角度=${ctx.world.gallery.angles.join(',')}`);
  step('L05-take', () => g('L05-take'));
  if (!store.hasSigil('sun')) fail.push('沒有拿到太陽徽記');

  // 聲音線
  step('S01', () => store.complete('S01'));
  step('S02', () => store.complete('S02'));
  step('S03', () => {
    [4, 2, 5, 1, 3].forEach((n) => g('S03', { rope: n - 1 }));
  });
  if (!done('S03')) fail.push(`S03 未完成，input=${JSON.stringify(store.flag('bellInput'))}`);
  // S03 錯誤路徑：拉錯應清除
  store.setFlag('bellInput', [4]);
  step('S04-enter', () => g('S04'));
  await wait(120);
  // 模擬「不動」：把 idle 時間推進
  for (let i = 0; i < 40; i++) { await wait(300); if (done('S04')) break; }
  if (!done('S04')) fail.push('S04 靜默沒有在 12 秒內填滿');
  step('S05', () => g('S05'));
  await wait(15000);
  step('S05-take', () => g('S05-take'));
  if (!store.hasSigil('moon')) fail.push('沒有拿到月亮徽記');

  // 物理線
  step('M01', () => g('M01'));
  await wait(100);
  const chip = (name) => [...document.querySelectorAll('.chip')].filter((c) => c.textContent.startsWith(name));
  chip('兔')[0]?.click();               // 左
  chip('帽')[0]?.click();
  chip('帽')[0]?.click();               // 右（重繪後要重新取）
  const chips2 = [...document.querySelectorAll('.chip')];
  const hat = chips2.find((c) => c.textContent.startsWith('帽'));
  if (hat && !/右/.test(hat.textContent)) hat.click();
  const coin = [...document.querySelectorAll('.chip')].find((c) => c.textContent.startsWith('硬幣'));
  coin?.click(); 
  const coinAgain = [...document.querySelectorAll('.chip')].find((c) => c.textContent.startsWith('硬幣'));
  if (coinAgain && !/右/.test(coinAgain.textContent)) coinAgain.click();
  await wait(2600);
  if (!done('M01')) fail.push('M01 天平沒有平衡（測試操作可能不精確）');
  ctx.panel.close();
  if (!store.hasItem('case-key')) { store.addItem('case-key'); store.complete('M01'); log.push('M01 以直接補狀態繼續'); }
  step('M02', () => { store.addItem('wand-tip'); store.complete('M02'); ctx.world.workbench.removeWandTip(); });
  step('M03', () => g('M03'));
  await wait(100);
  for (let round = 0; round < 5; round++) {
    const segs = [...document.querySelectorAll('.wand-seg')];
    segs.forEach((s) => { if (!s.classList.contains('is-aligned')) s.click(); });
    await wait(60);
    if (store.hasItem('wand')) break;
  }
  await wait(400);
  if (!store.hasItem('wand')) fail.push('M03 魔杖沒有組好');
  ctx.panel.close();
  step('M04', () => { ['N', 'E', 'S', 'W'].forEach((d, i) => g('M04', { dir: d, index: i })); });
  if (!done('M04')) fail.push('M04 未完成');
  step('M05', () => g('M05'));
  if (!store.hasSigil('star')) fail.push('沒有拿到星星徽記');

  // 合流
  step('G01', () => g('G01'));
  await wait(4000);
  if (!done('G01')) fail.push('G01 未完成');
  step('G02', () => g('G02'));
  await wait(150);
  [...document.querySelectorAll('.journal-col')][2]
    ?.querySelectorAll('.journal-token')
    .forEach((t) => t.click());
  await wait(2400);
  if (!done('G02')) fail.push('G02 未完成');
  step('G03', () => { g('G03', { prop: 'chair' }); g('G03', { prop: 'umbrella' }); g('G03', { prop: 'mirror' }); });
  await wait(200);
  if (!done('G03')) fail.push(`G03 未完成，state=${JSON.stringify(ctx.world.stage.state)}`);

  // G04：把相機放到觀看點並正對 -Z
  const vp = ctx.world.stage.VIEWPOINT;
  ctx.controls.teleport(vp.x, vp.z, Math.PI * 0);   // yaw=0 → 面向 -Z
  await wait(1400);
  if (!done('G04')) fail.push('G04 視角合字沒有判定成功');

  // G05：依序走過腳印
  const order = [2, 5, 1, 4, 3];
  for (const n of order) {
    const plate = ctx.world.stage.plates.find((p) => p.n === n);
    ctx.controls.teleport(plate.x, plate.z);
    await wait(120);
    ctx.controls.teleport(0, 3.4);   // 離開感測區
    await wait(120);
  }
  if (!done('G05')) fail.push(`G05 腳步序列未完成，seq=${JSON.stringify(store.flag('footSeq'))}`);

  // 終局
  step('F01', () => g('F01'));
  await wait(120);
  type('247');
  await wait(700);
  if (!done('F01')) fail.push('F01 未完成');
  step('F02', () => g('F02', { reel: 'reveal' }));
  await wait(22000);
  if (!done('F02')) fail.push('F02 未完成');
  step('F03', () => { g('F03', { rope: 0 }); g('F03', { rope: 1 }); });
  await wait(9000);
  if (!done('F03')) fail.push('F03 未完成');

  const anamorphic = ctx.world.stage.strokes.length;
  return {
    fail, log,
    progress: store.progress(),
    ending: store.state.ending,
    sigils: Object.keys(store.state.sigils),
    clues: store.state.clues.length,
    strokes: anamorphic,
    frames: window.__stubFrames || 0,
    interactives: ctx.interaction ? undefined : 'n/a'
  };
});

console.log('\n=== 測試結果 ===');
console.log(`節點完成：${result.progress.done} / ${result.progress.total}`);
console.log(`徽記：${result.sigils.join(', ') || '無'}　線索：${result.clues}　結局：${result.ending}`);
console.log(`視角合字線段數：${result.strokes}　渲染幀數：${result.frames}`);
if (result.log.length) console.log('備註：', result.log.join(' | '));
if (result.fail.length) {
  console.log('\n流程問題：');
  result.fail.forEach((f) => console.log(' ✗ ' + f));
}
if (errors.length) {
  console.log('\nJS 錯誤：');
  [...new Set(errors)].forEach((e) => console.log(' ✗ ' + e));
}
const warnLogs = logs.filter((l) => /warn/i.test(l));
if (warnLogs.length) console.log('\n警告：', [...new Set(warnLogs)].slice(0, 8).join('\n  '));

await browser.close();
server.close();
process.exit(result.fail.length || errors.length ? 1 : 0);
