// 測試用共用外殼：起靜態伺服器、攔截 three.js CDN、開無頭瀏覽器。
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire('/home/claude/.npm-global/lib/node_modules/@mermaid-js/mermaid-cli/index.js');
const puppeteer = require('puppeteer');

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };

export async function withPage(port, fn) {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://localhost:${port}`);
      const rel = normalize(decodeURIComponent(url.pathname)).replace(/^\/+/, '') || 'index.html';
      const body = await readFile(join(ROOT, rel));
      res.writeHead(200, { 'Content-Type': MIME[extname(rel)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  await new Promise((r) => server.listen(port, r));

  const stub = await readFile(join(ROOT, 'tools/test/three-stub.js'), 'utf8');
  const browser = await puppeteer.launch({
    headless: 'shell',
    protocolTimeout: 900000,     // 玩家視角模擬會跑好幾分鐘
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|WebGL|Failed to load resource/i.test(m.text())) errors.push(`console: ${m.text()}`);
  });
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    if (/unpkg\.com|jsdelivr|esm\.sh/.test(r.url())) {
      r.respond({ status: 200, contentType: 'text/javascript', headers: { 'Access-Control-Allow-Origin': '*' }, body: stub });
      return;
    }
    r.continue();
  });

  await page.goto(`http://localhost:${port}/index.html`, { waitUntil: 'networkidle2' });
  await page.waitForFunction('window.__act13 !== undefined', { timeout: 20000 });

  try {
    return await fn(page, errors);
  } finally {
    await browser.close();
    server.close();
  }
}

export function report(title, checks, errors) {
  console.log(`\n=== ${title} ===`);
  let bad = 0;
  for (const [label, pass, note] of checks) {
    console.log(`${pass ? ' ✓' : ' ✗'} ${label}${note ? `　（${note}）` : ''}`);
    if (!pass) bad++;
  }
  if (errors.length) {
    console.log('\nJS 錯誤：');
    [...new Set(errors)].forEach((e) => console.log(' ✗ ' + e));
  }
  return bad === 0 && errors.length === 0;
}
