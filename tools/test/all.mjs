// 一次跑完所有測試。用法：node tools/test/all.mjs
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const QUICK = [
  ['靜態檢查', 'tools/check-imports.mjs'],
  ['遮罩與點擊穿透', 'tools/test/overlay.mjs'],
  ['燈光預算', 'tools/test/lighting.mjs'],
  ['磁鐵迷宮連通性', 'tools/test/maze.mjs'],
  ['可用性稽核', 'tools/test/usability.mjs'],
  ['螢幕搖桿與亮度', 'tools/test/touch.mjs'],
  ['單一檔案原型', 'tools/test/prototype.mjs'],
  ['韌性測試', 'tools/test/robustness.mjs'],
  ['完整流程（腳本驅動）', 'tools/test/playthrough.mjs']
];

// 玩家視角模擬：只用走路、拖曳、點擊，每段約 2–3 分鐘
const SIMS = [
  ['玩家模擬 1 · 序幕與光影線', 'tools/test/user-sim-1.mjs'],
  ['玩家模擬 2 · 聲音線與物理線', 'tools/test/user-sim-2.mjs'],
  ['玩家模擬 3 · 合流與終幕', 'tools/test/user-sim-3.mjs']
];

const mode = process.argv[2] || 'all';
const SUITES = mode === 'quick' ? QUICK : mode === 'sim' ? SIMS : [...QUICK, ...SIMS];
if (mode === 'all') console.log('（完整測試含玩家模擬，約需 12–15 分鐘；只要快的請用 node tools/test/all.mjs quick）');

let failed = 0;
for (const [name, file] of SUITES) {
  process.stdout.write(`\n▶ ${name}\n`);
  const r = spawnSync(process.execPath, [file], { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) failed++;
}
console.log(failed ? `\n${failed} 組測試未通過。` : '\n全部測試通過。');
process.exit(failed ? 1 : 0);
