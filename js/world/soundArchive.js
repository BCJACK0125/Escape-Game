// 聲音檔案區（S 線）：票根電話 → 聲紋唱片 → 五條鐘繩 → 靜默進度 → 月之留言
// 東牆。鐘繩懸在半空，玩家要走到繩子底下才拉得到，讓「距離」也是玩法的一部分。

import THREE from '../core/three.js';
import { ROOM } from '../config.js';
import { M, sigilTexture, labelTexture } from './materials.js';
import { BELL_SPECS } from '../core/audio.js';
import { damp, deg, clamp } from '../core/util.js';

const EAST = ROOM.halfW - 0.05;
const ROPE_X = 4.35;
const ROPE_Z = [-2.7, -2.0, -1.3, -0.6, 0.1];

export function buildSoundArchive({ scene, interaction, store, game, controls }) {
  const group = new THREE.Group();
  group.name = 'sound';
  scene.add(group);

  const wood = M.wood({ color: 0x6b4a2c });
  const brass = M.brass();

  function sideTable(z, w = 0.9, d = 0.66) {
    const t = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(d, 0.06, w), wood);
    top.position.y = 0.78;
    top.receiveShadow = true;
    t.add(top);
    for (const [dx, dz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.78, 0.06), wood);
      leg.position.set(dx * (d / 2 - 0.06), 0.39, dz * (w / 2 - 0.06));
      t.add(leg);
    }
    t.position.set(EAST - d / 2 - 0.05, 0, z);
    group.add(t);
    controls.addBoxCollider(t.position.x, z, d + 0.1, w + 0.1);
    return t;
  }

  // ── 票根電話（S01）────────────────────────────────────────
  const phoneTable = sideTable(-1.6);
  const phone = new THREE.Group();
  phone.position.set(phoneTable.position.x, 0.81, -1.6);
  const phoneBase = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.09, 0.3), M.darkMetal({ color: 0x1d1a1c }));
  phone.add(phoneBase);
  const dialRing = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.017, 8, 26), brass);
  dialRing.rotation.x = deg(90);
  dialRing.position.y = 0.055;
  phone.add(dialRing);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.02, 8), M.glow(0x2a1d06, 0.4));
    hole.position.set(Math.cos(a) * 0.078, 0.058, Math.sin(a) * 0.078);
    phone.add(hole);
  }
  const handset = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.028, 0.26, 10),
    M.darkMetal({ color: 0x241f22 })
  );
  handset.rotation.x = deg(90);
  handset.position.set(0, 0.12, -0.02);
  phone.add(handset);
  group.add(phone);

  // 四張票根
  const stubs = new THREE.Group();
  [[0.06, -1.36], [-0.02, -1.42], [0.1, -1.86], [0.0, -1.92]].forEach(([dx, z], i) => {
    const stub = new THREE.Mesh(
      new THREE.PlaneGeometry(0.16, 0.075),
      M.paper(labelTexture(`票根 ${i + 1}`, { w: 256, h: 120, size: 44, bg: '#e6dcc0', color: '#2b1f14' }))
    );
    stub.rotation.x = -Math.PI / 2;
    stub.rotation.z = deg(-8 + i * 7);
    stub.position.set(phoneTable.position.x + dx, 0.815, z);
    stubs.add(stub);
  });
  group.add(stubs);

  interaction.add(phone, {
    id: 'phone',
    label: '轉盤電話',
    hint: () => (store.isDone('S01') ? '再聽一次留言' : '票根上有座位號'),
    distance: 2.0,
    onClick: () => game.trigger('S01')
  });
  interaction.add(stubs, {
    id: 'ticket-stubs',
    label: '四張票根',
    hint: '拿起來看',
    distance: 2.0,
    onClick: () => game.trigger('S01')
  });

  // ── 聲紋唱片（S02）────────────────────────────────────────
  const gramTable = sideTable(0.8);
  const gram = new THREE.Group();
  gram.position.set(gramTable.position.x, 0.81, 0.8);
  const gramBox = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.34), wood);
  gramBox.position.y = 0.07;
  gram.add(gramBox);
  const platter = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.012, 28), M.darkMetal({ color: 0x14110f }));
  platter.position.y = 0.15;
  gram.add(platter);
  const record = new THREE.Mesh(
    new THREE.CylinderGeometry(0.135, 0.135, 0.004, 32),
    new THREE.MeshStandardMaterial({ color: 0x0d0c0e, roughness: 0.55, emissive: 0x090a0c, emissiveIntensity: 1 })
  );
  record.position.y = 0.158;
  gram.add(record);
  const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.19, 0.42, 20, 1, true), brass);
  horn.position.set(-0.14, 0.36, 0);
  horn.rotation.z = deg(52);
  horn.material.side = THREE.DoubleSide;
  gram.add(horn);
  const tonearm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.012, 0.012), brass);
  tonearm.position.set(0.04, 0.18, 0.08);
  tonearm.rotation.y = deg(-24);
  gram.add(tonearm);
  group.add(gram);

  interaction.add(gram, {
    id: 'gramophone',
    label: '聲紋唱機',
    hint: () => (store.isDone('S01') ? '四段錄音、四張照片' : '沒有唱片可放'),
    distance: 2.0,
    enabled: () => true,
    onClick: () => game.trigger('S02')
  });

  // ── 五條鐘繩（S03）────────────────────────────────────────
  const ropes = ROPE_Z.map((z, i) => {
    const holder = new THREE.Group();
    holder.position.set(ROPE_X, 0, z);

    const anchor = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.06, 12), brass);
    anchor.position.y = ROOM.height - 0.04;
    holder.add(anchor);

    // 鐘體
    const bell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.115, 0.17, 16, 1, true),
      M.brass({ side: THREE.DoubleSide })
    );
    bell.position.y = ROOM.height - 0.16;
    holder.add(bell);

    const rope = new THREE.Mesh(
      new THREE.CylinderGeometry(0.011, 0.011, 1.5, 7),
      new THREE.MeshStandardMaterial({ color: 0xbfae8c, roughness: 1, emissive: 0x181410, emissiveIntensity: 1 })
    );
    rope.position.y = ROOM.height - 1.0;
    holder.add(rope);

    const grip = new THREE.Mesh(new THREE.SphereGeometry(0.052, 14, 10), M.wood({ color: 0x7a5a38 }));
    grip.position.y = ROOM.height - 1.78;
    holder.add(grip);

    // 繩號牌（可替代聽覺：也看得到燈號）
    const tag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.14, 0.14),
      new THREE.MeshStandardMaterial({
        map: labelTexture(String(i + 1), { w: 128, h: 128, size: 92 }),
        emissive: 0x2a2008, emissiveIntensity: 1, transparent: true
      })
    );
    tag.position.set(0, ROOM.height - 1.62, 0.07);
    holder.add(tag);

    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x0e0e12, emissive: BELL_SPECS[i] ? 0xffd08a : 0xffffff, emissiveIntensity: 0 })
    );
    lamp.position.set(0, ROOM.height - 1.42, 0.06);
    holder.add(lamp);

    group.add(holder);

    interaction.add(grip, {
      id: `rope-${i}`,
      label: () => `第 ${i + 1} 條鐘繩 · ${BELL_SPECS[i].name}`,
      hint: '拉下去',
      distance: 2.2,
      enabled: () => store.isDone('S02') || !store.isDone('S03'),
      onClick: () => game.trigger('S03', { rope: i })
    });

    return { holder, rope, grip, bell, lamp, pull: 0, target: 0, swing: 0 };
  });

  // 重播音序的小平台
  const replay = new THREE.Group();
  replay.position.set(EAST - 0.2, 1.15, -2.9);
  const replayPlate = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.34), wood);
  replay.add(replayPlate);
  const replayBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 16), brass);
  replayBtn.rotation.z = deg(90);
  replayBtn.position.x = -0.05;
  replay.add(replayBtn);
  const replayLabel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.32, 0.1),
    new THREE.MeshStandardMaterial({
      map: labelTexture('重播音序', { w: 320, h: 100, size: 48 }),
      emissive: 0x1a1408, emissiveIntensity: 1
    })
  );
  replayLabel.position.set(-0.06, -0.13, 0);
  replayLabel.rotation.y = -Math.PI / 2;
  replay.add(replayLabel);
  group.add(replay);

  interaction.add(replay, {
    id: 'bell-replay',
    label: '重播音序',
    hint: () => (store.isDone('S02') ? '再聽一次唱片給的順序' : '還沒有可播的順序'),
    distance: 2.2,
    onClick: () => game.trigger('S03-replay')
  });

  // ── 耳朵雕塑 + LED 環（S04）───────────────────────────────
  const earGroup = new THREE.Group();
  earGroup.position.set(EAST - 0.28, 1.42, 2.5);
  const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.4, 0.4), M.darkMetal({ color: 0x25232a }));
  pedestal.position.y = -0.72;
  earGroup.add(pedestal);
  const earBase = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.06, 18), brass);
  earBase.position.y = -0.02;
  earGroup.add(earBase);
  // 耳朵：用環與球拼出可辨識的輪廓
  const earOuter = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.035, 10, 22, Math.PI * 1.5), brass);
  earOuter.position.set(0, 0.16, 0);
  earOuter.rotation.set(0, deg(-90), deg(30));
  earGroup.add(earOuter);
  const earInner = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.022, 8, 18, Math.PI * 1.3), brass);
  earInner.position.set(-0.01, 0.14, 0.01);
  earInner.rotation.set(0, deg(-90), deg(10));
  earGroup.add(earInner);
  const earCanal = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), M.darkMetal({ color: 0x0d0c10 }));
  earCanal.position.set(-0.02, 0.12, 0);
  earGroup.add(earCanal);
  group.add(earGroup);

  // LED 環（12 格）
  const ledSegments = [];
  const ledRing = new THREE.Group();
  ledRing.position.set(EAST - 0.02, 1.5, 2.5);
  ledRing.rotation.y = -Math.PI / 2;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const seg = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.11, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x121218, emissive: 0x8fc4ff, emissiveIntensity: 0 })
    );
    seg.position.set(Math.cos(a) * 0.36, Math.sin(a) * 0.36, 0);
    seg.rotation.z = a + Math.PI / 2;
    ledRing.add(seg);
    ledSegments.push(seg);
  }
  group.add(ledRing);

  interaction.add(earGroup, {
    id: 'ear-sculpture',
    label: '耳朵雕塑',
    hint: () => (store.isDone('S04') ? '它已經聽夠了' : '讓房間聽一次寂靜'),
    distance: 2.4,
    onClick: () => game.trigger('S04')
  });

  // ── 暗格 + 迷你留聲機 + 月亮徽記（S05）───────────────────
  const compartment = new THREE.Group();
  compartment.position.set(EAST - 0.2, 0.62, 2.5);
  const hatch = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.34, 0.46), wood);
  compartment.add(hatch);
  const cavity = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.3, 0.42),
    new THREE.MeshStandardMaterial({ color: 0x0b0a0c, roughness: 1, emissive: 0x1a1204, emissiveIntensity: 0 })
  );
  cavity.position.x = -0.16;
  compartment.add(cavity);

  const miniGram = new THREE.Group();
  miniGram.position.set(-0.16, -0.04, 0);
  const mgBox = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.16), M.wood({ color: 0x5c3f24 }));
  miniGram.add(mgBox);
  const mgHorn = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.07, 0.16, 14, 1, true), brass);
  mgHorn.material.side = THREE.DoubleSide;
  mgHorn.position.set(0, 0.11, 0);
  mgHorn.rotation.z = deg(24);
  miniGram.add(mgHorn);
  const mgButton = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.02, 12), M.glow(0x8fc4ff, 0.6));
  mgButton.rotation.z = deg(90);
  mgButton.position.set(-0.08, 0, 0.05);
  miniGram.add(mgButton);
  miniGram.visible = false;
  compartment.add(miniGram);

  const moonSigil = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, 0.02, 28),
    new THREE.MeshStandardMaterial({
      map: sigilTexture('moon'), metalness: 0.5, roughness: 0.4,
      emissive: 0x8fa9c4, emissiveIntensity: 0.7
    })
  );
  moonSigil.rotation.set(deg(90), 0, 0);
  moonSigil.position.set(-0.16, -0.02, 0.14);
  moonSigil.visible = false;
  compartment.add(moonSigil);
  group.add(compartment);

  interaction.add(miniGram, {
    id: 'mini-gramophone',
    label: '迷你留聲機',
    hint: '按下播放',
    distance: 2.0,
    enabled: () => miniGram.visible && !store.hasSigil('moon'),
    onClick: () => game.trigger('S05')
  });
  interaction.add(moonSigil, {
    id: 'moon-sigil',
    label: '月亮徽記',
    hint: '取走',
    distance: 2.0,
    enabled: () => moonSigil.visible && !store.hasSigil('moon'),
    onClick: () => game.trigger('S05-take')
  });

  // ── 狀態 ─────────────────────────────────────────────────
  let hatchOpen = 0;
  let silence = 0;

  const api = {
    group, ropes, ledSegments,

    pullRope(i) {
      const r = ropes[i];
      if (!r) return;
      r.target = 1;
      r.swing = 1;
      setTimeout(() => { r.target = 0; }, 260);
    },

    flashRope(i, on = true) {
      const r = ropes[i];
      if (r) r.lamp.material.emissiveIntensity = on ? 2.6 : 0;
    },

    /** 給「看燈號」的替代玩法：依序閃燈 */
    async showSequenceLights(sequence, interval = 620) {
      for (const n of sequence) {
        api.flashRope(n - 1, true);
        await new Promise((r) => setTimeout(r, interval * 0.6));
        api.flashRope(n - 1, false);
        await new Promise((r) => setTimeout(r, interval * 0.4));
      }
    },

    errorFlash() {
      ropes.forEach((r) => {
        r.lamp.material.emissive.setHex(0xff5a4a);
        r.lamp.material.emissiveIntensity = 2.4;
      });
      setTimeout(() => ropes.forEach((r) => {
        r.lamp.material.emissive.setHex(0xffd08a);
        r.lamp.material.emissiveIntensity = 0;
      }), 420);
    },

    setSilenceProgress(p) {
      silence = clamp(p, 0, 1);
      const lit = Math.round(silence * 12);
      ledSegments.forEach((seg, i) => {
        seg.material.emissiveIntensity = i < lit ? 2.2 : 0;
        seg.material.emissive.setHex(i < lit ? 0x8fc4ff : 0x8fc4ff);
      });
    },

    openCompartment() {
      hatchOpen = 1;
      miniGram.visible = true;
      cavity.material.emissiveIntensity = 0.9;
      ledSegments.forEach((s) => { s.material.emissiveIntensity = 2.2; });
    },

    revealMoonSigil() { moonSigil.visible = true; },
    takeMoonSigil() { moonSigil.visible = false; },

    update(dt, elapsed) {
      ropes.forEach((r, i) => {
        r.pull = damp(r.pull, r.target, 14, dt);
        r.rope.scale.y = 1 + r.pull * 0.16;
        r.rope.position.y = ROOM.height - 1.0 - r.pull * 0.12;
        r.grip.position.y = ROOM.height - 1.78 - r.pull * 0.24;
        if (r.swing > 0) {
          r.swing = Math.max(0, r.swing - dt * 0.8);
          r.bell.rotation.z = Math.sin(elapsed * 16) * 0.14 * r.swing;
        }
      });
      hatch.rotation.y = damp(hatch.rotation.y, hatchOpen ? deg(-96) : 0, 3, dt);
      hatch.position.z = damp(hatch.position.z, hatchOpen ? -0.22 : 0, 3, dt);
      if (moonSigil.visible) {
        moonSigil.rotation.z += dt * 0.7;
        moonSigil.position.y = -0.02 + Math.sin(elapsed * 1.8) * 0.01;
      }
      if (silence > 0 && silence < 1) {
        ledSegments.forEach((seg, i) => {
          if (i < Math.round(silence * 12)) seg.material.emissiveIntensity = 1.8 + Math.sin(elapsed * 5 + i) * 0.4;
        });
      }
    }
  };

  // 還原存檔外觀
  if (store.isDone('S04')) api.openCompartment();
  if (store.isDone('S05')) api.revealMoonSigil();
  if (store.hasSigil('moon')) api.takeMoonSigil();

  return api;
}
