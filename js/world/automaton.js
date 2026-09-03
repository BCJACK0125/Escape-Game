// 中央自動機（B 區）：三線合流點。
// 胸前三個徽記槽（G01）、左側腹魔杖凹槽（M05）、右臂遞出排練日誌（G02）。

import THREE from '../core/three.js';
import { M, sigilTexture } from './materials.js';
import { damp, deg } from '../core/util.js';

const POS = { x: 0, z: -1.2 };

export function buildAutomaton({ scene, interaction, store, game, controls }) {
  const group = new THREE.Group();
  group.position.set(POS.x, 0, POS.z);
  scene.add(group);

  const brass = M.brass();
  const dark = M.darkMetal();

  // 底座
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.72, 0.24, 24), dark);
  base.position.y = 0.12;
  base.receiveShadow = true;
  group.add(base);
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.54, 0.32, 20), brass);
  plinth.position.y = 0.4;
  group.add(plinth);

  // 軀幹
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.86, 0.46), brass);
  torso.position.y = 1.0;
  torso.castShadow = true;
  group.add(torso);

  // 胸腔玻璃與齒輪
  const chestGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.3), M.glass({ opacity: 0.3 }));
  chestGlass.position.set(0, 1.02, 0.24);
  group.add(chestGlass);
  const gears = [];
  for (const [gx, gy, r, teeth] of [[-0.08, 1.02, 0.11, 12], [0.09, 0.96, 0.08, 9], [0.05, 1.14, 0.06, 8]]) {
    const gear = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.02, 18), brass);
    disc.rotation.x = Math.PI / 2;
    gear.add(disc);
    for (let i = 0; i < teeth; i++) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, 0.022), brass);
      const a = (i / teeth) * Math.PI * 2;
      t.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
      t.rotation.z = a;
      gear.add(t);
    }
    gear.position.set(gx, gy, 0.2);
    gear.userData.speed = (0.4 + Math.random() * 0.5) * (Math.random() > 0.5 ? 1 : -1);
    gears.push(gear);
    group.add(gear);
  }

  // 頭部與眼睛
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 18), brass);
  head.position.y = 1.62;
  head.castShadow = true;
  group.add(head);
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.26, 20), dark);
  hat.position.y = 1.84;
  group.add(hat);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.02, 24), dark);
  brim.position.y = 1.71;
  group.add(brim);

  const eyes = [];
  for (const sx of [-0.09, 0.09]) {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x120e08, emissive: 0xffb347, emissiveIntensity: 0 })
    );
    eye.position.set(sx, 1.64, 0.21);
    eyes.push(eye);
    group.add(eye);
  }

  // 手臂
  function arm(sx) {
    const g = new THREE.Group();
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.42, 12), brass);
    upper.position.set(0, -0.21, 0);
    g.add(upper);
    const fore = new THREE.Group();
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.38, 12), brass);
    lower.position.set(0, -0.19, 0);
    fore.add(lower);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), brass);
    hand.position.set(0, -0.4, 0);
    fore.add(hand);
    fore.position.y = -0.42;
    g.add(fore);
    g.position.set(sx * 0.4, 1.34, 0);
    group.add(g);
    return { root: g, fore, hand };
  }
  const leftArm = arm(-1);
  const rightArm = arm(1);
  rightArm.root.rotation.z = deg(6);

  // 排練日誌（G01 完成後遞出）
  const journal = new THREE.Group();
  const bookBody = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.32), M.wood({ color: 0x6d4a2c }));
  const bookPages = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.03, 0.3),
    new THREE.MeshStandardMaterial({ color: 0xe6dcc0, roughness: 0.9, emissive: 0x1a1712, emissiveIntensity: 1 })
  );
  bookPages.position.y = 0.02;
  journal.add(bookBody, bookPages);
  journal.position.set(0.4, 0.92, 0.22);
  journal.rotation.x = deg(-8);
  journal.visible = false;
  group.add(journal);

  // ── 胸前三個徽記槽 ─────────────────────────────────────────
  const slotDefs = [
    { kind: 'sun', x: -0.19 },
    { kind: 'moon', x: 0 },
    { kind: 'star', x: 0.19 }
  ];
  const slots = {};
  for (const def of slotDefs) {
    const holder = new THREE.Group();
    holder.position.set(def.x, 1.32, 0.235);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.012, 8, 24), brass);
    holder.add(ring);
    const backing = new THREE.Mesh(
      new THREE.CircleGeometry(0.058, 24),
      new THREE.MeshStandardMaterial({ color: 0x0d0a10, roughness: 0.9, emissive: 0x000000 })
    );
    backing.position.z = -0.004;
    holder.add(backing);
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(0.055, 24),
      new THREE.MeshStandardMaterial({
        map: sigilTexture(def.kind), roughness: 0.5, metalness: 0.3,
        emissive: 0xf0d48a, emissiveIntensity: 0.25
      })
    );
    disc.position.z = 0.006;
    disc.visible = false;
    holder.add(disc);
    group.add(holder);
    slots[def.kind] = { holder, ring, disc, backing };
  }

  // ── 左側腹凹槽（M05）────────────────────────────────────────
  const sideHatch = new THREE.Group();
  sideHatch.position.set(-0.35, 1.0, 0);
  const hatchDoor = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.42, 0.3), dark);
  sideHatch.add(hatchDoor);
  const hatchInner = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.36, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: 0x8fb7d8, emissiveIntensity: 0 })
  );
  hatchInner.position.x = -0.02;
  hatchInner.visible = false;
  sideHatch.add(hatchInner);
  group.add(sideHatch);

  // ── 互動註冊 ──────────────────────────────────────────────
  const chestTarget = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.34, 0.06),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  chestTarget.position.set(0, 1.32, 0.26);
  chestTarget.userData.__noHighlight = true;
  group.add(chestTarget);

  interaction.add(chestTarget, {
    id: 'automaton-chest',
    label: () => (store.isDone('G01') ? '中央自動機' : `徽記槽（${store.sigilCount()} / 3）`),
    hint: () => (store.isDone('G01') ? '它已經醒了' : '放入太陽、月亮、星星'),
    distance: 2.2,
    onClick: () => game.trigger('G01')
  });

  interaction.add(sideHatch, {
    id: 'automaton-side',
    label: '自動機側腹',
    hint: () => (store.isDone('M04') ? '放入魔杖' : '紋風不動'),
    distance: 2.0,
    onClick: () => game.trigger('M05')
  });

  interaction.add(journal, {
    id: 'automaton-journal',
    label: '排練日誌',
    hint: '比較三個版本',
    distance: 2.2,
    onClick: () => game.trigger('G02')
  });

  controls.addBoxCollider(POS.x, POS.z, 1.5, 1.5);

  // ── 狀態動畫 ──────────────────────────────────────────────
  let eyeLevel = 0;
  let eyeTarget = 0;
  let gearSpeed = 0;
  let gearTarget = 0;
  let nodTimer = 0;
  let journalOut = 0;
  let journalTarget = 0;

  const api = {
    group, slots, eyes, journal,

    setSlot(kind, filled) {
      const slot = slots[kind];
      if (!slot) return;
      slot.disc.visible = filled;
      slot.backing.material.emissive.setHex(filled ? 0x2a2008 : 0x000000);
      slot.backing.material.emissiveIntensity = filled ? 1.2 : 0;
      if (filled) {
        eyeTarget = Math.min(1, eyeTarget + 0.34);
        gearTarget = Math.max(gearTarget, 0.35);
      }
    },

    awaken() {
      eyeTarget = 1;
      gearTarget = 1;
      nodTimer = 1.4;
    },

    offerJournal() {
      journal.visible = true;
      journalTarget = 1;
      gearTarget = Math.max(gearTarget, 0.6);
    },

    takeJournal() { journalTarget = 0; },

    openSide() {
      hatchInner.visible = true;
      hatchInner.material.emissiveIntensity = 1.6;
      gearTarget = Math.max(gearTarget, 0.5);
    },

    setWandInSlot() {
      hatchInner.material.emissive.setHex(0xf0d48a);
      hatchInner.material.emissiveIntensity = 2.2;
    },

    nod() { nodTimer = 1.2; },

    update(dt, elapsed) {
      eyeLevel = damp(eyeLevel, eyeTarget, 4, dt);
      const flicker = eyeTarget > 0 ? 1 + Math.sin(elapsed * 9.1) * 0.08 : 1;
      eyes.forEach((e) => { e.material.emissiveIntensity = eyeLevel * 2.6 * flicker; });

      gearSpeed = damp(gearSpeed, gearTarget, 2.5, dt);
      gears.forEach((g) => { g.rotation.z += g.userData.speed * gearSpeed * dt; });

      // 點頭
      if (nodTimer > 0) {
        nodTimer -= dt;
        head.position.y = 1.62 - Math.abs(Math.sin(nodTimer * 6)) * 0.05;
        hat.position.y = 1.84 - Math.abs(Math.sin(nodTimer * 6)) * 0.05;
        brim.position.y = 1.71 - Math.abs(Math.sin(nodTimer * 6)) * 0.05;
      }

      journalOut = damp(journalOut, journalTarget, 3, dt);
      rightArm.root.rotation.x = -journalOut * deg(52);
      rightArm.fore.rotation.x = journalOut * deg(28);
      journal.position.set(0.4, 0.92 + journalOut * 0.16, 0.22 + journalOut * 0.42);
      journal.visible = journalOut > 0.05;

      // 待機時肩膀極輕微起伏，像有呼吸
      leftArm.root.rotation.x = Math.sin(elapsed * 0.7) * 0.02 * (0.3 + eyeLevel);
    }
  };

  // 讀取存檔時把外觀補回來
  Object.keys(slots).forEach((k) => { if (store.hasSigil(k) && store.isDone('G01')) api.setSlot(k, true); });
  if (store.isDone('G01')) { api.awaken(); }
  if (store.isDone('M04')) api.openSide();
  if (store.isDone('M05')) api.setWandInSlot();
  if (store.isDone('G01') && !store.isDone('G02')) api.offerJournal();

  return api;
}
