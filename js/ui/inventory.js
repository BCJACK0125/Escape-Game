// 道具列：玩家隨時看得到自己帶著什麼，並且可以「拿在手上」去試。
//   · 點道具 → 拿在手上（再點一次收起）；手上的道具會隨下一次互動一起交給機關
//   · UV 燈例外：點一下就是開關
//   · 近景面板若接受道具（panel.open({ onItem })），面板底部會出現同一排道具可以直接用
// 機關用 items.use() 表示「這次互動有用到手上的道具」；沒用到的話，puzzles/index.js
// 會告訴玩家「派不上用場」並把道具收起來——錯了就收，跟實體密室一樣，可以一直試。

import { el } from '../core/util.js';
import { ITEMS } from '../state/nodes.js';
import { audio } from '../core/audio.js';

// 道具列上的短名（太長的名字在手機上會擠）
const SHORT = {
  'uv-lamp': 'UV 燈',
  'red-filter': '紅濾片',
  baton: '指揮棒',
  'half-photo': '半張照片',
  'case-key': '小鑰匙',
  'wand-tip': '杖尖',
  wand: '魔杖'
};

export function createInventory({ store, hud, panel, onToggleUV }) {
  const bar = el('div.hud-items', { role: 'toolbar', 'aria-label': '道具' });
  hud.root.querySelector('.hud-topright')?.append(bar);

  let held = null;
  let usedThisTurn = false;

  const name = (id) => SHORT[id] || ITEMS[id]?.name || id;

  function render() {
    const ids = store.heldItems().filter((id) => ITEMS[id]);
    bar.hidden = ids.length === 0;
    bar.replaceChildren(...ids.map((id) => {
      const isUV = id === 'uv-lamp';
      const on = isUV ? !!store.flag('uvOn', false) : held === id;
      return el('button.item-chip', {
        type: 'button',
        class: `item-chip${on ? ' is-held' : ''}${isUV ? ' item-chip--uv' : ''}`,
        title: `${ITEMS[id].name}：${ITEMS[id].desc}`,
        'aria-pressed': on ? 'true' : 'false',
        dataset: { item: id },
        onclick: (e) => { e.stopPropagation(); api.select(id); }
      }, [name(id)]);
    }));
    hud.setHeld?.(held ? name(held) : null);
    document.body.classList.toggle('is-holding', !!held);
  }

  const api = {
    root: bar,
    get held() { return held; },
    name,

    select(id) {
      if (!store.hasItem(id) || store.isSpent(id)) return;
      audio.softClick();
      if (id === 'uv-lamp') { onToggleUV?.(); render(); return; }
      if (held === id) {
        held = null;
        hud.toast(`收起${name(id)}`);
      } else {
        held = id;
        hud.toast(`拿在手上：${ITEMS[id].name}。${ITEMS[id].desc}`, 4200);
      }
      render();
    },

    clear() {
      if (!held) return;
      held = null;
      render();
    },

    /** 機關表示：這次互動用到了手上的道具（不收起，可以連續使用） */
    use() { usedThisTurn = true; },

    /** 道具用掉了：從道具列移除 */
    spend(id) {
      usedThisTurn = true;
      if (held === id) held = null;
      store.spendItem(id);
      render();
    },

    /** puzzles/index.js 在每次「玩家觸發」前後呼叫 */
    beginTurn() { usedThisTurn = false; },
    get usedThisTurn() { return usedThisTurn; },

    render
  };

  // 面板底部的道具列：面板開著時，玩家一樣能「拿出某樣東西來試」
  panel.setItemSource?.(() => store.heldItems()
    .filter((id) => ITEMS[id] && id !== 'uv-lamp')
    .map((id) => ({ id, name: name(id), desc: ITEMS[id].desc })));

  store.on('item', render);
  store.on('load', render);
  store.on('reset', () => { held = null; render(); });
  store.on('flag', ({ key }) => { if (key === 'uvOn') render(); });
  render();
  return api;
}
