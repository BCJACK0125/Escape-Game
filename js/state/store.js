// 單一資料來源（single source of truth）。
// 所有世界物件、UI、謎題都只透過 store 讀寫狀態，並靠事件訂閱同步畫面。
// 存檔：把整個 state 序列化進 localStorage，無後端。

import { emitter, debounce } from '../core/util.js';
import { NODES, NODE_MAP } from './nodes.js';
import { SAVE_KEY, SETTINGS_KEY, TIME_MODES } from '../config.js';

const SAVE_VERSION = 1;

function freshState(mode = 'standard') {
  return {
    version: SAVE_VERSION,
    mode,
    limit: (TIME_MODES[mode] ?? 60) * 60, // 秒；0 = 無時限
    elapsed: 0,
    startedAt: Date.now(),
    done: {},      // nodeId -> timestamp
    items: {},     // itemId -> true
    clues: [],     // clueId（依取得順序）
    sigils: {},    // sun / moon / star -> true
    flags: {},     // 任意旗標：uvOn、lightsOn、mirrorAngles…
    hints: {},     // nodeId -> 已用提示級數
    ending: null,
    finished: false
  };
}

const bus = emitter();

export const store = {
  state: freshState(),
  settings: { volume: 0.8, invertY: false, sensitivity: 1, subtitles: true, brightness: 1.15, touchControls: 'auto' },

  on: bus.on,
  off: bus.off,

  // ── 生命週期 ────────────────────────────────────────────────
  init() {
    this.loadSettings();
    return this.hasSave();
  },

  newGame(mode = 'standard') {
    this.state = freshState(mode);
    bus.emit('reset', this.state);
    this.persist();
    return this.state;
  },

  hasSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      return data && data.version === SAVE_VERSION && !data.finished;
    } catch { return false; }
  },

  saveSummary() {
    try {
      const data = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!data) return null;
      return {
        progress: Object.keys(data.done || {}).length,
        total: NODES.length,
        elapsed: data.elapsed || 0,
        sigils: Object.keys(data.sigils || {}).length,
        mode: data.mode || 'standard'
      };
    } catch { return null; }
  },

  load() {
    try {
      const data = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!data || data.version !== SAVE_VERSION) return false;
      this.state = Object.assign(freshState(data.mode), data);
      bus.emit('load', this.state);
      return true;
    } catch (err) {
      console.warn('存檔讀取失敗，開新局。', err);
      return false;
    }
  },

  persist: debounce(function persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(store.state));
    } catch (err) {
      console.warn('存檔寫入失敗（可能是私密瀏覽模式）。', err);
    }
  }, 600),

  persistNow() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.state)); } catch { /* 忽略 */ }
  },

  clearSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* 忽略 */ }
  },

  loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY));
      if (s) Object.assign(this.settings, s);
    } catch { /* 忽略 */ }
  },

  saveSettings(patch = {}) {
    Object.assign(this.settings, patch);
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch { /* 忽略 */ }
    bus.emit('settings', this.settings);
  },

  // ── 節點 ───────────────────────────────────────────────────
  isDone(id) { return !!this.state.done[id]; },

  /** 前置節點是否都完成（決定物件可不可互動） */
  isOpen(id) {
    const node = NODE_MAP.get(id);
    if (!node) return false;
    return (node.requires || []).every((r) => this.isDone(r));
  },

  complete(id, payload = {}) {
    if (this.state.done[id]) return false;
    this.state.done[id] = Date.now();
    const node = NODE_MAP.get(id);
    bus.emit('node:done', { id, node, payload });
    bus.emit('change', { type: 'node', id });
    this.persist();
    return true;
  },

  progress() {
    return { done: Object.keys(this.state.done).length, total: NODES.length };
  },

  /** 目前應該關注的節點（供 HUD 目標與提示系統使用） */
  activeNodes() {
    return NODES.filter((n) => !this.isDone(n.id) && this.isOpen(n.id));
  },

  // ── 道具 / 線索 / 徽記 ──────────────────────────────────────
  addItem(id) {
    if (this.state.items[id]) return false;
    this.state.items[id] = true;
    bus.emit('item', id);
    bus.emit('change', { type: 'item', id });
    this.persist();
    return true;
  },
  hasItem(id) { return !!this.state.items[id]; },

  addClue(id) {
    if (this.state.clues.includes(id)) return false;
    this.state.clues.push(id);
    bus.emit('clue', id);
    bus.emit('change', { type: 'clue', id });
    this.persist();
    return true;
  },
  hasClue(id) { return this.state.clues.includes(id); },

  addSigil(id) {
    if (this.state.sigils[id]) return false;
    this.state.sigils[id] = true;
    bus.emit('sigil', id);
    bus.emit('change', { type: 'sigil', id });
    this.persist();
    return true;
  },
  hasSigil(id) { return !!this.state.sigils[id]; },
  sigilCount() { return Object.keys(this.state.sigils).length; },

  // ── 旗標（謎題中間狀態）─────────────────────────────────────
  flag(key, fallback = null) {
    return key in this.state.flags ? this.state.flags[key] : fallback;
  },
  setFlag(key, value) {
    if (this.state.flags[key] === value) return;
    this.state.flags[key] = value;
    bus.emit('flag', { key, value });
    bus.emit('change', { type: 'flag', key });
    this.persist();
  },

  // ── 提示（三級，包裝成林默的排練備忘）────────────────────────
  hintLevel(id) { return this.state.hints[id] || 0; },
  useHint(id) {
    const node = NODE_MAP.get(id);
    if (!node) return null;
    const level = Math.min((this.state.hints[id] || 0) + 1, node.hints.length);
    this.state.hints[id] = level;
    bus.emit('hint', { id, level, text: node.hints[level - 1] });
    this.persist();
    return { level, text: node.hints[level - 1], total: node.hints.length };
  },
  hintsUsed() {
    return Object.values(this.state.hints).reduce((a, b) => a + b, 0);
  },

  // ── 時間 ───────────────────────────────────────────────────
  tick(dt) {
    if (this.state.finished) return;
    this.state.elapsed += dt;
    if (this.state.limit > 0 && this.state.elapsed >= this.state.limit) {
      this.state.elapsed = this.state.limit;
      this.state.finished = true;
      this.state.ending = 'timeout';
      bus.emit('timeout');
      this.persistNow();
    }
  },
  remaining() {
    if (this.state.limit <= 0) return Infinity;
    return Math.max(0, this.state.limit - this.state.elapsed);
  },

  setEnding(id) {
    this.state.ending = id;
    this.state.finished = true;
    bus.emit('ending', id);
    this.persistNow();
  },

  emit: bus.emit
};

// 離開頁面前立即寫入，避免 debounce 尾巴掉資料
window.addEventListener('beforeunload', () => store.persistNow());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') store.persistNow();
});
