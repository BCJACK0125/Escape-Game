// 玩家動作函式庫（給 user-sim-*.mjs 用，在瀏覽器裡執行）。
// 這裡只提供玩家真的做得到的動作：按鍵走路、拖曳視角、點畫面、點面板按鈕。
// 刻意不包裝任何 game.trigger / store.complete —— 那些是作弊。

const LOOK = 0.0026;   // PLAYER.lookSpeed

export async function createSim() {
  const { store, ctx } = window.__act13;
  const stub = await import('/tools/test/three-stub.js');
  const canvas = document.getElementById('scene');

  const steps = [];
  const log = [];
  window.__simSteps = steps;
  window.__simLog = log;

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const cx = () => Math.floor(innerWidth / 2);
  const cy = () => Math.floor(innerHeight / 2);
  let pid = 200;

  const note = (m) => { log.push(m); };
  const step = (label, pass, detail = '') => {
    steps.push([label, !!pass, detail]);
    window.__simAt = label;
  };

  // ── 視角與移動 ──────────────────────────────────────────
  async function faceTo(aim) {
    const cam = ctx.camera;
    const dx = aim[0] - cam.position.x;
    const dz = aim[2] - cam.position.z;
    const flat = Math.hypot(dx, dz);
    let dyaw = Math.atan2(-dx, -dz) - ctx.controls.yaw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    const dpitch = Math.atan2(aim[1] - cam.position.y, Math.max(flat, 0.2)) - ctx.controls.pitch;
    const pxX = -dyaw / LOOK;
    const pxY = -dpitch / LOOK;
    const id = ++pid;
    canvas.dispatchEvent(new PointerEvent('pointerdown', { button: 0, pointerId: id, clientX: cx(), clientY: cy(), bubbles: true }));
    // 先做一次明顯的來回揮動：確保這一段被判定成「拖曳看四周」而不是「點擊」。
    // （淨旋轉為零，只是把 dragMoved 推過門檻）
    const wiggle = [60, 0];
    for (const wx of wiggle) {
      window.dispatchEvent(new PointerEvent('pointermove', { pointerId: id, buttons: 1, clientX: cx() + wx, clientY: cy(), bubbles: true }));
    }
    for (let i = 1; i <= 5; i++) {
      window.dispatchEvent(new PointerEvent('pointermove', {
        pointerId: id, buttons: 1,
        clientX: cx() + (pxX * i) / 5, clientY: cy() + (pxY * i) / 5, bubbles: true
      }));
    }
    window.dispatchEvent(new PointerEvent('pointerup', { button: 0, pointerId: id, clientX: cx() + pxX, clientY: cy() + pxY, bubbles: true }));
    await wait(40);
  }

  async function tapCenter() {
    const id = ++pid;
    canvas.dispatchEvent(new PointerEvent('pointerdown', { button: 0, pointerId: id, clientX: cx(), clientY: cy(), bubbles: true }));
    await wait(25);
    window.dispatchEvent(new PointerEvent('pointerup', { button: 0, pointerId: id, clientX: cx(), clientY: cy(), bubbles: true }));
    await wait(70);
  }

  async function walkTo(x, z, tol = 0.4, maxMs = 6000) {
    const t0 = performance.now();
    let last = Infinity;
    while (performance.now() - t0 < maxMs) {
      const d = Math.hypot(ctx.camera.position.x - x, ctx.camera.position.z - z);
      if (d <= tol) break;
      await faceTo([x, 1.62, z]);
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
      await wait(Math.min(700, Math.max(110, d * 300)));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
      await wait(30);
      const nd = Math.hypot(ctx.camera.position.x - x, ctx.camera.position.z - z);
      if (nd > last - 0.05) {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
        await wait(240);
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD' }));
        await wait(30);
      }
      last = nd;
    }
    // 放開按鍵後角色還會滑行一段（阻尼），等它停下來再瞄準
    for (let i = 0; i < 12 && ctx.controls.moving; i++) await wait(40);
    await wait(120);
    return Math.hypot(ctx.camera.position.x - x, ctx.camera.position.z - z);
  }

  // ── 目標定位：玩家用眼睛找，測試用幾何算 ─────────────────
  const walkable = [];
  for (let x = -5.7; x <= 5.7; x += 0.3) {
    for (let z = -3.7; z <= 3.7; z += 0.3) {
      if (ctx.controls.canStand(x, z)) walkable.push([x, z]);
    }
  }

  // ── 尋路（0.3 m 網格 BFS）──────────────────────────────
  const GRID = 0.3;
  const key = (x, z) => `${Math.round(x / GRID)},${Math.round(z / GRID)}`;
  const walkSet = new Set(walkable.map(([x, z]) => key(x, z)));
  const fromKey = (k) => k.split(',').map((v) => Number(v) * GRID);

  function nearestWalkable(x, z) {
    let best = null;
    let bd = Infinity;
    for (const [wx, wz] of walkable) {
      const d = Math.hypot(wx - x, wz - z);
      if (d < bd) { bd = d; best = [wx, wz]; }
    }
    return best;
  }

  function pathFind(fromX, fromZ, toX, toZ) {
    const start = nearestWalkable(fromX, fromZ);
    const goal = nearestWalkable(toX, toZ);
    if (!start || !goal) return [];
    const startK = key(start[0], start[1]);
    const goalK = key(goal[0], goal[1]);
    const prev = new Map();
    const seen = new Set([startK]);
    const queue = [startK];
    while (queue.length) {
      const cur = queue.shift();
      if (cur === goalK) break;
      const [cxx, czz] = fromKey(cur);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nx = cxx + dx * GRID;
        const nz = czz + dz * GRID;
        const k = key(nx, nz);
        if (!walkSet.has(k) || seen.has(k)) continue;
        // 斜走時兩側也要通，避免貼著角落穿過去
        if (dx && dz && (!walkSet.has(key(cxx + dx * GRID, czz)) || !walkSet.has(key(cxx, czz + dz * GRID)))) continue;
        seen.add(k);
        prev.set(k, cur);
        queue.push(k);
      }
    }
    if (!prev.has(goalK) && goalK !== startK) return [];
    const path = [];
    let cur = goalK;
    while (cur && cur !== startK) { path.unshift(fromKey(cur)); cur = prev.get(cur); }
    return path;
  }

  /** 沿著尋路結果走過去（每隔幾格取一個轉折點）*/
  async function walkPath(x, z, tol = 0.4) {
    const path = pathFind(ctx.camera.position.x, ctx.camera.position.z, x, z);
    if (!path.length) return walkTo(x, z, tol, 6000);
    const waypoints = path.filter((_, i) => i % 4 === 3);
    for (const [wx, wz] of waypoints) await walkTo(wx, wz, 0.42, 3500);
    return walkTo(x, z, tol, 4000);
  }

  function targetOf(id) {
    const entry = ctx.interaction.get(id);
    if (!entry) return null;
    const proxies = [];
    const boxes = [];
    const visit = (n) => {
      if (n.userData?.__hitProxy) proxies.push(stub.worldBox(n).center);
      else if (n.isMesh && n.geometry) boxes.push(stub.worldBox(n));
      (n.children || []).forEach(visit);
    };
    visit(entry.object);
    let aim = null;
    if (proxies.length) aim = proxies[0];
    else if (boxes.length) {
      const min = [Infinity, Infinity, Infinity];
      const max = [-Infinity, -Infinity, -Infinity];
      for (const b of boxes) {
        for (let i = 0; i < 3; i++) {
          min[i] = Math.min(min[i], b.center[i] - b.half[i]);
          max[i] = Math.max(max[i], b.center[i] + b.half[i]);
        }
      }
      aim = [0, 1, 2].map((i) => (min[i] + max[i]) / 2);
    }
    if (!aim) return null;
    const dist = entry.opts.distance ?? 3.4;
    // 牆上的東西要正面對著看，不然斜視會先打到隔壁的物件。
    // 用「從房間中央往外」的方向近似物件法線。
    const outLen = Math.hypot(aim[0], aim[2]);
    const normal = outLen > 2.0 ? [aim[0] / outLen, aim[2] / outLen] : null;
    const candidates = [];
    for (const [x, z] of walkable) {
      const d3 = Math.hypot(x - aim[0], 1.62 - aim[1], z - aim[2]);
      if (d3 > dist * 0.82) continue;
      const flat = Math.hypot(x - aim[0], z - aim[2]);
      const pitch = Math.abs(Math.atan2(aim[1] - 1.62, Math.max(flat, 0.25)));
      let oblique = 0;
      if (normal && flat > 0.05) {
        const toSpot = [(x - aim[0]) / flat, (z - aim[2]) / flat];
        // 站在物件的「房間側」（法線反向）才是正面：dot 接近 1
        const dot = toSpot[0] * -normal[0] + toSpot[1] * -normal[1];
        oblique = 1 - dot;                                              // 0 = 正面，2 = 站到背面
      }
      const score = pitch * 1.6 + oblique * 2.4 + Math.abs(d3 - dist * 0.55) * 0.8;
      candidates.push({ spot: [x, z], score });
    }
    candidates.sort((a, b) => a.score - b.score);

    // 真人的做法：如果視線被別的東西擋住（高亮的是別人），就換位置。
    // 這裡直接驗證「從這裡射過去，第一個打到的是不是目標」。
    const avail = ctx.interaction.list().filter((e) => {
      if (e.object.visible === false) return false;
      let p2 = e.object.parent;
      while (p2) { if (p2.visible === false) return false; p2 = p2.parent; }
      return typeof e.opts.enabled !== 'function' || e.opts.enabled();
    });
    const objs = avail.map((e) => e.object);
    const rc = new stub.Raycaster();
    rc.far = 12;
    const entryOf = (obj) => {
      let n = obj;
      while (n && !avail.some((e) => e.object === n)) n = n.parent;
      return n ? avail.find((e) => e.object === n) : null;
    };
    for (const cand of candidates.slice(0, 60)) {
      const origin = [cand.spot[0], 1.62, cand.spot[1]];
      const d = [aim[0] - origin[0], aim[1] - origin[1], aim[2] - origin[2]];
      const len = Math.hypot(...d) || 1;
      rc.ray.origin.set(origin[0], origin[1], origin[2]);
      rc.ray.direction.set(d[0] / len, d[1] / len, d[2] / len);
      const hits = rc.intersectObjects(objs, true);
      if (hits.length && entryOf(hits[0].object) === entry) {
        return { aim, dist, spot: cand.spot, clear: true };
      }
    }
    if (candidates.length) note(`${id}：找不到視線完全乾淨的站位，用最佳評分位置`);
    return { aim, dist, spot: candidates[0]?.spot || null, clear: false };
  }

  /** 把世界座標投影到螢幕（玩家用眼睛看到物件在哪，滑鼠就移到那裡）*/
  function project(aim) {
    const cam = ctx.camera;
    const yaw = ctx.controls.yaw;
    const pitch = ctx.controls.pitch;
    const rel = [aim[0] - cam.position.x, aim[1] - cam.position.y, aim[2] - cam.position.z];
    // 相機基底（YXZ）
    const cy2 = Math.cos(yaw), sy2 = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const right = [cy2, 0, -sy2];
    const up = [sy2 * sp, cp, cy2 * sp];
    const fwd = [-sy2 * cp, sp, -cy2 * cp];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const z = dot(rel, fwd);
    if (z <= 0.08) return null;                       // 在相機後面
    const tanV = Math.tan(((cam.fov || 62) * Math.PI) / 360);
    const tanH = tanV * (cam.aspect || innerWidth / innerHeight);
    const ndcX = (dot(rel, right) / z) / tanH;
    const ndcY = (dot(rel, up) / z) / tanV;
    if (Math.abs(ndcX) > 0.98 || Math.abs(ndcY) > 0.98) return null;   // 在畫面外
    return [((ndcX + 1) / 2) * innerWidth, ((1 - ndcY) / 2) * innerHeight];
  }

  /** 只移動游標，不按鍵（等同玩家把滑鼠移到物件上）*/
  async function movePointer([x, y]) {
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: ++pid, buttons: 0, clientX: x, clientY: y, bubbles: true }));
    await wait(90);
  }

  async function tapAt([x, y]) {
    const id = ++pid;
    canvas.dispatchEvent(new PointerEvent('pointerdown', { button: 0, pointerId: id, clientX: x, clientY: y, bubbles: true }));
    await wait(25);
    window.dispatchEvent(new PointerEvent('pointerup', { button: 0, pointerId: id, clientX: x, clientY: y, bubbles: true }));
    await wait(70);
  }

  /** 走過去 → 轉視角 → 把游標移到物件上 → 點擊 */
  async function goAndTap(id, taps = 1, accept = []) {
    const t = targetOf(id);
    if (!t || !t.spot) { note(`${id}：找不到可站立的位置`); return { ok: false, hovered: null }; }
    const left = await walkPath(t.spot[0], t.spot[1], 0.4);
    await faceTo(t.aim);
    let hovered = null;
    let onScreen = true;
    for (let i = 0; i < taps; i++) {
      await faceTo(t.aim);              // 每次點擊前重新對準（真人靠高亮修正）
      let p = project(t.aim);
      if (!p) { await faceTo(t.aim); p = project(t.aim); }
      if (!p) {
        onScreen = false;
        note(`${id}：物件不在畫面內（相機 ${ctx.camera.position.x.toFixed(1)},${ctx.camera.position.z.toFixed(1)}）`);
        break;
      }
      await movePointer(p);
      hovered = ctx.interaction.hovered?.opts.id || null;
      await tapAt(p);
    }
    const okHover = hovered === id || accept.includes(hovered);
    if (!okHover) {
      const d = Math.hypot(ctx.camera.position.x - t.aim[0], ctx.camera.position.y - t.aim[1], ctx.camera.position.z - t.aim[2]);
      // 自己再射一次線，看是「打不到」還是「打到別的東西」
      const rc = new stub.Raycaster();
      rc.far = 12;
      rc.setFromCamera(ctx.controls.pointerNDC, ctx.camera);
      const objs = ctx.interaction.list().map((e) => e.object);
      const hits = rc.intersectObjects(objs, true).slice(0, 3)
        .map((h) => `${h.object.geometry?.type || '?'}@${h.distance.toFixed(2)}`);
      const entry = ctx.interaction.get(id);
      const gate = typeof entry?.opts.enabled === 'function' ? (entry.opts.enabled() ? '開' : '關') : '無條件';
      note(`${id}：準心對到 ${hovered}｜距離 ${d.toFixed(2)}/${t.dist}｜NDC ${ctx.controls.pointerNDC.x.toFixed(2)},${ctx.controls.pointerNDC.y.toFixed(2)}｜可用性 ${gate}｜互動層 ${ctx.interaction.enabled ? '開' : '關'}｜射線命中 ${hits.join(' ') || '無'}｜controls yaw/pitch ${ctx.controls.yaw.toFixed(2)}/${ctx.controls.pitch.toFixed(2)}｜camera rot ${ctx.camera.rotation.y.toFixed(2)}/${ctx.camera.rotation.x.toFixed(2)}｜aim ${t.aim.map((v) => v.toFixed(2))}｜cam ${ctx.camera.position.x.toFixed(2)},${ctx.camera.position.y.toFixed(2)},${ctx.camera.position.z.toFixed(2)}`);
    }
    return { ok: onScreen && okHover, hovered, walkLeft: +left.toFixed(2) };
  }

  // ── 面板操作 ────────────────────────────────────────────
  const domClick = (sel, filter) => {
    const nodes = [...document.querySelectorAll(sel)];
    const el = filter ? nodes.find((n) => filter(n)) : nodes[0];
    el?.click();
    return !!el;
  };

  async function keypad(code) {
    for (const ch of code) {
      domClick('.keypad-key', (b) => b.textContent === ch);
      await wait(80);
    }
    await wait(450);
  }

  /** 用 ▲ 把清單排成指定標題順序（玩家實際的操作方式）*/
  async function sortList(titles) {
    for (let target = 0; target < titles.length; target++) {
      for (let guard = 0; guard < 8; guard++) {
        const rows = [...document.querySelectorAll('.order-item')];
        const at = rows.findIndex((n) => n.querySelector('.order-title')?.textContent === titles[target]);
        if (at <= target) break;
        rows[at].querySelector('.order-arrows .arrow-btn')?.click();
        await wait(90);
      }
    }
  }

  async function waitFor(fn, maxMs = 20000, tick = 250) {
    const t0 = performance.now();
    while (performance.now() - t0 < maxMs) {
      if (fn()) return true;
      await wait(tick);
    }
    return false;
  }

  /** 開新局並跳過開場旁白 */
  async function start(mode = 'rehearsal') {
    store.newGame(mode);
    document.querySelector('.title-actions .btn--lead')?.click();
    await wait(250);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    await wait(450);
  }

  return {
    store, ctx, stub, canvas, steps, log,
    wait, note, step, faceTo, tapCenter, walkTo, walkPath, pathFind, targetOf, goAndTap, project, movePointer, tapAt,
    domClick, keypad, sortList, waitFor, start,
    objective: () => document.querySelector('.hud-objective')?.textContent || ''
  };
}
