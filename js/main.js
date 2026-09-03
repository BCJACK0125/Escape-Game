// 進入點：把引擎、世界、UI 與謎題接起來。
// 依賴方向刻意單向：world / puzzles / ui 都只讀 store 與 ctx，彼此不互相 import。

import THREE from './core/three.js';
import { createEngine } from './core/engine.js';
import { createControls } from './core/controls.js';
import { createInteraction } from './core/interaction.js';
import { audio } from './core/audio.js';
import { store } from './state/store.js';
import { createHUD } from './ui/hud.js';
import { createMenu } from './ui/menu.js';
import { createJournal } from './ui/journal.js';
import { createTouchUI } from './ui/touch.js';
import { panel } from './ui/panel.js';
import { buildRoom } from './world/room.js';
import { buildDesk } from './world/desk.js';
import { buildAutomaton } from './world/automaton.js';
import { buildGallery } from './world/gallery.js';
import { buildSoundArchive } from './world/soundArchive.js';
import { buildWorkbench } from './world/workbench.js';
import { buildStage } from './world/stage.js';
import { createPuzzles } from './puzzles/index.js';
import { PLAYER, TIME_MODES } from './config.js';

const RESTART_KEY = 'act13:restart';

const canvas = document.getElementById('scene');
const boot = document.getElementById('boot');

store.init();
audio.setVolume(store.settings.volume);

const engine = createEngine(canvas);
const hud = createHUD({
  onJournal: () => journal.toggle('clues'),
  onHint: () => journal.open('hints'),
  onMenu: () => menu.showPause()
});
hud.setVisible(false);

const controls = createControls({ camera: engine.camera, dom: canvas, engine, store });
const interaction = createInteraction({ engine, camera: engine.camera, controls, hud, audio });

const game = { trigger: () => {} };
const ctx = {
  THREE,
  engine,
  scene: engine.scene,
  camera: engine.camera,
  renderer: engine.renderer,
  controls,
  interaction,
  hud,
  panel,
  audio,
  store,
  game,
  tmpVec: new THREE.Vector3(),
  world: {},
  menu: null
};

const journal = createJournal({ store, hud });
let touch = null;
const menu = createMenu({
  store,
  hud,
  hooks: {
    setBrightness(v) { engine.setExposure(v); },
    setTouchControls(mode) { touch?.apply(mode); },
    newGame(mode) {
      if (worldBuilt) {
        try { sessionStorage.setItem(RESTART_KEY, mode || 'standard'); } catch { /* 忽略 */ }
        store.clearSave();
        location.reload();
        return;
      }
      startGame({ fresh: true, mode });
    },
    continueGame() { startGame({ fresh: false }); },
    resume() { setPaused(false); },
    rehearsalMode() {
      store.state.limit = 0;
      store.state.mode = 'rehearsal';
      store.state.finished = false;
      store.state.ending = null;
      store.persistNow();
      setPaused(false);
      hud.toast('已切換為排練模式：沒有倒數');
    }
  }
});
ctx.menu = menu;

// 螢幕搖桿：觸控裝置自動顯示，也可在選單強制開關
touch = createTouchUI({ controls, interaction, hud, journal, menu, store, panel });
ctx.touch = touch;

// 套用玩家的畫面亮度設定（不同螢幕差異很大）
engine.setExposure(store.settings.brightness ?? 1.15);

// ── 世界建置（玩家按下「進入房間」後才生成）────────────────────
let worldBuilt = false;
let puzzles = null;

function buildWorld() {
  if (worldBuilt) return;
  const room = buildRoom({ scene: engine.scene, controls });
  ctx.world.room = room;
  ctx.world.automaton = buildAutomaton({ scene: engine.scene, interaction, store, game, controls });
  ctx.world.desk = buildDesk({ scene: engine.scene, interaction, store, game, controls });
  ctx.world.gallery = buildGallery({ scene: engine.scene, interaction, store, game });
  ctx.world.sound = buildSoundArchive({ scene: engine.scene, interaction, store, game, controls });
  ctx.world.workbench = buildWorkbench({ scene: engine.scene, interaction, store, game, controls });
  ctx.world.stage = buildStage({ scene: engine.scene, interaction, store, game, controls, room });

  for (const part of Object.values(ctx.world)) {
    if (typeof part.update === 'function') engine.onUpdate(part.update);
  }

  puzzles = createPuzzles(ctx);
  game.trigger = (id, extra) => puzzles.trigger(id, extra);
  worldBuilt = true;

  // 讀檔時把燈光狀態補回來
  if (store.isDone('P01')) room.setLampOn(true);
  if (store.isDone('P02')) room.revealClock();
  if (store.isDone('P03')) room.setWorkLights(true);
  if (store.isDone('G03')) room.setSpotlight(true);
}

