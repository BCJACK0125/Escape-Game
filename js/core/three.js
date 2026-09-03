// Three.js 載入層。
// 專案刻意不使用打包工具，直接用 ES Module 從 CDN 取得 three。
// 為了避免單一 CDN 失效讓整個遊戲開不起來，這裡依序嘗試多個來源。
//
// 想完全離線／自行託管：把 three.module.js 放到 vendor/three.module.js，
// 然後把下面的 USE_LOCAL_FIRST 改成 true。

const VERSION = '0.160.0';
const USE_LOCAL_FIRST = false;

const SOURCES = [
  USE_LOCAL_FIRST ? new URL('../../vendor/three.module.js', import.meta.url).href : null,
  `https://unpkg.com/three@${VERSION}/build/three.module.js`,
  `https://cdn.jsdelivr.net/npm/three@${VERSION}/build/three.module.js`,
  `https://esm.sh/three@${VERSION}`
].filter(Boolean);

let mod = null;
let lastError = null;

for (const url of SOURCES) {
  try {
    mod = await import(/* webpackIgnore: true */ url);
    if (mod && mod.Scene) break;
    mod = null;
  } catch (err) {
    lastError = err;
  }
}

if (!mod) {
  const message = '無法載入 three.js（請確認網路連線，或改用 vendor/ 的本機版本）。';
  document.documentElement.classList.add('load-failed');
  const box = document.getElementById('fatal');
  if (box) {
    box.hidden = false;
    box.textContent = message;
  }
  throw new Error(`${message} ${lastError || ''}`);
}

// 顏色管理：three r152 之後預設啟用，這裡明示一次，讓不同版本行為一致。
if (mod.ColorManagement) mod.ColorManagement.enabled = true;

export const THREE = mod;
export const THREE_VERSION = mod.REVISION || VERSION;
export default mod;
