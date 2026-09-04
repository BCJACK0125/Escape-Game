// 第一人稱控制：WASD 移動 + 滑鼠拖曳環顧（可選擇鎖定滑鼠）。
// 碰撞用 XZ 平面的 AABB 清單解算，分軸處理，避免卡牆。
// 另外對外提供 idleTime / isMoving，給「靜默感測」謎題使用。

import THREE from './three.js';
import { PLAYER, ROOM } from '../config.js';
import { clamp, damp } from './util.js';

const FORWARD = new THREE.Vector3();
const RIGHT = new THREE.Vector3();

export function createControls({ camera, dom, engine, store }) {
  const keys = new Set();
  const colliders = [];   // { minX, maxX, minZ, maxZ, tall? }
  const velocity = new THREE.Vector3();
  const tapHandlers = new Set();

  let yaw = PLAYER.spawn.yaw;
  let pitch = 0;
  let enabled = true;
  let locked = false;
  let bobPhase = 0;
  let idleTime = 0;
  let moving = false;
  let frozen = false;      // 過場動畫用：完全停止輸入但保留視角

  // 螢幕搖桿的移動軸（與鍵盤疊加）
  const moveAxis = { x: 0, z: 0 };
  // 觸控時把準心歸回畫面中央，讓「互動」鈕與準心一致
  let centerRest = false;

  // 拖曳狀態
  let dragPointerId = null;
  let dragging = false;
  let dragStart = { x: 0, y: 0, t: 0 };
  let dragMoved = 0;
  const pointerNDC = new THREE.Vector2(0, 0);

  const sens = () => (store?.settings?.sensitivity ?? 1);

  function markInput() { idleTime = 0; }

  // ── 鍵盤 ──────────────────────────────────────────────────
  function onKeyDown(e) {
    if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
    keys.add(e.code);
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft'].includes(e.code)) {
      markInput();
      if (e.code.startsWith('Arrow')) e.preventDefault();
    }
  }
  function onKeyUp(e) { keys.delete(e.code); }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => keys.clear());

  // ── 指標 ──────────────────────────────────────────────────
  function updateNDC(e) {
    pointerNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointerNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
  }

  function onPointerDown(e) {
    if (e.button !== 0) return;
    if (dragPointerId !== null) return;     // 已有手指在轉視角，第二根手指不搶
    dragPointerId = e.pointerId;
    dragging = true;
    dragMoved = 0;
    dragStart = { x: e.clientX, y: e.clientY, t: performance.now() };
    updateNDC(e);
    try { dom.setPointerCapture?.(e.pointerId); } catch { /* 沒有作用中的指標時忽略 */ }
  }

  function onPointerMove(e) {
    if (locked) {
      if (!enabled || frozen) return;
      const dx = e.movementX || 0;
      const dy = e.movementY || 0;
      if (Math.abs(dx) + Math.abs(dy) > 1) markInput();
      yaw -= dx * PLAYER.lockLookSpeed * sens();
      pitch -= dy * PLAYER.lockLookSpeed * sens() * (store?.settings?.invertY ? -1 : 1);
      pitch = clamp(pitch, -PLAYER.pitchLimit, PLAYER.pitchLimit);
      return;
    }
    if (dragPointerId !== null && e.pointerId !== dragPointerId) return;
    updateNDC(e);
    if (!dragging || !enabled || frozen) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    dragMoved = Math.max(dragMoved, Math.abs(dx) + Math.abs(dy));
    if (dragMoved > 3) {
      markInput();
      dom.classList.add('dragging');
    }
    yaw -= dx * PLAYER.lookSpeed * sens();
    pitch -= dy * PLAYER.lookSpeed * sens() * (store?.settings?.invertY ? -1 : 1);
    pitch = clamp(pitch, -PLAYER.pitchLimit, PLAYER.pitchLimit);
    dragStart.x = e.clientX;
    dragStart.y = e.clientY;
  }

  function onPointerUp(e) {
    if (!locked && dragPointerId !== null && e.pointerId !== dragPointerId) return;
    dragPointerId = null;
    const wasDrag = dragMoved > 6;
    const quick = performance.now() - dragStart.t < 450;
    dragging = false;
    dom.classList.remove('dragging');
    try { dom.releasePointerCapture?.(e.pointerId); } catch { /* 同上 */ }
    if (e.button !== 0) return;
    if (!enabled || frozen) return;          // 過場中不接受點擊
    if (locked || (!wasDrag && quick)) {
      markInput();
      for (const fn of tapHandlers) {
        try { fn({ ndc: locked ? new THREE.Vector2(0, 0) : pointerNDC.clone(), event: e }); }
        catch (err) { console.error('[tap]', err); }
      }
    }
    if (centerRest && !locked) pointerNDC.set(0, 0);
  }

  dom.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  dom.addEventListener('contextmenu', (e) => e.preventDefault());

  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === dom;
    document.documentElement.classList.toggle('pointer-locked', locked);
  });

  // ── 碰撞 ──────────────────────────────────────────────────
  function collides(x, z) {
    const r = PLAYER.radius;
    if (x < -ROOM.halfW + r || x > ROOM.halfW - r) return true;
    if (z < -ROOM.halfD + r || z > ROOM.halfD - r) return true;
    for (const b of colliders) {
      if (x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r) return true;
    }
    return false;
  }

  function update(dt) {
    idleTime += dt;

    let ax = 0, az = 0;
    if (enabled && !frozen) {
      if (keys.has('KeyW') || keys.has('ArrowUp')) az += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) az -= 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) ax -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) ax += 1;
    }

    if (enabled && !frozen) {
      ax = clamp(ax + moveAxis.x, -1, 1);
      az = clamp(az + moveAxis.z, -1, 1);
    }

    const running = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;

    FORWARD.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    RIGHT.set(Math.cos(yaw), 0, -Math.sin(yaw));

    const wish = new THREE.Vector3()
      .addScaledVector(FORWARD, az)
      .addScaledVector(RIGHT, ax);
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed);

    velocity.x = damp(velocity.x, wish.x, wish.lengthSq() > 0 ? PLAYER.accel : PLAYER.damping, dt);
    velocity.z = damp(velocity.z, wish.z, wish.lengthSq() > 0 ? PLAYER.accel : PLAYER.damping, dt);

    const nx = camera.position.x + velocity.x * dt;
    const nz = camera.position.z + velocity.z * dt;
    if (!collides(nx, camera.position.z)) camera.position.x = nx; else velocity.x = 0;
    if (!collides(camera.position.x, nz)) camera.position.z = nz; else velocity.z = 0;

    const planarSpeed = Math.hypot(velocity.x, velocity.z);
    moving = planarSpeed > 0.25;

    // 走路晃動：只有真的在動才累積相位，停下時平滑歸零
    bobPhase += planarSpeed * dt * PLAYER.bobSpeed;
    const bob = Math.sin(bobPhase) * PLAYER.bobAmount * Math.min(1, planarSpeed / PLAYER.walkSpeed);
    camera.position.y = damp(camera.position.y, PLAYER.eyeHeight + bob, 14, dt);

    camera.rotation.set(pitch, yaw, 0, 'YXZ');
  }

  engine.onUpdate(update);

  return {
    get enabled() { return enabled; },
    set enabled(v) { enabled = v; if (!v) { keys.clear(); velocity.set(0, 0, 0); } },
    get frozen() { return frozen; },
    set frozen(v) { frozen = v; },
    get locked() { return locked; },
    get moving() { return moving; },
    get idleTime() { return idleTime; },
    get pointerNDC() { return pointerNDC; },
    get yaw() { return yaw; },
    get pitch() { return pitch; },
    keys,
    markInput,
    /** 螢幕搖桿：x 為左右、z 為前後，範圍 -1..1 */
    setMoveAxis(x, z) {
      moveAxis.x = clamp(x, -1, 1);
      moveAxis.z = clamp(z, -1, 1);
      if (Math.abs(x) + Math.abs(z) > 0.05) markInput();
    },
    clearMoveAxis() { moveAxis.x = 0; moveAxis.z = 0; },
    setCenterRest(v) {
      centerRest = !!v;
      if (v) pointerNDC.set(0, 0);
    },
    onTap(fn) { tapHandlers.add(fn); return () => tapHandlers.delete(fn); },
    addCollider(box) { colliders.push(box); },
    get colliders() { return colliders.slice(); },
    /** 這個座標玩家站不站得進去（測試與導引用） */
    canStand(x, z) { return !collides(x, z); },
    addBoxCollider(cx, cz, sx, sz) {
      colliders.push({ minX: cx - sx / 2, maxX: cx + sx / 2, minZ: cz - sz / 2, maxZ: cz + sz / 2 });
    },
    clearColliders() { colliders.length = 0; },
    lockPointer() { dom.requestPointerLock?.(); },
    unlockPointer() { document.exitPointerLock?.(); },
    toggleLock() { locked ? this.unlockPointer() : this.lockPointer(); },
    teleport(x, z, newYaw) {
      camera.position.x = x;
      camera.position.z = z;
      if (typeof newYaw === 'number') yaw = newYaw;
      velocity.set(0, 0, 0);
    },
    lookAt(target) {
      const dx = target.x - camera.position.x;
      const dz = target.z - camera.position.z;
      yaw = Math.atan2(-dx, -dz);
      pitch = 0;
    },
    distanceTo(x, z) { return Math.hypot(camera.position.x - x, camera.position.z - z); }
  };
}
