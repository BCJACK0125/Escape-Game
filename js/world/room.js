// 房間外殼與燈光。長方形單房，中央保留表演區，三面牆各屬一條支線。
//   北牆 z=-4 光影畫廊 ｜ 東牆 x=+6 聲音檔案區 ｜ 西牆 x=-6 機關工作檯 ｜ 南牆 z=+4 終幕牆

import THREE from '../core/three.js';
import { ROOM } from '../config.js';
import { M, floorTexture, plasterTexture, clockFaceTexture, labelTexture } from './materials.js';
import { deg, damp } from '../core/util.js';

export function buildRoom({ scene, controls }) {
  const group = new THREE.Group();
  group.name = 'room';
  scene.add(group);

  const { width: W, depth: D, height: H, halfW, halfD } = ROOM;

  // ── 地板 / 天花板 ──────────────────────────────────────────
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(W, D),
    new THREE.MeshStandardMaterial({
      map: floorTexture(), color: 0xd8cfc4, roughness: 0.78, metalness: 0.04,
      emissive: 0x15100c, emissiveIntensity: 1
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(W, D),
    new THREE.MeshStandardMaterial({ color: 0x241f2c, roughness: 1 })
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = H;
  group.add(ceiling);

  // ── 四面牆 ────────────────────────────────────────────────
  const wallMat = new THREE.MeshStandardMaterial({
    map: plasterTexture(), color: 0xcfc6bd, roughness: 0.94, metalness: 0,
    emissive: 0x14110f, emissiveIntensity: 1
  });

  function wall(w, h, pos, rotY) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
    mesh.position.set(pos[0], pos[1], pos[2]);
    mesh.rotation.y = rotY;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }
  const northWall = wall(W, H, [0, H / 2, -halfD], 0);
  wall(W, H, [0, H / 2, halfD], Math.PI);
  wall(D, H, [-halfW, H / 2, 0], Math.PI / 2);
  wall(D, H, [halfW, H / 2, 0], -Math.PI / 2);

  // 踢腳板：讓牆與地板的交界不會太生硬
  const baseMat = M.wood({ color: 0x5c452e });
  const bases = [
    [W, 0.22, 0.08, 0, 0.11, -halfD + 0.04],
    [W, 0.22, 0.08, 0, 0.11, halfD - 0.04],
    [0.08, 0.22, D, -halfW + 0.04, 0.11, 0],
    [0.08, 0.22, D, halfW - 0.04, 0.11, 0]
  ];
  for (const [sx, sy, sz, x, y, z] of bases) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), baseMat);
    b.position.set(x, y, z);
    group.add(b);
  }

  // ── 南牆：絨布幕 ───────────────────────────────────────────
  const curtain = new THREE.Group();
  const curtainMat = M.velvet();
  for (let i = 0; i < 14; i++) {
    const panelW = W / 14;
    const fold = new THREE.Mesh(
      new THREE.CylinderGeometry(panelW * 0.52, panelW * 0.52, H - 0.1, 8, 1, false, 0, Math.PI),
      curtainMat
    );
    fold.rotation.y = Math.PI;
    fold.position.set(-halfW + panelW * (i + 0.5), (H - 0.1) / 2, halfD - 0.16);
    curtain.add(fold);
  }
  const pelmet = new THREE.Mesh(new THREE.BoxGeometry(W, 0.42, 0.34), curtainMat);
  pelmet.position.set(0, H - 0.22, halfD - 0.2);
  curtain.add(pelmet);
  group.add(curtain);

  // ── 拱框（讓房間有舞台感）──────────────────────────────────
  const archMat = M.wood({ color: 0x7a5a38 });
  const archTop = new THREE.Mesh(new THREE.BoxGeometry(W, 0.3, 0.3), archMat);
  archTop.position.set(0, H - 0.5, halfD - 0.55);
  group.add(archTop);
  for (const sx of [-1, 1]) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.3, H - 0.5, 0.3), archMat);
    col.position.set(sx * (halfW - 0.2), (H - 0.5) / 2, halfD - 0.55);
    group.add(col);
  }

  // ── 牆面區域標籤 ───────────────────────────────────────────
  function signage(text, pos, rotY) {
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 0.36),
      new THREE.MeshStandardMaterial({
        map: labelTexture(text, { w: 512, h: 122, size: 52 }),
        roughness: 0.8, emissive: 0x1a1408, emissiveIntensity: 0.9
      })
    );
    plate.position.set(...pos);
    plate.rotation.y = rotY;
    group.add(plate);
    return plate;
  }
  signage('光影畫廊', [-4.6, 2.95, -halfD + 0.03], 0);
  signage('聲音檔案區', [halfW - 0.03, 2.95, 1.1], -Math.PI / 2);
  signage('機關工作檯', [-halfW + 0.03, 2.95, -1.1], Math.PI / 2);

  // ── 北牆鐘面（P02）────────────────────────────────────────
  const clockGroup = new THREE.Group();
  clockGroup.position.set(0, 2.15, -halfD + 0.04);
  const clockFace = new THREE.Mesh(
    new THREE.CircleGeometry(0.86, 48),
    new THREE.MeshStandardMaterial({
      map: clockFaceTexture(false), roughness: 0.9,
      emissive: 0x181410, emissiveIntensity: 1
    })
  );
  clockGroup.add(clockFace);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.87, 0.03, 8, 48), M.brass());
  clockGroup.add(rim);

  // 影子指針：燈罩刻孔投出的兩道暗影
  function shadowHand(len, w) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, len),
      new THREE.MeshBasicMaterial({ color: 0x0a0708, transparent: true, opacity: 0.62 })
    );
    m.geometry.translate(0, len / 2, 0);
    m.position.z = 0.012;
    m.visible = false;
    clockGroup.add(m);
    return m;
  }
  const hourHand = shadowHand(0.44, 0.055);
  const minuteHand = shadowHand(0.7, 0.032);
  group.add(clockGroup);

  // ── 吊燈與燈繩（P01 / P02）────────────────────────────────
  const lamp = new THREE.Group();
  lamp.position.set(0, 0, -2.35);
  const cord = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.008, 0.9, 6),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 1 })
  );
  cord.position.y = H - 0.45;
  lamp.add(cord);

  const shade = new THREE.Group();
  shade.position.y = H - 0.95;
  const shadeBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.46, 0.4, 24, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0x2b2118, metalness: 0.6, roughness: 0.5, side: THREE.DoubleSide,
      emissive: 0x000000, emissiveIntensity: 1
    })
  );
  shade.add(shadeBody);
  // 刻孔：兩道長短不同的縫
  for (const [ang, len, w] of [[0, 0.26, 0.035], [0, 0.15, 0.05]]) {
    const slit = new THREE.Mesh(
      new THREE.PlaneGeometry(w, len),
      new THREE.MeshStandardMaterial({ color: 0xf5e3b0, emissive: 0xf0d48a, emissiveIntensity: 0.2, side: THREE.DoubleSide })
    );
    slit.position.set(Math.sin(ang) * 0.4, 0, Math.cos(ang) * -0.4);
    shade.add(slit);
  }
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0x1a1712, emissive: 0xffd9a0, emissiveIntensity: 0 })
  );
  bulb.position.y = -0.02;
  shade.add(bulb);
  lamp.add(shade);

  // 舞台燈繩（P01 的操作對象）
  const pullCord = new THREE.Group();
  pullCord.position.set(0.62, 0, -2.35);
  const cordLine = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.006, 1.5, 6),
    new THREE.MeshStandardMaterial({ color: 0xd8c9a8, roughness: 1, emissive: 0x1a1610, emissiveIntensity: 1 })
  );
  cordLine.position.y = H - 0.75;
  pullCord.add(cordLine);
  const cordKnob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 10), M.brass());
  cordKnob.position.y = H - 1.55;
  pullCord.add(cordKnob);
  group.add(lamp, pullCord);

  const lampLight = new THREE.PointLight(0xffcf94, 0, 15, 2);
  lampLight.position.set(0, H - 1.0, -2.35);
  lampLight.castShadow = true;
  lampLight.shadow.mapSize.set(1024, 1024);
  group.add(lampLight);

  // ── 環境光與三面牆工作燈 ───────────────────────────────────
  group.add(new THREE.AmbientLight(0x50476a, 1.35));
  const hemi = new THREE.HemisphereLight(0x5a5075, 0x2c2016, 1.15);
  group.add(hemi);

  const workLights = {
    L: new THREE.PointLight(0xffd487, 0, 13, 2),
    S: new THREE.PointLight(0x9fc4e8, 0, 13, 2),
    M: new THREE.PointLight(0xffb877, 0, 13, 2)
  };
  workLights.L.position.set(-3.4, 2.9, -3.1);
  workLights.S.position.set(4.9, 2.7, 0.2);
  workLights.M.position.set(-4.9, 2.7, 0.2);
  Object.values(workLights).forEach((l) => group.add(l));

  // 幕布的暖紅洗光，一直存在，讓南側不會全黑
  const curtainWash = new THREE.PointLight(0xff6a5a, 9, 10, 2);
  curtainWash.position.set(0, 2.4, halfD - 1.1);
  group.add(curtainWash);

  // ── 表演區聚光燈（G03 完成後亮起）──────────────────────────
  const spot = new THREE.SpotLight(0xfff2d0, 0, 9, deg(24), 0.35, 1.6);
  spot.position.set(0, H - 0.3, 2.2);
  spot.target.position.set(0, 0, 2.2);
  spot.castShadow = true;
  group.add(spot, spot.target);

  // ── 空氣中的塵埃 ───────────────────────────────────────────
  const dustCount = 420;
  const positions = new Float32Array(dustCount * 3);
  const speeds = new Float32Array(dustCount);
  for (let i = 0; i < dustCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * (W - 0.6);
    positions[i * 3 + 1] = Math.random() * (H - 0.4) + 0.2;
    positions[i * 3 + 2] = (Math.random() - 0.5) * (D - 0.6);
    speeds[i] = 0.01 + Math.random() * 0.03;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    color: 0xd8c9a0, size: 0.014, transparent: true, opacity: 0.5, depthWrite: false
  }));
  group.add(dust);

  // ── 牆邊碰撞體（房間邊界由 controls 直接處理）──────────────
  controls.addBoxCollider(0, -2.35, 0.9, 0.9); // 吊燈下方不擋人，只擋自動機周邊由 automaton 自行加

  // ── 對外狀態 ──────────────────────────────────────────────
  let lampOn = false;
  let shadeAngle = deg(0);
  let targetShadeAngle = shadeAngle;

  const api = {
    group, floor, northWall, clockGroup, curtain, spot, lampLight, workLights, shade,
    pullCord, lamp,
    get lampOn() { return lampOn; },
    get shadeAngle() { return shadeAngle; },

    setLampOn(on) {
      lampOn = on;
      lampLight.intensity = on ? 34 : 0;
      bulb.material.emissiveIntensity = on ? 2.4 : 0;
      shadeBody.material.emissive.setHex(on ? 0x140d05 : 0x000000);
      hourHand.visible = on;
      minuteHand.visible = on;
    },

    setShadeAngle(rad) { targetShadeAngle = rad; },
    nudgeShade(delta) { targetShadeAngle += delta; },

    /** 目前影子指出的時間 */
    shadowTime() {
      const t = ((shadeAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const hoursFloat = (t / (Math.PI * 2)) * 12;
      const hour = Math.floor(hoursFloat) || 12;
      const minute = Math.floor((hoursFloat % 1) * 60);
      return { hour: hour === 0 ? 12 : hour, minute, hoursFloat };
    },

    revealClock() {
      clockFace.material.map = clockFaceTexture(true);
      clockFace.material.emissive.setHex(0x3a2c10);
      clockFace.material.emissiveIntensity = 1.5;
      clockFace.material.needsUpdate = true;
    },

    setWorkLights(on) {
      workLights.L.intensity = on ? 26 : 0;
      workLights.S.intensity = on ? 22 : 0;
      workLights.M.intensity = on ? 22 : 0;
      hemi.intensity = on ? 1.55 : 1.15;
    },

    setSpotlight(on) {
      spot.intensity = on ? 72 : 0;
    },

    update(dt, elapsed) {
      shadeAngle = damp(shadeAngle, targetShadeAngle, 9, dt);
      shade.rotation.y = shadeAngle;
      // 影子跟著燈罩轉：時針＝燈罩角度，分針＝12 倍（真實鐘面比例）
      hourHand.rotation.z = -shadeAngle;
      minuteHand.rotation.z = -shadeAngle * 12;
      if (lampOn) {
        lampLight.intensity = 34 + Math.sin(elapsed * 7.3) * 1.1;
      }
      // 塵埃緩慢上浮
      const pos = dustGeo.attributes.position.array;
      for (let i = 0; i < dustCount; i++) {
        pos[i * 3 + 1] += speeds[i] * dt;
        pos[i * 3] += Math.sin(elapsed * 0.4 + i) * 0.0008;
        if (pos[i * 3 + 1] > H - 0.2) pos[i * 3 + 1] = 0.2;
      }
      dustGeo.attributes.position.needsUpdate = true;
    }
  };

  api.setLampOn(false);
  api.setWorkLights(false);
  api.setSpotlight(false);
  return api;
}
