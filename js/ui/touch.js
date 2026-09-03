// 螢幕搖桿與動作鈕（觸控裝置用）。
// 設計原則：左手搖桿走位、右手在畫面上拖曳看四周、右下角按鈕做動作。
// 搖桿與動作鈕都會 stopPropagation，不會被當成「在 3D 畫面上拖曳」。

import { el, isTouchDevice } from '../core/util.js';
import { audio } from '../core/audio.js';

const STICK_RADIUS = 54;

export function createTouchUI({ controls, interaction, hud, journal, menu, store, panel }) {
  const knob = el('div.stick-knob');
  const stick = el('div.stick', {}, [
    el('div.stick-ring'),
    knob,
    el('span.stick-hint', { text: '走位' })
  ]);

  let stickPointer = null;

  function setKnob(dx, dy) {
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  function onStickDown(e) {
    e.preventDefault();
    e.stopPropagation();
    stickPointer = e.pointerId;
    stick.classList.add('is-active');
    try { stick.setPointerCapture(e.pointerId); } catch { /* 忽略 */ }
    onStickMove(e);
  }

  function onStickMove(e) {
    if (stickPointer !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = stick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const len = Math.hypot(dx, dy);
    if (len > STICK_RADIUS) {
      dx = (dx / len) * STICK_RADIUS;
      dy = (dy / len) * STICK_RADIUS;
    }
    setKnob(dx, dy);
    // 上＝前進（-dy），右＝右移
    controls.setMoveAxis(dx / STICK_RADIUS, -dy / STICK_RADIUS);
  }

  function onStickUp(e) {
    if (stickPointer !== e.pointerId) return;
    e.stopPropagation();
    stickPointer = null;
    stick.classList.remove('is-active');
    setKnob(0, 0);
    controls.clearMoveAxis();
  }

  stick.addEventListener('pointerdown', onStickDown);
  stick.addEventListener('pointermove', onStickMove);
  stick.addEventListener('pointerup', onStickUp);
  stick.addEventListener('pointercancel', onStickUp);
  stick.addEventListener('lostpointercapture', onStickUp);

  function actionBtn(label, sub, onTap, cls = '') {
    const btn = el(`button.touch-btn${cls ? '.' + cls : ''}`, {
      type: 'button',
      'aria-label': label
    }, [
      el('span.touch-btn-label', { text: label }),
      sub && el('span.touch-btn-sub', { text: sub })
    ].filter(Boolean));
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); });
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      audio.click();
      onTap();
    });
    return btn;
  }

  const uvBtn = actionBtn('UV', '燈', () => {
    if (!store.hasItem('uv-lamp')) { hud.toast('還沒有 UV 燈'); return; }
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyU' }));
  });

  const buttons = el('div.touch-actions', {}, [
    actionBtn('互動', '準心處', () => interaction.activateCenter(), 'touch-btn--lead'),
    uvBtn,
    actionBtn('線索', '本', () => journal.toggle('clues')),
    actionBtn('提示', '備忘', () => journal.open('hints'))
  ]);

  const root = el('div.touch', { id: 'touch', hidden: true }, [stick, buttons]);
  document.body.appendChild(root);

  let shown = false;

  const api = {
    root,
    get visible() { return shown; },

    setVisible(v) {
      shown = !!v;
      root.hidden = !shown;
      document.documentElement.classList.toggle('touch-mode', shown);
      controls.setCenterRest(shown);   // 準心歸回中央，和「互動」鈕一致
      if (!shown) controls.clearMoveAxis();
    },

    /** 依設定與裝置決定要不要顯示 */
    apply(mode = store.settings.touchControls || 'auto') {
      const forced = new URLSearchParams(location.search).get('touch');
      if (forced === '1') return api.setVisible(true);
      if (forced === '0') return api.setVisible(false);
      if (mode === 'on') return api.setVisible(true);
      if (mode === 'off') return api.setVisible(false);
      return api.setVisible(isTouchDevice());
    },

    /** 面板或選單開著時收起搖桿，避免擋住內容 */
    setActive(active) {
      if (!shown) return;
      root.classList.toggle('is-dimmed', !active);
      root.style.pointerEvents = active ? '' : 'none';
      if (!active) {
        controls.clearMoveAxis();
        setKnob(0, 0);
      }
    }
  };

  // 更新「UV」鈕的可用狀態
  store.on('item', (id) => {
    if (id === 'uv-lamp') uvBtn.classList.add('is-ready');
  });
  if (store.hasItem('uv-lamp')) uvBtn.classList.add('is-ready');

  panel.onOpenChange((open) => api.setActive(!open));

  return api;
}