// ── 遊戲開始 ─────────────────────────────────────────────────
let playing = false;

function startGame({ fresh, mode = 'standard' }) {
  if (fresh) store.newGame(mode);
  else if (!store.load()) store.newGame(mode);

  buildWorld();
  controls.teleport(PLAYER.spawn.x, PLAYER.spawn.z, PLAYER.spawn.yaw);
  hud.setVisible(true);
  touch?.apply();
  hud.refreshSigils();
  hud.refreshProgress();
  playing = true;
  engine.start();
  audio.init();

  if (fresh) {
    game.trigger('prologue-intro');
  } else {
    hud.setObjective(resumeObjective());
    hud.toast('已讀取上一場的進度');
  }
}

function resumeObjective() {
  const active = store.activeNodes();
  if (!active.length) return '房間安靜下來了';
  return `${active[0].id}　${active[0].title}`;
}

// ── 暫停 ─────────────────────────────────────────────────────
function setPaused(paused) {
  if (paused) {
    if (panel.isOpen) panel.close();
    controls.enabled = false;
    interaction.setEnabled(false);
    touch?.setActive(false);
    menu.showPause();
  } else {
    menu.hide();
    controls.enabled = true;
    interaction.setEnabled(true);
    touch?.setActive(true);
  }
}

// 面板開關時凍結移動與互動
panel.onOpenChange((open) => {
  controls.enabled = !open;
  interaction.setEnabled(!open);
  if (open && controls.locked) controls.unlockPointer();
});

// ── 每幀：倒數與 HUD ──────────────────────────────────────────
engine.onUpdate((dt) => {
  if (!playing || menu.visible || panel.isOpen) return;
  store.tick(dt);
  if (store.state.limit > 0) hud.setTimer(store.remaining());
  else hud.setTimer(store.state.elapsed, { limitless: true });
});

store.on('timeout', () => {
  playing = false;
  controls.enabled = false;
  interaction.setEnabled(false);
  touch?.setActive(false);
  audio.startDrone({ id: 'wipe', freq: 44, gain: 0.08 });
  setTimeout(() => {
    audio.stopDrone('wipe');
    menu.showTimeout();
  }, 2600);
});

// ── 鍵盤 ─────────────────────────────────────────────────────
window.addEventListener('keydown', (e) => {
  if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
  if (e.code === 'Escape') {
    if (panel.isOpen) return;              // panel 自己處理
    if (menu.visible) { setPaused(false); return; }
    if (playing) { e.preventDefault(); setPaused(true); }
    return;
  }
  if (!playing || menu.visible) return;
  if (e.code === 'KeyI') { e.preventDefault(); journal.toggle('clues'); }
  if (e.code === 'KeyH') { e.preventDefault(); journal.open('hints'); }
  if (e.code === 'KeyL' && !panel.isOpen) controls.toggleLock();
});

// 第一次互動時解鎖 AudioContext（瀏覽器政策）
const unlockAudio = () => audio.init();
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('keydown', unlockAudio, { once: true });

// ── 啟動 ─────────────────────────────────────────────────────
if (boot) boot.hidden = true;

let restartMode = null;
try {
  restartMode = sessionStorage.getItem(RESTART_KEY);
  if (restartMode) sessionStorage.removeItem(RESTART_KEY);
} catch { /* 忽略 */ }

if (restartMode && TIME_MODES[restartMode] !== undefined) {
  startGame({ fresh: true, mode: restartMode });
} else {
  menu.showTitle();
  engine.start();   // 標題畫面背後也在渲染（空房間的黑暗）
}

// 開發時方便檢查
window.__act13 = { store, ctx, engine, menu, journal, get touch() { return touch; } };

// ?debug=1：畫面上顯示 FPS、亮度、光源數量，方便回報問題
if (new URLSearchParams(location.search).get('debug') === '1') {
  const box = document.createElement('div');
  box.id = 'debug';
  document.body.appendChild(box);
  let acc = 0;
  engine.onUpdate((dt) => {
    acc += dt;
    if (acc < 0.4) return;
    acc = 0;
    let lights = 0;
    engine.scene.traverse((o) => { if (o.isLight) lights++; });
    box.textContent = [
      `three r${THREE.REVISION}`,
      `${engine.fps.toFixed(0)} fps`,
      `曝光 ${engine.exposure.toFixed(2)}`,
      `光源 ${lights}`,
      `節點 ${store.progress().done}/${store.progress().total}`,
      `搖桿 ${touch?.visible ? '開' : '關'}`
    ].join('　');
  });
}
