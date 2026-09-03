// 開發用檢查：驗證每個 ES Module 的語法、import 路徑與具名匯出是否對得上。
// 用法：node tools/check-imports.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const JS_DIR = join(ROOT, 'js');

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : (p.endsWith('.js') ? [p] : []);
  });
}

const files = walk(JS_DIR);
const exportsMap = new Map();
const problems = [];

function collectExports(src) {
  const named = new Set();
  let hasDefault = false;
  const re = [
    /export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g,
    /export\s+(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/g,
    /export\s+class\s+([A-Za-z_$][\w$]*)/g
  ];
  for (const r of re) {
    let m;
    while ((m = r.exec(src))) named.add(m[1]);
  }
  const listRe = /export\s*\{([^}]*)\}/g;
  let m;
  while ((m = listRe.exec(src))) {
    m[1].split(',').forEach((part) => {
      const bits = part.trim().split(/\s+as\s+/);
      const name = (bits[1] || bits[0] || '').trim();
      if (name === 'default') hasDefault = true;
      else if (name) named.add(name);
    });
  }
  if (/export\s+default\b/.test(src)) hasDefault = true;
  return { named, hasDefault };
}

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  exportsMap.set(file, collectExports(src));
  try {
    execFileSync(process.execPath, ['--input-type=module', '--check'], { input: src, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (err) {
    problems.push(`[語法] ${relative(ROOT, file)}\n${(err.stderr || '').toString().split('\n').slice(0, 6).join('\n')}`);
  }
}

const importRe = /import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/g;

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  let m;
  while ((m = importRe.exec(src))) {
    const clause = m[1] || '';
    const spec = m[2] || m[3];
    if (!spec || !spec.startsWith('.')) continue;
    const target = resolve(dirname(file), spec);
    if (!exportsMap.has(target)) {
      problems.push(`[路徑] ${relative(ROOT, file)} → ${spec} 找不到`);
      continue;
    }
    const info = exportsMap.get(target);
    const defaultMatch = clause.match(/^\s*([A-Za-z_$][\w$]*)\s*(?:,|$)/);
    if (defaultMatch && !clause.trim().startsWith('{') && !clause.trim().startsWith('*')) {
      if (!info.hasDefault) problems.push(`[匯出] ${relative(ROOT, file)} 要 default，但 ${spec} 沒有 export default`);
    }
    const braces = clause.match(/\{([^}]*)\}/);
    if (braces) {
      braces[1].split(',').forEach((part) => {
        const name = part.trim().split(/\s+as\s+/)[0].trim();
        if (!name) return;
        if (name === 'default') {
          if (!info.hasDefault) problems.push(`[匯出] ${relative(ROOT, file)} → ${spec} 沒有 default`);
        } else if (!info.named.has(name)) {
          problems.push(`[匯出] ${relative(ROOT, file)} 匯入 { ${name} }，但 ${spec} 沒有匯出它`);
        }
      });
    }
  }
}

console.log(`檢查 ${files.length} 個模組。`);
if (problems.length) {
  console.log(`\n發現 ${problems.length} 個問題：\n`);
  problems.forEach((p) => console.log(' • ' + p));
  process.exit(1);
} else {
  console.log('全部通過：語法、路徑、具名匯出都一致。');
}
