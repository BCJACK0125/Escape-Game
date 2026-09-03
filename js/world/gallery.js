// 光影畫廊（L 線）：UV 海報 → 肖像閉眼 → 鏡後星圖 → 濾片 → 稜鏡導光 → 太陽徽記
// 空間安排：西牆北段掛海報，北牆放肖像、單向鏡與光學台。

import THREE from '../core/three.js';
import { ROOM } from '../config.js';
import { M, posterTexture, portraitTexture, sigilTexture, labelTexture } from './materials.js';
import { ANSWERS } from '../config.js';
import { damp, deg } from '../core/util.js';

const NORTH = -ROOM.halfD + 0.05;
const WEST = -ROOM.halfW + 0.05;

// 光學台在牆面平面上的節點（x, y）：發射器 → 三面鏡 → 靶
const OPTICS = {
  emitter: [-4.8, 0.78],
  mirrors: [[-4.8, 2.05], [-3.3, 2.05], [-3.3, 1.05]],
  target: [-1.95, 1.05]
};

export function buildGallery({ scene, interaction, store, game }) {
  const group = new THREE.Group();
  group.name = 'gallery';
  scene.add(group);

  // ── 三張海報（西牆北段）────────────────────────────────────
  const posters = [];
  [-3.0, -2.2, -1.4].forEach((z, i) => {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.16, 0.82), M.wood({ color: 0x5f452c }));
    frame.position.set(WEST - 0.02, 1.75, z);
    group.add(frame);
    const sheet = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 1.04),
      M.paper(posterTexture(i, false))
    );
    sheet.position.set(WEST + 0.03, 1.75, z);
    sheet.rotation.y = Math.PI / 2;
    group.add(sheet);
    posters.push(sheet);

    interaction.add(sheet, {
      id: `poster-${i}`,
      label: `海報 · ${['一九三七', '一九四一', '一九四四'][i]}`,
      hint: () => (store.hasItem('uv-lamp') ? (store.flag('uvOn') ? '看見了被遮掉的圖層' : '試試 UV 燈（U）') : '白光下看不出異常'),
      distance: 2.4,
      onClick: () => game.trigger('L01', { poster: i })
    });
  });

  // ── 三幅肖像（北牆）──────────────────────────────────────
  const portraits = [];
  [1.6, 2.8, 4.0].forEach((x, i) => {
    const holder = new THREE.Group();
    holder.position.set(x, 1.72, NORTH);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.86, 1.1, 0.07), M.wood({ color: 0x6a4c2e }));
    holder.add(frame);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 0.98), M.paper(portraitTexture(i, 'none')));
    face.position.z = 0.04;
    holder.add(face);
    group.add(holder);

    // 三個眼部觸點：左眼 / 右眼 / 雙眼
    const spots = {};
    const spotDefs = [
      { key: 'left', dx: -0.15 },
      { key: 'both', dx: 0 },
      { key: 'right', dx: 0.15 }
    ];
    for (const def of spotDefs) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.055, 0.008, 6, 18),
        new THREE.MeshStandardMaterial({ color: 0xc8a44d, emissive: 0xc8a44d, emissiveIntensity: 0.35, metalness: 0.7, roughness: 0.4 })
      );
      ring.position.set(def.dx, 0.2, 0.05);
      ring.visible = false;
      holder.add(ring);

      const hit = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.16, 0.08), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.set(def.dx, 0.2, 0.06);
      hit.userData.__noHighlight = true;
      holder.add(hit);
      interaction.add(hit, {
        id: `portrait-${i}-${def.key}`,
        label: `肖像 ${i + 1} · ${{ left: '遮左眼', right: '遮右眼', both: '遮雙眼' }[def.key]}`,
        hint: '伸手遮住',
        distance: 2.0,
        enabled: () => store.isDone('L01') && !store.isDone('L02'),
        onClick: () => game.trigger('L02', { portrait: i, cover: def.key })
      });
      spots[def.key] = ring;
    }
    portraits.push({ holder, face, spots, cover: 'none' });
  });

  // ── 單向鏡（北牆右側）────────────────────────────────────
  const mirrorFrame = new THREE.Group();
  mirrorFrame.position.set(5.25, 1.62, NORTH);
  const mFrame = new THREE.Mesh(new THREE.BoxGeometry(1.12, 1.42, 0.09), M.wood({ color: 0x4d3a26 }));
  mirrorFrame.add(mFrame);
  const mirrorGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(0.98, 1.28),
    new THREE.MeshStandardMaterial({
      color: 0x8fa2b4, metalness: 1, roughness: 0.12,
      emissive: 0x0c1014, emissiveIntensity: 1
    })
  );
  mirrorGlass.position.z = 0.05;
  mirrorFrame.add(mirrorGlass);
  // 鏡後星圖：亮燈後才透出來
  const starGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.98, 1.28),
    new THREE.MeshStandardMaterial({
      color: 0x101a2a, emissive: 0x2f5f9a, emissiveIntensity: 0, transparent: true, opacity: 0.9
    })
  );
  starGlow.position.z = 0.052;
  mirrorFrame.add(starGlow);
  group.add(mirrorFrame);

  interaction.add(mirrorFrame, {
    id: 'one-way-mirror',
    label: '單向鏡',
    hint: () => (store.isDone('L02') ? '鏡後有東西亮著' : '只照得出你自己'),
    distance: 2.4,
    onClick: () => game.trigger(store.isDone('L03') ? 'L04' : 'L03')
  });

  // ── 光學台：發射器、三面鏡、感光靶、畫框（北牆左側）────────
  const optics = new THREE.Group();
  group.add(optics);

  const shelf = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.06, 0.34), M.wood({ color: 0x53412c }));
  shelf.position.set(-3.35, 0.62, NORTH + 0.14);
  optics.add(shelf);

  const emitterBody = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.26, 16), M.darkMetal());
  emitterBody.position.set(OPTICS.emitter[0], OPTICS.emitter[1], NORTH + 0.14);
  emitterBody.rotation.x = deg(90);
  optics.add(emitterBody);
  const emitterLens = new THREE.Mesh(
    new THREE.CircleGeometry(0.07, 20),
    new THREE.MeshStandardMaterial({ color: 0x120c04, emissive: 0xffe3a0, emissiveIntensity: 0 })
  );
  emitterLens.position.set(OPTICS.emitter[0], OPTICS.emitter[1] + 0.14, NORTH + 0.14);
  emitterLens.rotation.x = deg(-90);
  optics.add(emitterLens);

  // 三面可轉動鏡架
  const mirrors = OPTICS.mirrors.map(([x, y], i) => {
    const holder = new THREE.Group();
    holder.position.set(x, y, NORTH + 0.14);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8), M.brass());
    post.position.y = -0.2;
    holder.add(post);
    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.02, 24), M.brass());
    dial.rotation.x = deg(90);
    holder.add(dial);
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(0.17, 0.012, 0.09),
      M.mirror({ emissive: 0x1a2028, emissiveIntensity: 1 })
    );
    glass.position.z = 0.02;
    holder.add(glass);
    // 刻度指針
    const needle = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.1, 0.008), M.glow(0xf0d48a, 1.2));
    needle.position.set(0, 0.05, 0.03);
    holder.add(needle);
    optics.add(holder);

    interaction.add(holder, {
      id: `mirror-${i}`,
      label: () => `鏡架 ${i + 1} · ${angles[i]}°`,
      hint: '點一下轉 15°',
      distance: 2.2,
      enabled: () => store.isDone('L04') && !store.isDone('L05'),
      onClick: () => game.trigger('L05', { mirror: i })
    });

    return { holder, glass, needle, dial };
  });

  // 光束：牆面平面上的四段
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xffe6ae, transparent: true, opacity: 0.85 });
  function beamSegment(from, to) {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const len = Math.hypot(dx, dy);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, len, 6), beamMat);
    mesh.position.set((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, NORTH + 0.16);
    mesh.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
    mesh.visible = false;
    optics.add(mesh);
    return mesh;
  }
  const path = [OPTICS.emitter, ...OPTICS.mirrors, OPTICS.target];
  const beams = [];
  for (let i = 0; i < path.length - 1; i++) beams.push(beamSegment(path[i], path[i + 1]));

  // 感光靶與畫框
  const frameGroup = new THREE.Group();
  frameGroup.position.set(OPTICS.target[0], OPTICS.target[1], NORTH + 0.06);
  const pictureFrame = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.7, 0.07), M.wood({ color: 0x6a4c2e }));
  frameGroup.add(pictureFrame);
  const targetPlate = new THREE.Mesh(
    new THREE.CircleGeometry(0.07, 20),
    new THREE.MeshStandardMaterial({ color: 0x1a1206, emissive: 0xff8a3a, emissiveIntensity: 0.2 })
  );
  targetPlate.position.z = 0.05;
  frameGroup.add(targetPlate);
  const frameDoor = new THREE.Group();
  const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.66, 0.03), M.wood({ color: 0x7a5936 }));
  doorPanel.position.x = 0.26;
  frameDoor.add(doorPanel);
  frameDoor.position.set(-0.26, 0, 0.06);
  frameGroup.add(frameDoor);

  const sunSigil = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, 0.02, 28),
    new THREE.MeshStandardMaterial({
      map: sigilTexture('sun'), metalness: 0.5, roughness: 0.4,
      emissive: 0xe8c063, emissiveIntensity: 0.8
    })
  );
  sunSigil.rotation.x = deg(90);
  sunSigil.position.set(0, 0, 0.02);
  sunSigil.visible = false;
  frameGroup.add(sunSigil);
  group.add(frameGroup);

  interaction.add(sunSigil, {
    id: 'sun-sigil',
    label: '太陽徽記',
    hint: '取走',
    distance: 2.2,
    enabled: () => sunSigil.visible && !store.hasSigil('sun'),
    onClick: () => game.trigger('L05-take')
  });

  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(1.0, 0.24),
    new THREE.MeshStandardMaterial({
      map: labelTexture('光學台 · 鏡架角度', { w: 512, h: 122, size: 44 }),
      roughness: 0.9, emissive: 0x141008, emissiveIntensity: 1
    })
  );
  plate.position.set(-3.35, 0.42, NORTH + 0.32);
  plate.rotation.x = deg(-70);
  group.add(plate);

  // ── 狀態 ─────────────────────────────────────────────────
  const angles = [0, 0, 0];        // 三面鏡目前角度
  let uvOn = false;
  let beamProgress = 0;
  let doorOpen = 0;

  const api = {
    group, posters, portraits, mirrors, angles,

    setUV(on) {
      uvOn = on;
      posters.forEach((sheet, i) => {
        sheet.material.map = posterTexture(i, on);
        sheet.material.emissive.setHex(on ? 0x1b2a4a : 0x141010);
        sheet.material.emissiveIntensity = on ? 1.8 : 1;
        sheet.material.needsUpdate = true;
      });
    },

    setPortraitCover(i, cover) {
      const p = portraits[i];
      if (!p) return;
      p.cover = cover;
      p.face.material.map = portraitTexture(i, cover);
      p.face.material.needsUpdate = true;
    },

    resetPortraits() { portraits.forEach((p, i) => api.setPortraitCover(i, 'none')); },

    showPortraitSpots(on) {
      portraits.forEach((p) => Object.values(p.spots).forEach((r) => { r.visible = on; }));
    },

    litMirrorBack(on) {
      starGlow.material.emissiveIntensity = on ? 1.4 : 0;
      mirrorGlass.material.roughness = on ? 0.3 : 0.12;
    },

    /** 轉動某面鏡；回傳新角度 */
    rotateMirror(i, step = 15) {
      angles[i] = (angles[i] + step) % 360;
      return angles[i];
    },

    setMirrorAngle(i, a) { angles[i] = a; },

    /** 前幾面鏡角度正確 → 光束前進幾段 */
    beamReach() {
      let reach = 1;
      for (let i = 0; i < 3; i++) {
        if (angles[i] === ANSWERS.mirrorAngles[i]) reach = i + 2;
        else break;
      }
      return reach;
    },

    setEmitter(on) {
      emitterLens.material.emissiveIntensity = on ? 2.4 : 0;
    },

    openFrame() {
      doorOpen = 1;
      sunSigil.visible = true;
      targetPlate.material.emissiveIntensity = 2.6;
    },

    takeSigil() { sunSigil.visible = false; },

    update(dt, elapsed) {
      // 鏡架轉到目標角度（視覺上是繞牆面法線轉）
      mirrors.forEach((m, i) => {
        const target = deg(-angles[i]);
        m.holder.rotation.z = damp(m.holder.rotation.z, target, 10, dt);
      });

      const reach = store.isDone('L04') ? api.beamReach() : 0;
      beamProgress = damp(beamProgress, reach, 8, dt);
      beams.forEach((b, i) => {
        b.visible = beamProgress > i + 0.35;
        b.material.opacity = 0.55 + Math.sin(elapsed * 6 + i) * 0.12;
      });
      api.setEmitter(store.isDone('L04'));

      if (doorOpen > 0) {
        frameDoor.rotation.y = damp(frameDoor.rotation.y, deg(-105), 3, dt);
        sunSigil.rotation.z += dt * 0.6;
        sunSigil.position.y = Math.sin(elapsed * 1.6) * 0.012;
      }

      if (uvOn) {
        posters.forEach((s, i) => { s.material.emissiveIntensity = 1.6 + Math.sin(elapsed * 3 + i) * 0.2; });
      }
    }
  };

  // 還原存檔外觀
  if (store.isDone('L01')) api.showPortraitSpots(true);
  if (store.isDone('L02')) { api.litMirrorBack(true); ANSWERS.portraitOrder.forEach((c, i) => api.setPortraitCover(i, c)); }
  if (store.isDone('L04')) { const saved = store.flag('mirrorAngles'); if (Array.isArray(saved)) saved.forEach((a, i) => { angles[i] = a; }); }
  if (store.isDone('L05')) api.openFrame();
  if (store.hasSigil('sun')) api.takeSigil();

  return api;
}
