// 測試用瀏覽器載入：依序嘗試幾種 puppeteer 來源，讓測試在不同機器上都跑得起來。
//
//   1. 專案裡裝的 puppeteer（npm i -D puppeteer）
//   2. 環境變數 PUPPETEER_FROM 指向的資料夾裡的 puppeteer / puppeteer-core
//   3. 原作者環境的全域路徑
//
// 只有 puppeteer-core 時，用 CHROME_PATH 指定瀏覽器執行檔
// （例如 Windows：C:/Program Files/Google/Chrome/Application/chrome.exe）。
import { createRequire } from 'node:module';
import { join } from 'node:path';

export async function loadPuppeteer() {
  const tries = [];
  tries.push(() => createRequire(import.meta.url)('puppeteer'));
  if (process.env.PUPPETEER_FROM) {
    const req = createRequire(join(process.env.PUPPETEER_FROM, 'noop.js'));
    tries.push(() => req('puppeteer'));
    tries.push(() => req('puppeteer-core'));
  }
  tries.push(() => createRequire('/home/claude/.npm-global/lib/node_modules/@mermaid-js/mermaid-cli/index.js')('puppeteer'));
  for (const t of tries) {
    try { return t(); } catch { /* 換下一個 */ }
  }
  throw new Error('找不到 puppeteer。請執行 npm i -D puppeteer，或設定 PUPPETEER_FROM（與 CHROME_PATH）。');
}

export function launchOptions(extra = {}) {
  const opts = {
    headless: 'shell',
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    ...extra
  };
  if (process.env.CHROME_PATH) {
    opts.executablePath = process.env.CHROME_PATH;
    opts.headless = 'new';
  }
  return opts;
}

/** 測試一律換成 three.js 替身：CDN 與 vendor/ 的本機版都攔下來 */
export const THREE_URL = /unpkg\.com|jsdelivr|esm\.sh|\/vendor\/three\.module\.js/;
