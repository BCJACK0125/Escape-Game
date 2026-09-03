// 抬頭顯示：倒數、三枚徽記、互動提示、字幕、進度環（靜默／合字用）。
// 所有回饋都走這裡，讓「即時回饋」在整個遊戲裡表現一致。

import { el, formatClock, wait } from '../core/util.js';
import { SIGILS } from '../config.js';
import { store } from '../state/store.js';

export function createHUD({ onJournal, onHint, onMenu }) {
  const timerValue = el('span.hud-timer-value', { text: '60:00' });
  const timerNote = el('span.hud-timer-note', { text: '清場倒數' });
  const timer = el('div.hud-timer', {}, [timerNote, timerValue]);

  const sigilEls = {};
  const sigilRow = el('div.hud-sigils', {}, Object.values(SIGILS).map((s) => {
    const node = el('div.hud-sigil', { dataset: { kind: s.id }, title: s.name }, [
      el('span.hud-sigil-mark', { text: { sun: '☀', moon: '☾', star: '✦' }[s.id] }),
      el('span.hud-sigil-digit', { text: '—' })
    ]);
    sigilEls[s.id] = node;
    return node;
  }));

  const objective = el('p.hud-objective');
  const progress = el('p.hud-progress');

  const promptLabel = el('span.prompt-label');
  const promptHint = el('span.prompt-hint');
  const prompt = el('div.hud-prompt', { hidden: true }, [promptLabel, promptHint]);

  const subtitle = el('div.hud-subtitle', { hidden: true });
  const toasts = el('div.hud-toasts');
  const banner = el('div.hud-banner', { hidden: true });

  const meterFill = el('div.meter-fill');
  const meterLabel = el('span.meter-label');
  const meterValue = el('span.meter-value');
  const meter = el('div.hud-meter', { hidden: true }, [
    el('div.meter-head', {}, [meterLabel, meterValue]),
    el('div.meter-track', {}, [meterFill])
  ]);

  const reticle = el('div.hud-reticle');

  const buttons = el('div.hud-buttons', {}, [
    el('button.hud-btn', { type: 'button', text: '線索本', title: '線索本 (I)', onclick: () => onJournal?.() }),
    el('button.hud-btn', { type: 'button', text: '排練備忘', title: '提示 (H)', onclick: () => onHint?.() }),
    el('button.hud-btn', { type: 'button', text: '選單', title: '選單 (Esc)', onclick: () => onMenu?.() })
  ]);

  const root = el('div.hud', { id: 'hud' }, [
    el('div.hud-topleft', {}, [timer, sigilRow]),
    el('div.hud-topright', {}, [buttons]),
    el('div.hud-bottomleft', {}, [objective, progress]),
    reticle, prompt, meter, subtitle, toasts, banner
  ]);
  document.body.appendChild(root);

  let subtitleToken = 0;

  const hud = {
    root,

    setPrompt(info) {
      if (!info || !info.label) {
        prompt.hidden = true;
        reticle.classList.remove('is-active');
        return;
      }
      prompt.hidden = false;
      promptLabel.textContent = info.label;
      promptHint.textContent = info.tooFar ? '走近一點' : (info.hint || '點擊或按 E');
      prompt.classList.toggle('is-far', !!info.tooFar);
      reticle.classList.toggle('is-active', !info.tooFar);
    },

    setObjective(text) { objective.textContent = text || ''; },

    refreshProgress() {
      const p = store.progress();
      progress.textContent = `節點 ${p.done} / ${p.total}　提示 ${store.hintsUsed()}`;
    },

    refreshSigils() {
      Object.values(SIGILS).forEach((s) => {
        const has = store.hasSigil(s.id);
        sigilEls[s.id].classList.toggle('is-held', has);
        sigilEls[s.id].querySelector('.hud-sigil-digit').textContent = has ? s.digit : '—';
      });
    },

    setTimer(seconds, { limitless = false } = {}) {
      if (limitless) {
        timerValue.textContent = formatClock(seconds);
        timerNote.textContent = '排練模式';
        timer.classList.remove('is-urgent', 'is-critical');
        return;
      }
      timerValue.textContent = formatClock(seconds);
      timer.classList.toggle('is-urgent', seconds <= 600);
      timer.classList.toggle('is-critical', seconds <= 120);
    },

    toast(text, ms = 2600) {
      const node = el('div.toast', { text });
      toasts.appendChild(node);
      requestAnimationFrame(() => node.classList.add('is-in'));
      setTimeout(() => {
        node.classList.remove('is-in');
        setTimeout(() => node.remove(), 400);
      }, ms);
    },

    /** 單句字幕 */
    say(text, ms = 3200) {
      subtitleToken++;
      const token = subtitleToken;
      subtitle.hidden = false;
      subtitle.textContent = text;
      subtitle.classList.add('is-in');
      if (ms > 0) {
        setTimeout(() => {
          if (token !== subtitleToken) return;
          subtitle.classList.remove('is-in');
          setTimeout(() => { if (token === subtitleToken) subtitle.hidden = true; }, 400);
        }, ms);
      }
    },

    /** 連續台詞，回傳 Promise（過場用） */
    async sequence(lines, per = 3000) {
      for (const line of [].concat(lines)) {
        this.say(line, per + 400);
        await wait(per);
      }
      this.clearSubtitle();
    },

    clearSubtitle() {
      subtitleToken++;
      subtitle.classList.remove('is-in');
      setTimeout(() => { subtitle.hidden = true; }, 300);
    },

    /** 幕次橫幅 */
    async banner(title, sub = '', ms = 2600) {
      banner.replaceChildren(
        el('p.banner-title', { text: title }),
        sub ? el('p.banner-sub', { text: sub }) : el('span')
      );
      banner.hidden = false;
      requestAnimationFrame(() => banner.classList.add('is-in'));
      await wait(ms);
      banner.classList.remove('is-in');
      await wait(500);
      banner.hidden = true;
    },

    /** 進度環／條：靜默感測與視角合字的即時回饋 */
    showMeter(label, value = 0, text = '') {
      meter.hidden = false;
      meterLabel.textContent = label;
      meterValue.textContent = text || `${Math.round(value * 100)}%`;
      meterFill.style.width = `${Math.max(0, Math.min(1, value)) * 100}%`;
      meter.classList.toggle('is-full', value >= 0.999);
    },
    hideMeter() { meter.hidden = true; meter.classList.remove('is-full'); },

    flash(kind = 'ok') {
      document.body.classList.remove('flash-ok', 'flash-fail');
      void document.body.offsetWidth;
      document.body.classList.add(kind === 'ok' ? 'flash-ok' : 'flash-fail');
      setTimeout(() => document.body.classList.remove('flash-ok', 'flash-fail'), 620);
    },

    setVisible(v) { root.hidden = !v; },
    setCinematic(v) { root.classList.toggle('is-cinematic', v); }
  };

  store.on('sigil', () => { hud.refreshSigils(); hud.refreshProgress(); });
  store.on('node:done', () => hud.refreshProgress());
  store.on('hint', () => hud.refreshProgress());
  store.on('load', () => { hud.refreshSigils(); hud.refreshProgress(); });

  hud.refreshSigils();
  hud.refreshProgress();
  return hud;
}
