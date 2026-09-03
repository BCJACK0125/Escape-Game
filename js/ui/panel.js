// 近景面板：把「湊近看一個機關」抽象成統一的 UI 容器。
// 空間感（走過去、看見、距離）交給 3D；精細操作（撥號、疊圖、輸入）交給面板。

import { el, $ } from '../core/util.js';
import { audio } from '../core/audio.js';

let root = null;
let current = null;
const openListeners = new Set();

function ensureRoot() {
  if (root) return root;
  root = el('div.panel-scrim', { id: 'panel-root', hidden: true });
  root.addEventListener('pointerdown', (e) => {
    if (e.target === root) panel.close();
  });
  document.body.appendChild(root);
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && current) {
      e.preventDefault();
      panel.close();
    }
  });
  return root;
}

export const panel = {
  get isOpen() { return !!current; },
  get id() { return current?.id || null; },

  onOpenChange(fn) { openListeners.add(fn); return () => openListeners.delete(fn); },

  open({ id, title, kicker, subtitle, wide = false, tall = false, render, onClose, closeLabel = '退開' }) {
    ensureRoot();
    if (current) this.close({ silent: true });

    const body = el('div.panel-body');
    const status = el('p.panel-status', { role: 'status', 'aria-live': 'polite' });
    const closeBtn = el('button.panel-close', {
      type: 'button', 'aria-label': '關閉近景', text: closeLabel,
      onclick: () => this.close()
    });

    const card = el('section.panel', { class: `panel${wide ? ' panel--wide' : ''}${tall ? ' panel--tall' : ''}` }, [
      el('header.panel-head', {}, [
        el('div.panel-heads', {}, [
          kicker && el('p.panel-kicker', { text: kicker }),
          el('h2.panel-title', { text: title }),
          subtitle && el('p.panel-sub', { text: subtitle })
        ].filter(Boolean)),
        closeBtn
      ]),
      body,
      el('footer.panel-foot', {}, [status])
    ]);

    root.replaceChildren(card);
    root.hidden = false;
    requestAnimationFrame(() => root.classList.add('is-open'));

    const api = {
      id, body, card,
      status(msg, type = '') {
        status.textContent = msg || '';
        status.className = `panel-status${type ? ' is-' + type : ''}`;
      },
      fail(msg = '沒有反應。') {
        this.status(msg, 'fail');
        audio.error();
        card.classList.remove('is-shake');
        void card.offsetWidth;
        card.classList.add('is-shake');
      },
      ok(msg) {
        this.status(msg, 'ok');
        audio.success();
      },
      close: (opts) => this.close(opts)
    };

    current = { id, api, onClose };
    try { render?.(body, api); } catch (err) { console.error(`[panel:${id}]`, err); }
    openListeners.forEach((fn) => fn(true, id));
    audio.softClick();
    // 讓面板可用鍵盤操作
    (body.querySelector('button, input, [tabindex]') || closeBtn)?.focus?.({ preventScroll: true });
    return api;
  },

  close({ silent = false } = {}) {
    if (!current) return;
    const { onClose, id } = current;
    current = null;
    root?.classList.remove('is-open');
    const done = () => { if (root && !current) { root.hidden = true; root.replaceChildren(); } };
    setTimeout(done, 220);
    openListeners.forEach((fn) => fn(false, id));
    if (!silent) audio.softClick();
    try { onClose?.(); } catch (err) { console.error('[panel:close]', err); }
  },

  /** 面板內常用的小工具 */
  row(children, cls = '') { return el(`div.panel-row${cls ? '.' + cls : ''}`, {}, children); },
  note(text) { return el('p.panel-note', { text }); },
  button(label, onClick, cls = '') {
    return el(`button.btn${cls ? '.' + cls : ''}`, { type: 'button', text: label, onclick: onClick });
  }
};

export default panel;
