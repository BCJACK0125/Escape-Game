// 可移動表演區（E 區）＋終幕牆（F 區）。
// 這裡有兩個空間性的核心機制：
//   G04 視角合字：線段依「從聚光燈圓點看出去」的透視反推位置，真的會在該點合成數字。
//   G05 腳步序列：靠玩家實際走位觸發，不是點擊。

import THREE from '../core/three.js';
import { ROOM, ANSWERS } from '../config.js';
import { M, footPlateTexture, labelTexture } from './materials.js';
import { damp, deg } from '../core/util.js';

// 觀看點（聚光燈圓點）與視線方向：正對 -Z
export const VIEWPOINT = { x: 0, y: 1.62, z: 3.0 };

// 道具最終位置（還原後）
const PROPS = {
  chair: { x: -0.95, z: 1.7 },
  umbrella: { x: 0.85, z: 1.55 },
  mirror: { x: 1.55, z: 0.6 }
};

// 線段的載體與其到觀看點的深度
const HOSTS = {
  chair: 1.30,
  umbrella: 1.45,
  mirror: 2.40,
  automaton: 4.20,
  wall: 6.95
};

// 數字筆畫：u,v ∈ 0..1（v=0 在上）
const GLYPHS = {
  '1': [[0.5, 0.06, 0.5, 0.94], [0.28, 0.22, 0.5, 0.06], [0.26, 0.94, 0.74, 0.94]],
  '2': [[0.14, 0.24, 0.5, 0.06], [0.5, 0.06, 0.86, 0.26], [0.86, 0.26, 0.14, 0.94], [0.14, 0.94, 0.88, 0.94]],
  '3': [[0.14, 0.08, 0.8, 0.08], [0.8, 0.08, 0.44, 0.46], [0.44, 0.46, 0.84, 0.68], [0.84, 0.68, 0.5, 0.95], [0.5, 0.95, 0.14, 0.84]],
  '4': [[0.72, 0.06, 0.12, 0.66], [0.12, 0.66, 0.92, 0.66], [0.72, 0.06, 0.72, 0.94]],
  '5': [[0.86, 0.08, 0.2, 0.08], [0.2, 0.08, 0.2, 0.46], [0.2, 0.46, 0.76, 0.52], [0.76, 0.52, 0.82, 0.78], [0.82, 0.78, 0.44, 0.95], [0.44, 0.95, 0.14, 0.84]]
};

// 每個數字：角度座標中心、大小、以及每一筆畫的載體
const DIGIT_PLAN = [
  { ch: '2', cx: -0.70, cy: -0.67, w: 0.17, h: 0.30, hosts: 'chair' },
  { ch: '5', cx: -0.38, cy: -0.02, w: 0.17, h: 0.30, hosts: 'wall' },
  { ch: '1', cx: -0.02, cy: -0.02, w: 0.14, h: 0.30, hosts: 'automaton' },
  { ch: '4', cx: 0.28, cy: -0.05, w: 0.17, h: 0.30, hosts: 'wall' },
  { ch: '3', cx: 0.60, cy: -0.29, w: 0.17, h: 0.30, hosts: ['umbrella', 'umbrella', 'umbrella', 'mirror', 'mirror', 'mirror'] }
];

// 腳步感測區：號碼 → 位置
const FOOT_PLATES = [
  { n: 1, x: -1.95, z: 2.45 },
  { n: 2, x: -0.95, z: 1.35 },
  { n: 3, x: 0.0, z: 2.55 },
  { n: 4, x: 0.95, z: 1.35 },
  { n: 5, x: 1.95, z: 2.45 }
];

