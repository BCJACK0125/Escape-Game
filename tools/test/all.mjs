// 一次跑完所有測試。用法：node tools/test/all.mjs
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const SUITES = [
  ['靜態檢查', 'tools/check-imports.mjs'],
  ['遮罩與點擊穿透', 'tools/test/overlay.mjs'],
  ['燈光預算', 'tools/test/lighting.mjs'],
  ['螢幕搖桿與亮度', 'tools/test/touch.mjs'],
  ['單一檔案原型', 'tools/test/prototype.mjs'],
  ['韌性測試', 'tools/test/robustness.mjs'],
  ['完整流程', 'tools/test/playthrough.mjs']
];

let failed = 0;
for (const [name, file] of SUITES) {
  process.stdout.write(`\n▶ ${name}\n`);
  const r = spawnSync(process.execPath, [file], { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) failed++;
}
console.log(failed ? `\n${failed} 組測試未通過。` : '\n全部測試通過。');
process.exit(failed ? 1 : 0);
