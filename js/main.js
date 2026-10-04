// 進入點：把引擎、世界、UI、放映機與謎題接起來。
// 依賴方向刻意單向：world / puzzles / ui 都只讀 store 與 ctx，彼此不互相 import。

import THREE from './core/three.js';
import { createEngine } from './core/engine.js';
import { createControls } from './core/controls.js';
import { createInteraction } from './core/interaction.js';
import { audio } from './core/audio.js';
import { ambience, gearShift } from './core/score.js';
import { store } from './state/store.js';
import { MEMORIES, SCRIPT } from './state/nodes.js';
import { createHUD } from './ui/hud.js';
import { createMenu } from './ui/menu.js';
import { createJournal } from './ui/journal.js';
import { createTouchUI } from './ui/touch.js';
import { createInventory } from './ui/inventory.js';
import { panel } from './ui/panel.js';
import { createCinema } from './cinema/cinema.js';
import { buildRoom } from './world/room.js';
import { buildDesk } from './world/desk.js';
import { buildAutomaton } from './world/automaton.js';
import { buildGallery } from './world/gallery.js';
import { buildSoundArchive } from './world/soundArchive.js';
import { buildWorkbench } from './world/workbench.js';
import { buildStage } from './world/stage.js';
import { createPuzzles } from './puzzles/index.js';
import { PLAYER, TIME_MODES } from './config.js';
import { wait } from './core/util.js';

const RESTART_KEY = 'act13:restart';
const NUDGE_AFTER = 240;          // 幾秒沒有任何進展，轉盤電話就會響（提示鈕發光）

const canvas = document.getElementById('scene');
const boot = document.getElementById('boot');

store.init();
audio.setVolume(store.settings.volume);

const engine = createEngine(canvas);
const hud = createHUD({
  onJournal: () => journal.toggle('clues'),
  onHint: () => journal.open('hints'),
  onMenu: () => setPaused(true)
});
hud.setVisible(false);

const controls = createControls({ camera: engine.camera, dom: canvas, engine, store });
const interaction = createInteraction({ engine, camera: engine.camera, controls, hud, audio });
const cinema = createCinema({ audio, controls });
const items = createInventory({
  store, hud, panel,
  onToggleUV: () => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyU' }))
});

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
  cinema,
  items,
  tmpVec: new THREE.Vector3(),
  world: {},
  menu: null
};

const journal = createJournal({
  store,
  hud,
  onReplayMemory: (m) => cinema.memory({ title: m.title, text: m.text, sign: m.sign ?? '——林默' }),
  onHintsOpened: () => { nudge.last = store.state.elapsed; }
});
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
    setGuide(level) {
      store.setGuide(level);
      items.render();
      if (store.isDone('G02') && !store.isDone('G03')) ctx.world.stage?.showOutlines(true);
      hud.toast(level === 'challenge' ? '引導程度：挑戰' : '引導程度：引導（目標與提示更直接）');
    },
    async watchPrelude(mode = 'standard') {
      await cinema.prelude({ minutes: TIME_MODES[mode] ?? 60 });
      menu.showTitle();
    },
    rehearsalMode() {
      store.state.limit = 0;
      store.state.mode = 'rehearsal';
      store.state.finished = false;
      store.state.ending = null;
      store.persistNow();
      playing = true;
      ambience.start();
      ambience.setTension(0);
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

/** 從全黑淡入房間 */
function fadeInFromBlack() {
  const veil = document.createElement('div');
  veil.className = 'fade-black';
  document.body.appendChild(veil);
  requestAnimationFrame(() => requestAnimationFrame(() => veil.classList.add('is-out')));
  setTimeout(() => veil.remove(), 2800);
}

// ── 遊戲開始 ─────────────────────────────────────────────────
let playing = false;

async function startGame({ fresh, mode = 'standard', prelude = fresh }) {
  if (fresh) store.newGame(mode);
  else if (!store.load()) store.newGame(mode);
  // ?guide=challenge|guided：強制引導程度（測試與內容驗收用）
  const forcedGuide = new URLSearchParams(location.search).get('guide');
  if (forcedGuide === 'challenge' || forcedGuide === 'guided') store.state.guide = forcedGuide;
  items.render();

  audio.init();
  engine.start();

  if (prelude) {
    const film = cinema.prelude({ minutes: Math.round(store.state.limit / 60) });
    // 片頭倒數的那幾秒在背後建好房間，先畫幾格讓 shader 編譯完，之後暫停 3D 繪製
    // （玩家一開始就跳過的話，不必多等）
    await Promise.race([film, wait(250)]);
    buildWorld();
    controls.teleport(PLAYER.spawn.x, PLAYER.spawn.z, PLAYER.spawn.yaw);
    if (cinema.active) {
      await Promise.race([film, wait(500)]);
      if (cinema.active) engine.setSuspended(true);
      await film;
      engine.setSuspended(false);
    }
    fadeInFromBlack();
  } else {
    buildWorld();
    if (fresh) fadeInFromBlack();
  }

  controls.teleport(PLAYER.spawn.x, PLAYER.spawn.z, PLAYER.spawn.yaw);
  hud.setVisible(true);
  touch?.apply();
  hud.refreshSigils();
  hud.refreshProgress();
  playing = true;

  warnings.reset();
  nudge.last = store.state.elapsed;
  ambience.start();
  updateTension();

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
    ambience.duck(true);
    menu.showPause();
  } else {
    menu.hide();
    controls.enabled = true;
    interaction.setEnabled(true);
    touch?.setActive(true);
    ambience.duck(false);
  }
}

