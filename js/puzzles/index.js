// 謎題註冊表：把節點 ID 對應到處理函式。
// 世界物件只呼叫 game.trigger('S03', { rope }),不需要知道任何謎題細節。

import { NODE_MAP } from '../state/nodes.js';
import { registerPrologue } from './prologue.js';
import { registerLight } from './light.js';
import { registerSound } from './sound.js';
import { registerPhysical } from './physical.js';
import { registerConverge } from './converge.js';
import { registerFinale } from './finale.js';

// 前置未完成時的角色化回應（避免用系統語氣說「未解鎖」）
const LOCKED_LINES = {
  L: '這一側的燈還沒亮。',
  S: '檔案櫃還鎖著。',
  M: '工作檯上的東西還沒輪到。',
  G: '自動機一動也不動。',
  F: '幕還沒有要開的意思。',
  P: '先把桌上的事做完。'
};

export function createPuzzles(ctx) {
  const handlers = new Map();
  const reg = (id, fn) => handlers.set(id, fn);

  registerPrologue(ctx, reg);
  registerLight(ctx, reg);
  registerSound(ctx, reg);
  registerPhysical(ctx, reg);
  registerConverge(ctx, reg);
  registerFinale(ctx, reg);

  return {
    has(id) { return handlers.has(id); },

    trigger(id, extra = {}) {
      const handler = handlers.get(id);
      if (!handler) {
        console.warn(`[puzzles] 沒有註冊的節點：${id}`);
        return;
      }
      const node = NODE_MAP.get(id);
      if (node && !ctx.store.isOpen(id)) {
        ctx.hud.toast(LOCKED_LINES[node.line] || '還沒有反應');
        return;
      }
      try {
        handler(extra);
      } catch (err) {
        console.error(`[puzzle:${id}]`, err);
        ctx.hud.toast('這個機關卡住了，可以用選單重試');
      }
    },

    ids() { return [...handlers.keys()]; }
  };
}
