// 面板內會重複用到的元件。刻意用「點選」而非拖曳為主要操作，
// 因為點選在觸控與滑鼠上都可靠，也符合密室「錯了就清除重試」的節奏。

import { el } from '../core/util.js';
import { audio } from '../core/audio.js';

/** 數字鍵盤：回傳 { root, clear, setStatus } */
export function keypad({ length = 4, onSubmit, hint = '' }) {
  let value = '';
  const display = el('div.keypad-display');
  const cells = [];
  for (let i = 0; i < length; i++) {
    const cell = el('span.keypad-cell', { text: '—' });
    cells.push(cell);
    display.appendChild(cell);
  }
  function render() {
    cells.forEach((c, i) => {
      c.textContent = value[i] ?? '—';
      c.classList.toggle('is-set', !!value[i]);
    });
  }
  function press(d) {
    if (value.length >= length) return;
    value += d;
    audio.click();
    render();
    if (value.length === length) setTimeout(submit, 220);
  }
  function submit() {
    const v = value;
    onSubmit?.(v, {
      clear: () => { value = ''; render(); },
      keep: () => {}
    });
  }
  const keys = el('div.keypad-keys');
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '✓'].forEach((k) => {
    keys.appendChild(el('button.keypad-key', {
      type: 'button', text: k,
      class: `keypad-key${k === 'C' || k === '✓' ? ' keypad-key--fn' : ''}`,
      onclick: () => {
        if (k === 'C') { value = ''; audio.softClick(); render(); }
        else if (k === '✓') submit();
        else press(k);
      }
    }));
  });
  const root = el('div.keypad', {}, [display, keys, hint && el('p.panel-note', { text: hint })].filter(Boolean));

  // 鍵盤實體按鍵支援
  const onKey = (e) => {
    if (!root.isConnected) return;
    if (/^[0-9]$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') { value = value.slice(0, -1); render(); }
    else if (e.key === 'Enter') submit();
  };
  window.addEventListener('keydown', onKey);
  render();
  return { root, clear() { value = ''; render(); }, get value() { return value; }, dispose() { window.removeEventListener('keydown', onKey); } };
}

/**
 * 可排序清單：用 ▲▼ 調整順序，避免拖曳在觸控裝置上的不確定性。
 * items: [{ id, title, meta, action:{label, onClick} }]
 */
export function orderList({ items, onSubmit, submitLabel = '確認順序', slotLabels = null }) {
  let order = items.slice();
  const list = el('ol.order-list');

  function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    audio.softClick();
    render();
  }

  function render() {
    list.replaceChildren(...order.map((item, i) => el('li.order-item', {}, [
      el('span.order-slot', { text: slotLabels ? slotLabels[i] : String(i + 1) }),
      el('div.order-main', {}, [
        el('p.order-title', { text: item.title }),
        item.meta && el('p.order-meta', { text: item.meta })
      ].filter(Boolean)),
      item.action && el('button.btn.btn--ghost', {
        type: 'button', text: item.action.label,
        onclick: () => item.action.onClick(item, i)
      }),
      el('div.order-arrows', {}, [
        el('button.arrow-btn', { type: 'button', text: '▲', 'aria-label': '上移', onclick: () => move(i, -1) }),
        el('button.arrow-btn', { type: 'button', text: '▼', 'aria-label': '下移', onclick: () => move(i, 1) })
      ])
    ])));
  }

  const submit = el('button.btn', {
    type: 'button', text: submitLabel,
    onclick: () => onSubmit?.(order.map((o) => o.id), { reset() { order = items.slice(); render(); } })
  });

  render();
  return { root: el('div.order-wrap', {}, [list, el('div.panel-actions', {}, [submit])]), get order() { return order.map((o) => o.id); } };
}

/** 轉盤電話：點孔位 → 轉盤回轉動畫 + 撥號聲 */
export function rotaryDial({ length = 4, onSubmit }) {
  let value = '';
  const readout = el('p.dial-readout', { text: '— — — —' });
  const dial = el('div.dial');
  const plate = el('div.dial-plate');
  const holes = [];

  for (let i = 0; i < 10; i++) {
    const digit = (i + 1) % 10; // 1..9,0 順時針
    const a = (-95 + i * 29) * (Math.PI / 180);
    const hole = el('button.dial-hole', {
      type: 'button', text: String(digit),
      style: {
        left: `${50 + Math.cos(a) * 36}%`,
        top: `${50 + Math.sin(a) * 36}%`
      },
      onclick: () => dialDigit(digit, i)
    });
    holes.push(hole);
    plate.appendChild(hole);
  }
  const stop = el('div.dial-stop');
  dial.append(plate, stop, el('div.dial-center', { text: '林默' }));

  function refresh() {
    const shown = value.split('').concat(Array(length).fill('—')).slice(0, length);
    readout.textContent = shown.join(' ');
  }

  let busy = false;
  function dialDigit(digit, index) {
    if (busy || value.length >= length) return;
    busy = true;
    const turn = 30 + index * 29;
    plate.style.transition = 'transform .38s cubic-bezier(.3,.7,.4,1)';
    plate.style.transform = `rotate(${turn}deg)`;
    audio.dialClick();
    setTimeout(() => {
      plate.style.transition = 'transform .62s cubic-bezier(.4,0,.6,1)';
      plate.style.transform = 'rotate(0deg)';
      audio.dialReturn(Math.max(3, Math.round(turn / 29)));
      value += String(digit);
      refresh();
      setTimeout(() => {
        busy = false;
        if (value.length === length) {
          onSubmit?.(value, { clear() { value = ''; refresh(); } });
        }
      }, 620);
    }, 400);
  }

  const clear = el('button.btn.btn--ghost', {
    type: 'button', text: '掛掉重撥',
    onclick: () => { value = ''; refresh(); audio.softClick(); }
  });

  refresh();
  return {
    root: el('div.dial-wrap', {}, [dial, el('div.dial-side', {}, [readout, clear])]),
    get value() { return value; }
  };
}

/** 一排可點選的卡片（單選） */
export function cardRow({ cards, onPick, selected = null }) {
  let current = selected;
  const row = el('div.card-row');
  function render() {
    row.replaceChildren(...cards.map((c) => el('button.pick-card', {
      type: 'button',
      class: `pick-card${current === c.id ? ' is-active' : ''}`,
      onclick: () => { current = c.id; audio.click(); render(); onPick?.(c.id); }
    }, [
      c.glyph && el('span.pick-glyph', { text: c.glyph }),
      el('span.pick-title', { text: c.title }),
      c.meta && el('span.pick-meta', { text: c.meta })
    ].filter(Boolean))));
  }
  render();
  return { root: row, get value() { return current; }, set(id) { current = id; render(); } };
}