// 面板開關時凍結移動與互動
panel.onOpenChange((open) => {
  controls.enabled = !open;
  interaction.setEnabled(!open);
  if (open && controls.locked) controls.unlockPointer();
});

// ── 清場倒數的旁白與環境聲 ───────────────────────────────────
const warnings = {
  fired: new Set(),
  /** 讀檔時，已經過去的門檻不再補播 */
  reset() {
    this.fired.clear();
    if (store.state.limit <= 0) return;
    const rem = store.remaining();
    for (const [sec] of SCRIPT.warnings) if (rem <= sec) this.fired.add(sec);
  },
  check(rem) {
    for (const [sec, line] of SCRIPT.warnings) {
      if (rem <= sec && !this.fired.has(sec)) {
        this.fired.add(sec);
        // 正在播劇情台詞時不搶字幕，改用浮條
        if (hud.speaking) hud.toast(line, 5200);
        else hud.say(line, 5200);
        hud.warnTimer();
        gearShift();
        audio.haptic([40, 60, 40]);
      }
    }
  }
};

function updateTension() {
  if (store.state.limit <= 0) { ambience.setTension(0); return; }
  const rem = store.remaining();
  ambience.setTension(rem <= 60 ? 1 : rem <= 300 ? 0.8 : rem <= 600 ? 0.55 : rem <= 1800 ? 0.25 : 0);
}

// ── 卡關提醒：太久沒有進展，林默的電話會響 ─────────────────────
const nudge = { last: 0, shown: false };
store.on('node:done', () => {
  nudge.last = store.state.elapsed;
  if (nudge.shown) { nudge.shown = false; hud.setNudge(false); }
});

// ── 林默手記：解鎖當下就存檔，等畫面安靜下來再播放 ──────────────
const memoryQueue = [];
let memoryQuiet = 0;
function unlockMemories(key) {
  for (const m of MEMORIES) {
    if (m.at === key && store.addMemory(m.id)) memoryQueue.push(m);
  }
}
store.on('node:done', ({ id }) => unlockMemories(id));
store.on('sigil', (id) => unlockMemories(`sigil:${id}`));