export function buildStage({ scene, interaction, store, game, controls, room }) {
  const group = new THREE.Group();
  group.name = 'stage';
  scene.add(group);

  const wood = M.wood({ color: 0x6b4a2c });
  const brass = M.brass();

  // ── 椅子 ─────────────────────────────────────────────────
  const chair = new THREE.Group();
  chair.position.set(PROPS.chair.x, 0, PROPS.chair.z);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.05, 0.44), wood);
  seat.position.y = 0.46;
  seat.castShadow = true;
  chair.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.5, 0.05), wood);
  back.position.set(0, 0.72, -0.2);
  chair.add(back);
  for (const [dx, dz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.46, 0.05), wood);
    leg.position.set(dx * 0.19, 0.23, dz * 0.18);
    chair.add(leg);
  }
  group.add(chair);
  controls.addBoxCollider(PROPS.chair.x, PROPS.chair.z, 0.6, 0.6);

  // ── 傘 ──────────────────────────────────────────────────
  const umbrella = new THREE.Group();
  umbrella.position.set(PROPS.umbrella.x, 0, PROPS.umbrella.z);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.16, 16), M.darkMetal());
  stand.position.y = 0.08;
  umbrella.add(stand);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.5, 10), wood);
  shaft.position.y = 0.85;
  umbrella.add(shaft);
  const canopyClosed = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.075, 0.7, 12),
    M.velvet({ color: 0x6b2130 })
  );
  canopyClosed.position.y = 1.2;
  umbrella.add(canopyClosed);
  const canopyOpen = new THREE.Mesh(
    new THREE.ConeGeometry(0.46, 0.3, 16, 1, true),
    M.velvet({ color: 0x7c2233, side: THREE.DoubleSide })
  );
  canopyOpen.position.y = 1.32;
  canopyOpen.visible = false;
  umbrella.add(canopyOpen);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 14, Math.PI), wood);
  handle.position.y = 0.12;
  handle.rotation.z = deg(90);
  umbrella.add(handle);
  group.add(umbrella);

  // ── 立鏡 ────────────────────────────────────────────────
  const mirror = new THREE.Group();
  mirror.position.set(PROPS.mirror.x, 0, PROPS.mirror.z);
  const mirrorFoot = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.24), wood);
  mirrorFoot.position.y = 0.03;
  mirror.add(mirrorFoot);
  const mirrorPivot = new THREE.Group();
  mirrorPivot.position.y = 0.06;
  const mirrorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.62, 0.06), wood);
  mirrorFrame.position.y = 0.81;
  mirrorPivot.add(mirrorFrame);
  const mirrorGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(0.6, 1.46),
    M.mirror({ emissive: 0x131a20, emissiveIntensity: 1 })
  );
  mirrorGlass.position.set(0, 0.81, 0.04);
  mirrorPivot.add(mirrorGlass);
  mirror.add(mirrorPivot);
  group.add(mirror);
  controls.addBoxCollider(PROPS.mirror.x, PROPS.mirror.z, 0.8, 0.4);

  // ── 地面輪廓（G02 後出現，指出道具該有的姿態）──────────────
  const outlines = new THREE.Group();
  outlines.visible = false;
  for (const [key, def] of Object.entries(PROPS)) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 0.34, 28),
      new THREE.MeshBasicMaterial({ color: 0xc8a44d, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(def.x, 0.012, def.z);
    outlines.add(ring);
    const tag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.34, 0.11),
      new THREE.MeshBasicMaterial({
        map: labelTexture({ chair: '椅 · 左', umbrella: '傘 · 開', mirror: '鏡 · 斜' }[key], { w: 340, h: 110, size: 46 }),
        transparent: true, opacity: 0.8
      })
    );
    tag.rotation.x = -Math.PI / 2;
    tag.position.set(def.x, 0.014, def.z + 0.46);
    outlines.add(tag);
  }
  group.add(outlines);

  // ── 聚光燈圓點（G03 完成後亮起）────────────────────────────
  const markerGroup = new THREE.Group();
  markerGroup.position.set(VIEWPOINT.x, 0.013, VIEWPOINT.z);
  const markerRing = new THREE.Mesh(
    new THREE.RingGeometry(0.3, 0.42, 40),
    new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
  );
  markerRing.rotation.x = -Math.PI / 2;
  markerGroup.add(markerRing);
  const markerDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.3, 32),
    new THREE.MeshBasicMaterial({ color: 0xffe9b8, transparent: true, opacity: 0.16 })
  );
  markerDisc.rotation.x = -Math.PI / 2;
  markerGroup.add(markerDisc);
  markerGroup.visible = false;
  group.add(markerGroup);

  // ── 視角合字的線段（G04）──────────────────────────────────
  const strokeGroup = new THREE.Group();
  strokeGroup.visible = false;
  group.add(strokeGroup);

  const strokeMat = new THREE.MeshBasicMaterial({
    color: 0xffdf9a, transparent: true, opacity: 0.55, side: THREE.DoubleSide
  });
  const strokes = [];

  function placeStroke(x1, y1, x2, y2, depth) {
    // 角度座標 → 世界座標：同一深度的兩端落在同一個 z 平面上
    const ax = x1 * depth;
    const ay = VIEWPOINT.y + y1 * depth;
    const bx = x2 * depth;
    const by = VIEWPOINT.y + y2 * depth;
    const len = Math.hypot(bx - ax, by - ay);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.018 * Math.max(1, depth * 0.55)), strokeMat.clone());
    mesh.position.set((ax + bx) / 2, (ay + by) / 2, VIEWPOINT.z - depth);
    mesh.rotation.z = Math.atan2(by - ay, bx - ax);
    strokeGroup.add(mesh);
    strokes.push(mesh);
    return mesh;
  }

  for (const digit of DIGIT_PLAN) {
    const glyph = GLYPHS[digit.ch];
    glyph.forEach((seg, i) => {
      const hostName = Array.isArray(digit.hosts) ? (digit.hosts[i] || digit.hosts[digit.hosts.length - 1]) : digit.hosts;
      const depth = HOSTS[hostName];
      const [u1, v1, u2, v2] = seg;
      placeStroke(
        digit.cx + (u1 - 0.5) * digit.w, digit.cy + (0.5 - v1) * digit.h,
        digit.cx + (u2 - 0.5) * digit.w, digit.cy + (0.5 - v2) * digit.h,
        depth
      );
    });
  }

  // ── 腳步感測區（G05）──────────────────────────────────────
  const plates = FOOT_PLATES.map((def) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.52, 0.52),
      new THREE.MeshStandardMaterial({
        map: footPlateTexture(def.n), transparent: true, opacity: 0.0,
        emissive: 0xc8a44d, emissiveIntensity: 0.0, roughness: 0.9
      })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(def.x, 0.016, def.z);
    group.add(mesh);
    return { ...def, mesh, lit: false };
  });

  // ── 終幕牆：櫃、投影機、兩條幕繩、謝幕站位 ──────────────────
  const finale = new THREE.Group();
  group.add(finale);

  const niche = new THREE.Group();
  niche.position.set(0, 1.1, ROOM.halfD - 0.24);
  const nicheBox = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 1.0, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x120f14, roughness: 0.95, emissive: 0x1a1204, emissiveIntensity: 0 })
  );
  niche.add(nicheBox);
  const nicheDoor = new THREE.Group();
  const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.02, 0.05), M.velvet());
  doorPanel.position.x = -0.75;
  nicheDoor.add(doorPanel);
  nicheDoor.position.set(0.75, 0, -0.22);
  niche.add(nicheDoor);

  const projector = new THREE.Group();
  projector.position.set(0, -0.16, -0.06);
  const projBody = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.24, 0.26), M.darkMetal({ color: 0x2a2730 }));
  projector.add(projBody);
  const projLens = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 16), brass);
  projLens.rotation.x = deg(90);
  projLens.position.set(0, 0, -0.17);
  projector.add(projLens);
  for (const dx of [-0.13, 0.13]) {
    const reelHolder = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 8, 20), brass);
    reelHolder.position.set(dx, 0.19, 0);
    projector.add(reelHolder);
  }
  niche.add(projector);

  // 兩卷影片
  const reels = ['reveal', 'protect'].map((kind, i) => {
    const reel = new THREE.Group();
    reel.position.set(i === 0 ? -0.48 : 0.48, 0.06, 0.0);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.035, 24), M.darkMetal({ color: 0x1e1c22 }));
    disc.rotation.x = deg(90);
    reel.add(disc);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.045, 14), brass);
    hub.rotation.x = deg(90);
    reel.add(hub);
    const tag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.24, 0.09),
      new THREE.MeshStandardMaterial({
        map: labelTexture(kind === 'reveal' ? '公開' : '保護', { w: 260, h: 100, size: 54 }),
        emissive: 0x1a1408, emissiveIntensity: 1.2
      })
    );
    tag.position.set(0, -0.18, 0.02);
    reel.add(tag);
    niche.add(reel);

    interaction.add(reel, {
      id: `reel-${kind}`,
      label: kind === 'reveal' ? '影片 · 公開' : '影片 · 保護',
      hint: '放進投影機',
      distance: 2.2,
      enabled: () => store.isDone('F01') && !store.isDone('F02'),
      onClick: () => game.trigger('F02', { reel: kind })
    });
    return { kind, reel };
  });

  // 櫃內鍵盤（F01）
  const finaleKeypad = new THREE.Group();
  finaleKeypad.position.set(0, 0.3, -0.16);
  const fkPad = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.03), M.darkMetal({ color: 0x23222a }));
  finaleKeypad.add(fkPad);
  const fkScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.3, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x08120c, emissive: 0x35d68a, emissiveIntensity: 0.8 })
  );
  fkScreen.position.set(0, 0.04, 0.018);
  finaleKeypad.add(fkScreen);
  const poem = new THREE.Mesh(
    new THREE.PlaneGeometry(1.3, 0.2),
    new THREE.MeshStandardMaterial({
      map: labelTexture('星先指路　日啟舞台　月最後落幕', { w: 1024, h: 158, size: 62 }),
      emissive: 0x2a2008, emissiveIntensity: 1.2
    })
  );
  poem.position.set(0, 0.42, -0.18);
  niche.add(finaleKeypad, poem);

  niche.visible = false;
  finale.add(niche);

  interaction.add(finaleKeypad, {
    id: 'finale-keypad',
    label: '終幕櫃鍵盤',
    hint: () => (store.isDone('F01') ? '已經解開' : '三位數'),
    distance: 2.2,
    enabled: () => niche.visible,
    onClick: () => game.trigger('F01')
  });

  // 兩條幕繩（F03）
  const pullRopes = [-2.4, 2.4].map((x, i) => {
    const holder = new THREE.Group();
    holder.position.set(x, 0, ROOM.halfD - 0.62);
    const line = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.014, 1.5, 8),
      new THREE.MeshStandardMaterial({ color: 0xd8c9a8, roughness: 1, emissive: 0x1a1610, emissiveIntensity: 1 })
    );
    line.position.y = ROOM.height - 0.9;
    holder.add(line);
    const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 12), brass);
    tassel.position.y = ROOM.height - 1.72;
    holder.add(tassel);
    finale.add(holder);

    interaction.add(tassel, {
      id: `curtain-rope-${i}`,
      label: `幕繩 ${i === 0 ? '左' : '右'}`,
      hint: '兩條要同時受力',
      distance: 2.4,
      enabled: () => store.isDone('F02') && !store.isDone('F03'),
      onClick: () => game.trigger('F03', { rope: i })
    });
    return { holder, tassel, pull: 0, target: 0 };
  });

  // 謝幕站位弧線
  const bowMarks = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI * 0.5 + (i - 2.5) * 0.17;
    const mark = new THREE.Mesh(
      new THREE.RingGeometry(0.12, 0.16, 20),
      new THREE.MeshBasicMaterial({ color: 0xc8a44d, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
    );
    mark.rotation.x = -Math.PI / 2;
    mark.position.set(Math.cos(a) * 2.6 * -1, 0.012, ROOM.halfD - 1.1 + Math.sin(a) * 0.6 + 0.6);
    bowMarks.add(mark);
  }
  bowMarks.visible = false;
  finale.add(bowMarks);

  // 投影畫面（結局播放時亮起）
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(4.2, 2.4),
    new THREE.MeshBasicMaterial({ color: 0xf5e9cf, transparent: true, opacity: 0 })
  );
  screen.position.set(0, 1.7, -ROOM.halfD + 0.08);
  finale.add(screen);

  // ── 狀態 ─────────────────────────────────────────────────
  const state = {
    chair: 'front',      // front | left
    umbrella: 'closed',  // closed | open
    mirror: 'flat'       // flat | tilt
  };
  let markerVisible = false;
  let nicheOpen = 0;
  let curtainOpen = 0;
  let screenGlow = 0;
  let alignment = 0;

  function chairTargetRot() { return state.chair === 'left' ? deg(90) : 0; }
  function mirrorTargetRot() { return state.mirror === 'tilt' ? deg(-30) : 0; }

  const api = {
    group, plates, strokes, markerGroup, state, VIEWPOINT,

    showOutlines(on) { outlines.visible = on; },

    toggleProp(kind) {
      if (kind === 'chair') state.chair = state.chair === 'left' ? 'front' : 'left';
      if (kind === 'umbrella') {
        state.umbrella = state.umbrella === 'open' ? 'closed' : 'open';
        canopyOpen.visible = state.umbrella === 'open';
        canopyClosed.visible = state.umbrella !== 'open';
      }
      if (kind === 'mirror') state.mirror = state.mirror === 'tilt' ? 'flat' : 'tilt';
      return state[kind];
    },

    setProp(kind, value) {
      state[kind] = value;
      if (kind === 'umbrella') {
        canopyOpen.visible = value === 'open';
        canopyClosed.visible = value !== 'open';
      }
    },

    isRestored() {
      return state.chair === ANSWERS.restore.chair
        && state.umbrella === ANSWERS.restore.umbrella
        && state.mirror === ANSWERS.restore.mirror;
    },

    showMarker(on) {
      markerVisible = on;
      markerGroup.visible = on;
    },

    showStrokes(on) { strokeGroup.visible = on; },

    /** 0..1：站得多準 + 看得多正 */
    setAlignment(v) {
      alignment = v;
      strokes.forEach((s, i) => {
        s.material.opacity = 0.4 + v * 0.6;
        s.material.color.setHex(v > 0.98 ? 0xfff3cf : 0xffdf9a);
      });
    },

    lockDigits() {
      strokes.forEach((s) => {
        s.material.opacity = 1;
        s.material.color.setHex(0xfff6dd);
      });
    },

    showPlates(on) {
      plates.forEach((p) => {
        p.mesh.material.opacity = on ? 0.92 : 0;
        p.mesh.material.emissiveIntensity = on ? 0.25 : 0;
      });
    },

    litPlate(n, on = true) {
      const p = plates.find((x) => x.n === n);
      if (!p) return;
      p.lit = on;
      p.mesh.material.emissiveIntensity = on ? 1.8 : 0.25;
    },

    resetPlates() { plates.forEach((p) => api.litPlate(p.n, false)); },

    plateErrorFlash() {
      plates.forEach((p) => {
        p.mesh.material.emissive.setHex(0xff5a4a);
        p.mesh.material.emissiveIntensity = 1.6;
      });
      setTimeout(() => plates.forEach((p) => {
        p.mesh.material.emissive.setHex(0xc8a44d);
        p.mesh.material.emissiveIntensity = 0.25;
      }), 420);
    },

    /** 玩家目前站在哪個腳印上（或 null） */
    plateUnder(x, z) {
      for (const p of plates) {
        if (Math.hypot(x - p.x, z - p.z) < 0.42) return p.n;
      }
      return null;
    },

    openNiche() {
      niche.visible = true;
      nicheOpen = 1;
      nicheBox.material.emissiveIntensity = 0.7;
      fkScreen.material.emissiveIntensity = 1.4;
    },

    showBowMarks(on) { bowMarks.visible = on; },

    pullCurtainRope(i) {
      const r = pullRopes[i];
      if (!r) return;
      r.target = 1;
      setTimeout(() => { r.target = 0; }, 700);
    },

    playFilm() { screenGlow = 1; },
    stopFilm() { screenGlow = 0; },

    openCurtain() {
      curtainOpen = 1;
    },

    update(dt, elapsed) {
      chair.rotation.y = damp(chair.rotation.y, chairTargetRot(), 5, dt);
      mirrorPivot.rotation.y = damp(mirrorPivot.rotation.y, mirrorTargetRot(), 5, dt);
      canopyOpen.scale.setScalar(damp(canopyOpen.scale.x, state.umbrella === 'open' ? 1 : 0.2, 6, dt));

      if (markerVisible) {
        markerRing.material.opacity = 0.4 + Math.sin(elapsed * 2.2) * 0.14;
        markerDisc.material.opacity = 0.12 + Math.sin(elapsed * 2.2) * 0.05;
      }

      nicheDoor.rotation.y = damp(nicheDoor.rotation.y, nicheOpen ? deg(-118) : 0, 2.4, dt);

      pullRopes.forEach((r) => {
        r.pull = damp(r.pull, r.target, 10, dt);
        r.tassel.position.y = ROOM.height - 1.72 - r.pull * 0.5;
        r.holder.children[0].scale.y = 1 + r.pull * 0.32;
      });

      screen.material.opacity = damp(screen.material.opacity, screenGlow * 0.92, 2, dt);
      if (screenGlow > 0) {
        screen.material.color.setRGB(
          0.94 + Math.sin(elapsed * 23) * 0.05,
          0.9 + Math.sin(elapsed * 17) * 0.05,
          0.82
        );
      }

      if (curtainOpen > 0 && room?.curtain) {
        const t = Math.min(1, (room.curtain.userData.open || 0) + dt * 0.28);
        room.curtain.userData.open = t;
        room.curtain.children.forEach((fold, i) => {
          const side = fold.position.x < 0 ? -1 : 1;
          if (fold.geometry.type === 'BoxGeometry') return; // 頂簷不動
          fold.position.x = fold.userData.baseX ?? (fold.userData.baseX = fold.position.x);
          fold.position.x += side * t * 3.2;
          fold.scale.x = 1 - t * 0.35;
        });
      }
    }
  };

  // 還原存檔外觀
  if (store.isDone('G02')) api.showOutlines(true);
  if (store.isDone('G03')) {
    api.setProp('chair', 'left');
    api.setProp('umbrella', 'open');
    api.setProp('mirror', 'tilt');
    api.showMarker(true);
    api.showStrokes(true);
  }
  if (store.isDone('G04')) { api.lockDigits(); api.showPlates(true); }
  if (store.isDone('G05')) api.openNiche();
  if (store.isDone('F02')) api.showBowMarks(true);

  // 三件道具的互動
  interaction.add(chair, {
    id: 'prop-chair',
    label: () => `椅子 · ${state.chair === 'left' ? '朝左' : '朝前'}`,
    hint: '轉一下',
    distance: 2.2,
    enabled: () => store.isDone('G02') && !store.isDone('G03'),
    onClick: () => game.trigger('G03', { prop: 'chair' })
  });
  interaction.add(umbrella, {
    id: 'prop-umbrella',
    label: () => `傘 · ${state.umbrella === 'open' ? '打開' : '收合'}`,
    hint: '開合',
    distance: 2.2,
    enabled: () => store.isDone('G02') && !store.isDone('G03'),
    onClick: () => game.trigger('G03', { prop: 'umbrella' })
  });
  interaction.add(mirror, {
    id: 'prop-mirror',
    label: () => `立鏡 · ${state.mirror === 'tilt' ? '斜轉' : '正面'}`,
    hint: '轉動鏡面',
    distance: 2.4,
    enabled: () => store.isDone('G02') && !store.isDone('G03'),
    onClick: () => game.trigger('G03', { prop: 'mirror' })
  });

  return api;
}
