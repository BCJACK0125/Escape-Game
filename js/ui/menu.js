// 標題、暫停、設定、結局卡。
// 幕布分開的那一下是全片唯一的自動動畫，其餘動態都由玩家操作觸發。

import { el, formatClock } from '../core/util.js';
import { TIME_MODES } from '../config.js';
import { SCRIPT } from '../state/nodes.js';
import { audio } from '../core/audio.js';

export function createMenu({ store, hud, hooks }) {
  // 亮度與觸控由外部套用（engine 與 touch 層），選單只負責改設定
  const root = el('div.screen', { id: 'screen' });
  document.body.appendChild(root);
  let mode = 'standard';
  let visible = false;

  function show(node, { curtain = false } = {}) {
    root.replaceChildren(
      curtain ? el('div.screen-curtain', {}, [el('span.curtain-half.left'), el('span.curtain-half.right')]) : el('span'),
      node
    );
    root.hidden = false;
    visible = true;
    document.body.classList.add('screen-open');
    requestAnimationFrame(() => root.classList.add('is-open'));
  }

  function hide() {
    visible = false;
    root.classList.remove('is-open');
    document.body.classList.remove('screen-open');
    setTimeout(() => { if (!visible) { root.hidden = true; root.replaceChildren(); } }, 320);
  }

  function modeRow() {
    const labels = { standard: '標準 60 分', friendly: '新手 75 分', rehearsal: '排練模式 · 無時限' };
    return el('div.mode-row', {}, Object.keys(TIME_MODES).map((key) => el('button.mode-btn', {
      type: 'button',
      class: `mode-btn${mode === key ? ' is-active' : ''}`,
      text: labels[key],
      onclick: () => { mode = key; audio.click(); showTitle(); }
    })));
  }

  function showTitle() {
    const summary = store.hasSave() ? store.saveSummary() : null;
    show(el('div.title-card', {}, [
      el('p.title-kicker', { text: '魔術師林默的最後房間' }),
      el('h1.title-main', {}, [
        el('span.title-line', { text: '消失的' }),
        el('span.title-line.title-line--big', { text: '第十三幕' })
      ]),
      el('p.title-blurb', {
        text: '清場系統會在時間結束時抹除最後一場排練的全部紀錄。找回代表光、聲、物的三枚真相徽記，重演第十三幕，並決定是否公開他留下的證據。'
      }),
      modeRow(),
      el('div.title-bright', {}, [
        el('span', { text: '畫面亮度' }),
        el('input', {
          type: 'range', min: '0.5', max: '2.2', step: '0.05', value: String(store.settings.brightness ?? 1.15),
          oninput: (e) => {
            const v = Number(e.target.value);
            store.saveSettings({ brightness: v });
            hooks.setBrightness?.(v);
          }
        }),
        el('span.title-bright-note', { text: '房間本來就很暗；覺得看不清就往右拉' })
      ]),
      el('div.title-actions', {}, [
        el('button.btn.btn--lead', {
          type: 'button',
          text: '進入房間',
          onclick: () => { audio.init(); audio.curtain(); hide(); hooks.newGame(mode); }
        }),
        summary && el('button.btn.btn--ghost', {
          type: 'button',
          text: `繼續上一場（${summary.progress}/${summary.total} 節點 · ${formatClock(summary.elapsed)}）`,
          onclick: () => { audio.init(); hide(); hooks.continueGame(); }
        })
      ].filter(Boolean)),
      el('div.title-help', {}, [
        el('p', { text: 'WASD 走動　滑鼠拖曳環顧　點擊或 E 互動' }),
        el('p', { text: 'I 線索本　H 排練備忘　U UV 燈　L 鎖定滑鼠　Esc 選單' }),
        el('p.title-note', { text: '含閃光與突發聲響；音量請先調到舒適的位置。' })
      ])
    ]), { curtain: true });
  }

  function showPause() {
    show(el('div.menu-card', {}, [
      el('h2.menu-title', { text: '暫停' }),
      el('p.menu-sub', { text: `剩餘 ${store.state.limit > 0 ? formatClock(store.remaining()) : '無時限'}　節點 ${store.progress().done}/${store.progress().total}` }),
      settingsBlock(),
      el('div.menu-actions', {}, [
        el('button.btn.btn--lead', { type: 'button', text: '回到房間', onclick: () => { hide(); hooks.resume(); } }),
        el('button.btn.btn--ghost', { type: 'button', text: '重新開始這一場', onclick: () => { if (confirm('重新開始會清除這一場的進度。')) { hide(); hooks.newGame(store.state.mode); } } }),
        el('button.btn.btn--ghost', { type: 'button', text: '回到標題', onclick: () => showTitle() })
      ])
    ]));
  }

  function settingsBlock() {
    const vol = el('input', {
      type: 'range', min: '0', max: '1', step: '0.05', value: String(store.settings.volume),
      oninput: (e) => { audio.setVolume(Number(e.target.value)); store.saveSettings({ volume: Number(e.target.value) }); }
    });
    const sens = el('input', {
      type: 'range', min: '0.4', max: '2', step: '0.1', value: String(store.settings.sensitivity),
      oninput: (e) => store.saveSettings({ sensitivity: Number(e.target.value) })
    });
    const bright = el('input', {
      type: 'range', min: '0.5', max: '2.2', step: '0.05', value: String(store.settings.brightness ?? 1.15),
      oninput: (e) => {
        const v = Number(e.target.value);
        store.saveSettings({ brightness: v });
        hooks.setBrightness?.(v);
      }
    });
    const invert = el('input', {
      type: 'checkbox', checked: store.settings.invertY,
      onchange: (e) => store.saveSettings({ invertY: e.target.checked })
    });
    const touch = el('select', {
      onchange: (e) => {
        store.saveSettings({ touchControls: e.target.value });
        hooks.setTouchControls?.(e.target.value);
      }
    }, [
      el('option', { value: 'auto', text: '自動偵測', selected: (store.settings.touchControls ?? 'auto') === 'auto' }),
      el('option', { value: 'on', text: '一直顯示', selected: store.settings.touchControls === 'on' }),
      el('option', { value: 'off', text: '關閉', selected: store.settings.touchControls === 'off' })
    ]);
    return el('div.settings', {}, [
      el('label.setting', {}, [el('span', { text: '畫面亮度' }), bright]),
      el('label.setting', {}, [el('span', { text: '音量' }), vol]),
      el('label.setting', {}, [el('span', { text: '視角靈敏度' }), sens]),
      el('label.setting.setting--row', {}, [el('span', { text: '反轉上下' }), invert]),
      el('label.setting', {}, [el('span', { text: '螢幕搖桿' }), touch])
    ]);
  }

  function statsBlock() {
    return el('div.ending-stats', {}, [
      el('div.stat', {}, [el('span.stat-value', { text: formatClock(store.state.elapsed) }), el('span.stat-label', { text: '使用時間' })]),
      el('div.stat', {}, [el('span.stat-value', { text: `${store.progress().done}/${store.progress().total}` }), el('span.stat-label', { text: '互動節點' })]),
      el('div.stat', {}, [el('span.stat-value', { text: String(store.hintsUsed()) }), el('span.stat-label', { text: '排練備忘' })])
    ]);
  }

  function showEnding(id) {
    const script = SCRIPT.finale[id] || SCRIPT.finale.reveal;
    show(el('div.ending-card', {}, [
      el('p.ending-kicker', { text: '第十三幕 · 完成' }),
      el('h2.ending-title', { text: script.title }),
      el('div.ending-lines', {}, script.lines.map((l) => el('p', { text: l }))),
      statsBlock(),
      el('p.ending-note', {
        text: id === 'reveal'
          ? '留念卡：「機關設計：林默」'
          : '留念卡：「明年今天，六個連號座位」'
      }),
      el('div.menu-actions', {}, [
        el('button.btn.btn--lead', { type: 'button', text: '再演一次', onclick: () => { store.clearSave(); hide(); hooks.newGame(store.state.mode); } }),
        el('button.btn.btn--ghost', { type: 'button', text: '回到標題', onclick: () => { store.clearSave(); showTitle(); } })
      ])
    ]), { curtain: true });
  }

  function showTimeout() {
    show(el('div.ending-card', {}, [
      el('p.ending-kicker', { text: '清場系統' }),
      el('h2.ending-title', { text: '紀錄已抹除' }),
      el('div.ending-lines', {}, SCRIPT.timeout.map((l) => el('p', { text: l }))),
      statsBlock(),
      el('p.ending-note', { text: '想把節奏放慢，可以選「新手 75 分」或「排練模式」。' }),
      el('div.menu-actions', {}, [
        el('button.btn.btn--lead', { type: 'button', text: '再來一次', onclick: () => { store.clearSave(); hide(); hooks.newGame(store.state.mode); } }),
        el('button.btn.btn--ghost', { type: 'button', text: '繼續留在房間（無時限）', onclick: () => { hide(); hooks.rehearsalMode(); } })
      ])
    ]));
  }

  return {
    get visible() { return visible; },
    showTitle, showPause, showEnding, showTimeout, hide,
    get mode() { return mode; }
  };
}
