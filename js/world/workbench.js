// 機關工作檯（M 線）：天平 → 磁取杖尖 → 組裝魔杖 → 感測牆 → 星之核心
// 西牆南段。感測牆的節點位置本身就是線索：面對牆時「最上是北、最右是東」。

import THREE from '../core/three.js';
import { ROOM } from '../config.js';
import { M, rehearsalSheetTexture, labelTexture } from './materials.js';
import { damp, deg } from '../core/util.js';

const WEST = -ROOM.halfW + 0.05;

// 感測牆節點：[z, y, 方位]；面對西牆時 z 越小＝越靠玩家右手邊
const NODES_POS = [
  [1.2, 2.20, 'N'],
  [0.45, 1.62, 'E'],
  [1.2, 1.04, 'S'],
  [1.95, 1.62, 'W'],
  [0.68, 2.02, null],
  [1.72, 2.02, null],
  [0.68, 1.22, null],
  [1.72, 1.22, null]
];

export function buildWorkbench({ scene, interaction, store, game, controls }) {
  const group = new THREE.Group();
  group.name = 'workbench';
  scene.add(group);

  const wood = M.wood({ color: 0x6b4a2c });
  const brass = M.brass();

  // ── 工作檯 ────────────────────────────────────────────────
  const bench = new THREE.Group();
  bench.position.set(WEST + 0.42, 0, 0.6);
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.08, 2.0), wood);
  top.position.y = 0.86;
  top.receiveShadow = true;
  bench.add(top);
  const apron = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.24, 1.9), M.wood({ color: 0x4d3722 }));
  apron.position.y = 0.7;
  bench.add(apron);
  for (const dz of [-0.88, 0.88]) {
    for (const dx of [-0.32, 0.32]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.82, 0.08), wood);
      leg.position.set(dx, 0.41, dz);
      bench.add(leg);
    }
  }
  group.add(bench);
  controls.addBoxCollider(bench.position.x, bench.position.z, 0.9, 2.1);

  // 牆上排練單
  const sheet = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 0.46),
    M.paper(rehearsalSheetTexture())
  );
  sheet.position.set(WEST + 0.02, 1.62, 0.0);
  sheet.rotation.y = Math.PI / 2;
  group.add(sheet);
  interaction.add(sheet, {
    id: 'rehearsal-sheet',
    label: '排練單',
    hint: '道具的重量關係',
    distance: 2.2,
    onClick: () => game.trigger('M01-sheet')
  });

  // ── 天平（M01）────────────────────────────────────────────
  const balance = new THREE.Group();
  balance.position.set(bench.position.x, 0.9, -0.12);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.34, 12), brass);
  column.position.y = 0.17;
  balance.add(column);
  const beam = new THREE.Group();
  beam.position.y = 0.34;
  const beamBar = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.62), brass);
  beam.add(beamBar);
  const pans = [];
  for (const dz of [-0.3, 0.3]) {
    const pan = new THREE.Group();
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.075, 0.02, 18), brass);
    pan.add(dish);
    for (const a of [0, Math.PI * 0.66, Math.PI * 1.33]) {
      const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.14, 4), brass);
      wire.position.set(Math.cos(a) * 0.07, 0.07, Math.sin(a) * 0.07);
      wire.rotation.z = Math.cos(a) * 0.4;
      wire.rotation.x = -Math.sin(a) * 0.4;
      pan.add(wire);
    }
    pan.position.set(0, -0.14, dz);
    beam.add(pan);
    pans.push(pan);
  }
  balance.add(beam);
  group.add(balance);

  interaction.add(balance, {
    id: 'balance',
    label: '道具天平',
    hint: () => (store.isDone('M01') ? '鎖扣已經開了' : '兩側放上道具'),
    distance: 2.0,
    onClick: () => game.trigger('M01')
  });

  // 四個道具模型（放在檯面上，視覺提示）
  const propModels = new THREE.Group();
  const propDefs = [
    { name: '兔', z: 0.42, geo: new THREE.SphereGeometry(0.055, 14, 10), color: 0xd8cfc0 },
    { name: '鴿', z: 0.62, geo: new THREE.ConeGeometry(0.05, 0.11, 12), color: 0xe4e2dc },
    { name: '帽', z: 0.82, geo: new THREE.CylinderGeometry(0.055, 0.065, 0.07, 16), color: 0x1e1a1f },
    { name: '硬幣', z: 1.0, geo: new THREE.CylinderGeometry(0.035, 0.035, 0.012, 18), color: 0xc8a44d }
  ];
  for (const def of propDefs) {
    const mesh = new THREE.Mesh(def.geo, new THREE.MeshStandardMaterial({
      color: def.color, roughness: 0.6, metalness: def.name === '硬幣' ? 0.9 : 0.1,
      emissive: 0x0e0c0a, emissiveIntensity: 1
    }));
    mesh.position.set(bench.position.x - 0.12, 0.94, def.z);
    propModels.add(mesh);
  }
  group.add(propModels);

  // ── 玻璃櫃（M02）──────────────────────────────────────────
  const cabinet = new THREE.Group();
  cabinet.position.set(WEST + 0.34, 0, 2.3);
  const cabBody = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.1, 0.9), M.wood({ color: 0x4a3520 }));
  cabBody.position.y = 0.55;
  cabinet.add(cabBody);
  const cabGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.7), M.glass({ opacity: 0.24 }));
  cabGlass.position.set(0.31, 0.72, 0);
  cabGlass.rotation.y = Math.PI / 2;
  cabinet.add(cabGlass);
  const cabTop = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.05, 0.96), wood);
  cabTop.position.y = 1.12;
  cabinet.add(cabTop);
  // 內部的杖尖
  const wandTip = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.16, 10), brass);
  wandTip.position.set(0.02, 0.74, -0.24);
  wandTip.rotation.z = deg(90);
  cabinet.add(wandTip);
  const keyhole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.04, 10), M.darkMetal());
  keyhole.rotation.z = deg(90);
  keyhole.position.set(0.31, 0.5, 0.34);
  cabinet.add(keyhole);
  group.add(cabinet);
  controls.addBoxCollider(cabinet.position.x, cabinet.position.z, 0.7, 1.0);

  interaction.add(cabinet, {
    id: 'glass-case',
    label: '玻璃櫃',
    hint: () => (store.hasItem('case-key') ? '用磁鐵把杖尖帶出來' : '鎖著'),
    distance: 2.2,
    onClick: () => game.trigger('M02')
  });

  // ── 三段魔杖（M03）────────────────────────────────────────
  const wandParts = new THREE.Group();
  wandParts.position.set(bench.position.x + 0.06, 0.92, 1.42);
  const segs = [];
  for (let i = 0; i < 3; i++) {
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.019, 0.019, 0.2, 12),
      M.wood({ color: 0x3a2a1a })
    );
    seg.rotation.z = deg(90);
    seg.position.set(0, 0, -0.22 + i * 0.22);
    // 刻痕
    const notch = new THREE.Mesh(new THREE.BoxGeometry(0.021, 0.006, 0.03), M.brass());
    notch.position.set(0, 0.019, 0);
    seg.add(notch);
    wandParts.add(seg);
    segs.push(seg);
  }
  group.add(wandParts);

  interaction.add(wandParts, {
    id: 'wand-parts',
    hitBox: [0.32, 0.22, 0.78],
    label: () => (store.hasItem('wand') ? '完整魔杖' : '三段魔杖'),
    hint: () => (store.hasItem('wand-tip') ? '轉動各段對齊木紋' : '缺了最後一段'),
    distance: 2.0,
    onClick: () => game.trigger('M03')
  });

  // ── 感測牆節點（M04）──────────────────────────────────────
  const nodeMeshes = [];
  const constellation = new THREE.Group();
  group.add(constellation);
  NODES_POS.forEach(([z, y, dir], i) => {
    const node = new THREE.Group();
    node.position.set(WEST + 0.02, y, z);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.01, 8, 20), brass);
    ring.rotation.y = Math.PI / 2;
    node.add(ring);
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 14, 10),
      new THREE.MeshStandardMaterial({ color: 0x14121a, emissive: 0x9fb7d8, emissiveIntensity: 0.25 })
    );
    node.add(core);
    constellation.add(node);
    nodeMeshes.push({ node, core, dir });

    interaction.add(node, {
      id: `constellation-${i}`,
      label: '星座節點',
      hint: () => (store.hasItem('wand') ? '用杖尖碰觸' : '需要完整的魔杖'),
      distance: 2.2,
      hitBox: [0.16, 0.2, 0.2],
      enabled: () => !store.isDone('M04'),
      onClick: () => game.trigger('M04', { dir, index: i })
    });
  });

  // 節點之間的連線（星座感）
  const linkMat = new THREE.LineBasicMaterial({ color: 0x3d4a63, transparent: true, opacity: 0.5 });
  const linkPairs = [[0, 4], [4, 1], [1, 6], [6, 2], [2, 7], [7, 3], [3, 5], [5, 0]];
  for (const [a, b] of linkPairs) {
    const pa = NODES_POS[a];
    const pb = NODES_POS[b];
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(WEST + 0.015, pa[1], pa[0]),
      new THREE.Vector3(WEST + 0.015, pb[1], pb[0])
    ]);
    constellation.add(new THREE.Line(geo, linkMat));
  }

  const wallPlate = new THREE.Mesh(
    new THREE.PlaneGeometry(0.8, 0.2),
    new THREE.MeshStandardMaterial({
      map: labelTexture('感測牆', { w: 400, h: 100, size: 52 }),
      emissive: 0x1a1408, emissiveIntensity: 1
    })
  );
  wallPlate.position.set(WEST + 0.02, 0.6, 1.2);
  wallPlate.rotation.y = Math.PI / 2;
  group.add(wallPlate);

  // ── 狀態 ─────────────────────────────────────────────────
  let balanceTilt = 0;
  let balanceTarget = 0;
  let wandAssembled = false;

  const api = {
    group, nodeMeshes, segs,

    setBalanceTilt(v) { balanceTarget = v; },

    unlockCase() {
      keyhole.material.emissive.setHex(0xc8a44d);
      keyhole.material.emissiveIntensity = 1.4;
    },

    removeWandTip() { wandTip.visible = false; },

    assembleWand() {
      wandAssembled = true;
      segs.forEach((s, i) => {
        s.position.set(0, 0, -0.22 + i * 0.22);
      });
      // 三段併成一根：置中並延長
      segs[0].position.z = -0.2;
      segs[1].position.z = 0;
      segs[2].position.z = 0.2;
      segs.forEach((s) => { s.material.emissive.setHex(0x2a1d06); s.material.emissiveIntensity = 1; });
    },

    litNode(dirOrIndex, on = true) {
      const entry = typeof dirOrIndex === 'number'
        ? nodeMeshes[dirOrIndex]
        : nodeMeshes.find((n) => n.dir === dirOrIndex);
      if (entry) entry.core.material.emissiveIntensity = on ? 2.6 : 0.25;
    },

    resetNodes() { nodeMeshes.forEach((n) => { n.core.material.emissiveIntensity = 0.25; }); },

    errorFlash() {
      nodeMeshes.forEach((n) => {
        n.core.material.emissive.setHex(0xff5a4a);
        n.core.material.emissiveIntensity = 2.2;
      });
      setTimeout(() => nodeMeshes.forEach((n) => {
        n.core.material.emissive.setHex(0x9fb7d8);
        n.core.material.emissiveIntensity = 0.25;
      }), 420);
    },

    allNodesOn() {
      nodeMeshes.forEach((n) => { n.core.material.emissiveIntensity = n.dir ? 2.6 : 0.6; });
    },

    update(dt, elapsed) {
      balanceTilt = damp(balanceTilt, balanceTarget, 4, dt);
      beam.rotation.x = balanceTilt * deg(12);
      pans.forEach((p, i) => { p.position.y = -0.14 + (i === 0 ? 1 : -1) * balanceTilt * 0.06; });
      if (wandAssembled) {
        wandParts.position.y = 0.92 + Math.sin(elapsed * 1.4) * 0.006;
      }
      nodeMeshes.forEach((n, i) => {
        if (n.core.material.emissiveIntensity > 1) {
          n.core.material.emissiveIntensity = 2.2 + Math.sin(elapsed * 5 + i) * 0.4;
        }
      });
    }
  };

  // 還原存檔外觀
  if (store.isDone('M01')) api.unlockCase();
  if (store.hasItem('wand-tip')) api.removeWandTip();
  if (store.hasItem('wand')) api.assembleWand();
  if (store.isDone('M04')) api.allNodesOn();

  return api;
}