engine.onUpdate((dt) => {
  if (!memoryQueue.length || !playing) return;
  const busy = panel.isOpen || cinema.active || menu.visible || controls.frozen
    || !interaction.enabled || hud.speaking || hud.root.classList.contains('is-cinematic');
  if (busy) { memoryQuiet = 0; return; }
  memoryQuiet += dt;
  if (memoryQuiet < 1.1) return;
  memoryQuiet = 0;
  const m = memoryQueue.shift();
  cinema.memory({ title: m.title, text: m.text, sign: m.sign ?? '——林默' }).then(() => {
    hud.toast('這一頁收進了線索本的「手記」');
  });
});

// ── 每幀：倒數與 HUD ──────────────────────────────────────────
let tensionAcc = 0;
engine.onUpdate((dt) => {
  if (!playing || menu.visible || panel.isOpen || cinema.active) return;
  store.tick(dt);
  if (store.state.limit > 0) {
    const rem = store.remaining();
    hud.setTimer(rem);
    warnings.check(rem);
  } else {
    hud.setTimer(store.state.elapsed, { limitless: true });
  }
  tensionAcc += dt;
  if (tensionAcc > 1) { tensionAcc = 0; updateTension(); store.markOpened(); }

  // 卡關提醒：太久沒進展，而且確實有一級備忘可以聽了，才讓電話響
  if (!nudge.shown && !store.state.finished && store.state.elapsed - nudge.last > NUDGE_AFTER
    && store.activeNodes().some((n) => store.hintWait(n.id) === 0)) {
    nudge.shown = true;
    nudge.last = store.state.elapsed;
    hud.setNudge(true);
    hud.say(SCRIPT.nudge, 5600);
    audio.phoneRing(1);
  }
});

store.on('timeout', async () => {
  playing = false;
  controls.enabled = false;
  interaction.setEnabled(false);
  touch?.setActive(false);
  if (panel.isOpen) panel.close();
  ambience.stop();
  await cinema.wipe(SCRIPT.timeout);
  menu.showTimeout();
});

store.on('ending', () => {
  playing = false;
  ambience.stop();
});

// ── 鍵盤 ─────────────────────────────────────────────────────
window.addEventListener('keydown', (e) => {
  if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
  if (cinema.active) return;
  if (e.code === 'Escape') {
    if (panel.isOpen) return;              // panel 自己處理
    if (document.body.classList.contains('mode-adjust') || document.body.classList.contains('mode-silence')) return;
    if (menu.visible) { if (playing) setPaused(false); return; }
    if (playing) { e.preventDefault(); setPaused(true); }
    return;
  }
  if (!playing || menu.visible) return;
  if (e.code === 'KeyI') { e.preventDefault(); journal.toggle('clues'); }
  if (e.code === 'KeyH') { e.preventDefault(); journal.open('hints'); }
  if (e.code === 'KeyJ') { e.preventDefault(); journal.open('memo'); }
  if (e.code === 'KeyL' && !panel.isOpen) controls.toggleLock();
});

// 第一次互動時解鎖 AudioContext（瀏覽器政策）
const unlockAudio = () => audio.init();
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('keydown', unlockAudio, { once: true });

// 切到別的分頁時把聲音停下來；回來再繼續
document.addEventListener('visibilitychange', () => {
  if (!audio.ctx) return;
  if (document.visibilityState === 'hidden') audio.ctx.suspend?.();
  else audio.ctx.resume?.();
});

// ── 啟動 ─────────────────────────────────────────────────────
if (boot) boot.hidden = true;

let restartMode = null;
try {
  restartMode = sessionStorage.getItem(RESTART_KEY);
  if (restartMode) sessionStorage.removeItem(RESTART_KEY);
} catch { /* 忽略 */ }

if (restartMode && TIME_MODES[restartMode] !== undefined) {
  // 「再演一次」：前導片已經看過了，直接進房間（標題畫面隨時可以重看）
  startGame({ fresh: true, mode: restartMode, prelude: false });
} else {
  menu.showTitle();
  engine.start();   // 標題畫面背後也在渲染（空房間的黑暗）
}

// 開發時方便檢查
window.__act13 = {
  store, ctx, engine, menu, journal, cinema,
  get touch() { return touch; },
  get pendingMemories() { return memoryQueue.length; }
};

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
