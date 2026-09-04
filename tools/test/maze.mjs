// 迷宮連通性測試。M02 曾經出過「出口與起點不連通」的致命 bug，這一組專門守它。
// 用法：node tools/test/maze.mjs
import { withPage, report } from './harness.mjs';

const ok = await withPage(8841, async (page, errors) => {
  const checks = await page.evaluate(async () => {
    const mod = await import('/js/puzzles/physical.js');
    const MAZE = mod.MAZE;
    const out = [];
    const add = (l, v, n = '') => out.push([l, !!v, n]);

    add('地圖是正方形', MAZE.length === MAZE[0].length, `${MAZE[0].length}×${MAZE.length}`);
    add('外框封閉',
      MAZE[0].split('').every((c) => c === '#') &&
      MAZE[MAZE.length - 1].split('').every((c) => c === '#') &&
      MAZE.every((r) => r[0] === '#' && r[r.length - 1] === '#'));

    let start = null;
    let end = null;
    MAZE.forEach((row, r) => [...row].forEach((c, q) => {
      if (c === 'S') start = [q, r];
      if (c === 'E') end = [q, r];
    }));
    add('有唯一的起點與出口', !!start && !!end, `S(${start}) E(${end})`);

    // BFS
    const seen = new Set([start.join()]);
    const queue = [[start, 0]];
    let dist = null;
    while (queue.length) {
      const [[c, r], d] = queue.shift();
      if (c === end[0] && r === end[1]) { dist = d; break; }
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = [c + dc, r + dr];
        if (n[1] < 0 || n[1] >= MAZE.length || n[0] < 0 || n[0] >= MAZE[0].length) continue;
        if (MAZE[n[1]][n[0]] === '#' || seen.has(n.join())) continue;
        seen.add(n.join());
        queue.push([n, d + 1]);
      }
    }
    add('出口從起點走得到', dist !== null, dist === null ? '不連通（玩家會卡死在這一關）' : `最短 ${dist} 格`);
    add('路徑長度合理（不會太短也不會太磨人）', dist !== null && dist >= 12 && dist <= 45, `${dist} 格`);

    const open = MAZE.join('').split('').filter((c) => c !== '#').length;
    add('通道比例合理', open / (MAZE.length * MAZE[0].length) > 0.28,
      `${open} / ${MAZE.length * MAZE[0].length} 格`);
    return out;
  });
  return report('磁鐵迷宮連通性', checks, errors);
});
process.exit(ok ? 0 : 1);
