// 渲染引擎：scene / camera / renderer / 更新迴圈。
// 世界與 UI 都不直接碰 renderer，統一透過 engine.onUpdate 註冊每幀邏輯。

import THREE from './three.js';
import { QUALITY, PLAYER } from '../config.js';
import { clamp } from './util.js';

export function createEngine(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
    stencil: false
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, QUALITY.maxPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;   // 可由設定的「畫面亮度」覆寫
  if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d0a13);
  scene.fog = new THREE.Fog(0x16121f, 8, 30);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.05, 80);
  camera.position.set(PLAYER.spawn.x, PLAYER.eyeHeight, PLAYER.spawn.z);

  const clock = new THREE.Clock();
  const updaters = new Set();
  let running = false;
  let frame = 0;
  let fpsAccum = 0;
  let fpsFrames = 0;
  let fps = 60;
  let degraded = false;

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, degraded ? 1 : QUALITY.maxPixelRatio));
  }
  window.addEventListener('resize', resize);

  // 自動降級：連續低於 40fps 就降低解析度與關閉陰影，保住流暢度。
  function watchPerformance(dt) {
    fpsAccum += dt;
    fpsFrames++;
    if (fpsAccum >= 1.5) {
      fps = fpsFrames / fpsAccum;
      fpsAccum = 0;
      fpsFrames = 0;
      if (!degraded && fps < 40) {
        degraded = true;
        renderer.shadowMap.enabled = false;
        renderer.setPixelRatio(1);
        scene.traverse((o) => { if (o.isLight) o.castShadow = false; });
      }
    }
  }

  function loop() {
    if (!running) return;
    requestAnimationFrame(loop);
    const dt = clamp(clock.getDelta(), 0, 0.05);
    frame++;
    watchPerformance(dt);
    for (const fn of updaters) {
      try { fn(dt, clock.elapsedTime); } catch (err) { console.error('[update]', err); }
    }
    renderer.render(scene, camera);
  }

  return {
    THREE, scene, camera, renderer, clock,
    get fps() { return fps; },
    get frame() { return frame; },
    onUpdate(fn) { updaters.add(fn); return () => updaters.delete(fn); },
    /** 畫面亮度：不同螢幕差異很大，讓玩家自己調 */
    setExposure(v) { renderer.toneMappingExposure = Math.max(0.4, Math.min(2.4, v)); },
    get exposure() { return renderer.toneMappingExposure; },
    start() {
      if (running) return;
      running = true;
      clock.start();
      loop();
    },
    stop() { running = false; },
    resize
  };
}
