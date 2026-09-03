// 序幕道具：長桌、邀請函、四位數鍵盤抽屜、工具箱。
// 位置在玩家出生點左前方，一轉頭就看得到，避免開場找不到起點。

import THREE from '../core/three.js';
import { M, labelTexture } from './materials.js';
import { damp, deg } from '../core/util.js';

const POS = { x: -3.4, z: 3.05 };

export function buildDesk({ scene, interaction, store, game, controls }) {
  const group = new THREE.Group();
  group.name = 'desk';
  group.position.set(POS.x, 0, POS.z);
  scene.add(group);

  const wood = M.wood({ color: 0x6f4d2e });

  const top = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.07, 0.78), wood);
  top.position.y = 0.8;
  top.receiveShadow = true;
  top.castShadow = true;
  group.add(top);
  const apron = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.2, 0.68), M.wood({ color: 0x4f3721 }));
  apron.position.y = 0.66;
  group.add(apron);
  for (const dx of [-0.8, 0.8]) {
    for (const dz of [-0.32, 0.32]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.76, 0.08), wood);
      leg.position.set(dx, 0.38, dz);
      group.add(leg);
    }
  }
  controls.addBoxCollider(POS.x, POS.z, 1.9, 0.9);

  // ── 邀請函（P01）──────────────────────────────────────────
  const letter = new THREE.Mesh(
    new THREE.PlaneGeometry(0.34, 0.46),
    M.paper(labelTexture('邀 請 函', { w: 340, h: 460, size: 62, bg: '#e9dfc4', color: '#2b1f14' }))
  );
  letter.rotation.x = -Math.PI / 2;
  letter.rotation.z = deg(-6);
  letter.position.set(-0.42, 0.842, -0.02);
  group.add(letter);

  interaction.add(letter, {
    id: 'invitation',
    label: '邀請函',
    hint: () => (store.isDone('P01') ? '再讀一次' : '拿起來讀'),
    distance: 2.0,
    onClick: () => game.trigger('P01')
  });

  // ── 抽屜與鍵盤（P03）──────────────────────────────────────
  const drawer = new THREE.Group();
  drawer.position.set(0.5, 0.62, -0.3);
  const drawerFront = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.04), M.wood({ color: 0x5c4127 }));
  drawer.add(drawerFront);
  const drawerBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.16, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x2a1f16, roughness: 0.95, emissive: 0x1a1204, emissiveIntensity: 0 })
  );
  drawerBox.position.z = 0.26;
  drawer.add(drawerBox);
  // 抽屜內道具
  const contents = new THREE.Group();
  const uvLamp = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.14, 12), M.darkMetal({ color: 0x2a2a34 }));
  uvLamp.rotation.z = deg(90);
  uvLamp.position.set(-0.14, 0.02, 0.2);
  const uvGlass = new THREE.Mesh(
    new THREE.CircleGeometry(0.021, 14),
    new THREE.MeshStandardMaterial({ color: 0x2a1a4a, emissive: 0x7a4dff, emissiveIntensity: 1.6 })
  );
  uvGlass.rotation.y = -Math.PI / 2;
  uvGlass.position.set(-0.21, 0.02, 0.2);
  const filter = new THREE.Mesh(
    new THREE.PlaneGeometry(0.1, 0.07),
    new THREE.MeshStandardMaterial({ color: 0xd8354a, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
  );
  filter.rotation.x = -Math.PI / 2;
  filter.position.set(0.02, -0.05, 0.22);
  const baton = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.011, 0.26, 8), M.wood({ color: 0x8a6a3e }));
  baton.rotation.z = deg(90);
  baton.position.set(0.1, 0.0, 0.34);
  const halfPhoto = new THREE.Mesh(
    new THREE.PlaneGeometry(0.11, 0.08),
    M.paper(labelTexture('照片', { w: 220, h: 160, size: 46, bg: '#ddd2b6', color: '#2b1f14' }))
  );
  halfPhoto.rotation.x = -Math.PI / 2;
  halfPhoto.position.set(0.14, -0.05, 0.14);
  contents.add(uvLamp, uvGlass, filter, baton, halfPhoto);
  contents.visible = false;
  drawer.add(contents);
  group.add(drawer);

  // 鍵盤面板
  const keypad = new THREE.Group();
  keypad.position.set(0.5, 0.62, -0.335);
  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.02), M.darkMetal({ color: 0x22222a }));
  keypad.add(pad);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      const key = new THREE.Mesh(
        new THREE.BoxGeometry(0.038, 0.028, 0.012),
        new THREE.MeshStandardMaterial({ color: 0x3a3a44, emissive: 0x151a22, emissiveIntensity: 1, roughness: 0.6 })
      );
      key.position.set(-0.078 + c * 0.052, 0.042 - r * 0.038, 0.014);
      keypad.add(key);
    }
  }
  const readout = new THREE.Mesh(
    new THREE.PlaneGeometry(0.19, 0.03),
    new THREE.MeshStandardMaterial({ color: 0x08120c, emissive: 0x35d68a, emissiveIntensity: 0.7 })
  );
  readout.position.set(0, 0.086, 0.012);
  keypad.add(readout);
  group.add(keypad);

  interaction.add(keypad, {
    id: 'drawer-keypad',
    label: '工具抽屜鍵盤',
    hint: () => (store.isDone('P03') ? '抽屜已經開了' : '輸入四位數'),
    distance: 1.9,
    onClick: () => game.trigger('P03')
  });

  // ── 工具箱（裝飾 + 序幕燈）─────────────────────────────────
  const toolbox = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.24), M.darkMetal({ color: 0x2c2620 }));
  toolbox.position.set(0.66, 0.91, 0.06);
  group.add(toolbox);
  const toolboxHandle = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 16, Math.PI), M.brass());
  toolboxHandle.position.set(0.66, 0.99, 0.06);
  toolboxHandle.rotation.y = deg(90);
  group.add(toolboxHandle);

  // 桌燈：開場唯一亮源之一，指向邀請函
  const deskLamp = new THREE.Group();
  deskLamp.position.set(-0.72, 0.84, 0.16);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.34, 10), M.brass());
  stem.position.y = 0.17;
  deskLamp.add(stem);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.1, 16, 1, true), M.brass({ side: THREE.DoubleSide }));
  cap.position.y = 0.36;
  cap.rotation.x = deg(18);
  deskLamp.add(cap);
  const filament = new THREE.Mesh(
    new THREE.SphereGeometry(0.028, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0x2a2010, emissive: 0xffc074, emissiveIntensity: 2.6 })
  );
  filament.position.y = 0.32;
  deskLamp.add(filament);
  group.add(deskLamp);

  const light = new THREE.PointLight(0xffbf7a, 17, 7.5, 2);
  light.position.set(POS.x - 0.72, 1.22, POS.z + 0.16);
  scene.add(light);

  let drawerOut = 0;

  const api = {
    group, letter, keypad, light,

    openDrawer() {
      drawerOut = 1;
      contents.visible = true;
      drawerBox.material.emissiveIntensity = 1.1;
      readout.material.emissive.setHex(0x9fe8c0);
    },

    takeItem(name) {
      const map = { 'uv-lamp': [uvLamp, uvGlass], 'red-filter': [filter], baton: [baton], 'half-photo': [halfPhoto] };
      (map[name] || []).forEach((m) => { m.visible = false; });
    },

    update(dt, elapsed) {
      drawer.position.z = damp(drawer.position.z, -0.3 - drawerOut * 0.34, 4, dt);
      filament.material.emissiveIntensity = 2.4 + Math.sin(elapsed * 2.3) * 0.18;
      light.intensity = 16.4 + Math.sin(elapsed * 2.3) * 0.9;
    }
  };

  if (store.isDone('P03')) api.openDrawer();
  return api;
}
