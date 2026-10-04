// 放映機：把任何 { duration, render(g, W, H, t) } 的「片子」放在全螢幕畫布上播放。
// 前導片、幕間字卡、林默手記、結局都走這裡，畫面風格與跳過操作因此一致。
// 播放期間 cinema.active 為真，main.js 會暫停倒數，過場不會吃掉玩家的時間。

import { el, prefersReducedMotion } from '../core/util.js';
import { PAL, FONT, fade, ease, unit, text, wrap, decoFrame, rule, paper, weave, filmFX, gear } from './film.js';
import { createPrelude } from './prelude.js';
import { preludeScore, sting, ambience } from '../core/score.js';

export function createCinema({ audio, controls }) {
  const canvas = el('canvas.film-canvas', { 'aria-hidden': 'true' });
  const g = canvas.getContext('2d');
  const skip = el('button.film-skip', { type: 'button' }, [
    el('span', { text: '跳過' }),
    el('span.film-skip-key', { text: '空白鍵' })
  ]);
  const bar = el('div.film-bar', {}, [el('div.film-bar-fill')]);
  const caption = el('p.film-caption', { 'aria-live': 'polite' });
  const root = el('div.film', { id: 'film', hidden: true, role: 'dialog', 'aria-label': '過場影片' }, [canvas, caption, bar, skip]);
  document.body.appendChild(root);

  let current = null;
  let W = 0, H = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', () => { if (current) resize(); });

  /**
   * 播放一部片。
   * opts.skippable：可否跳過；opts.minHold：最少看幾秒才能跳（避免誤觸）
   * opts.label：螢幕閱讀器用的文字摘要
   * 回傳 Promise<{ skipped }>
   */
  function play(film, { skippable = true, minHold = 0.6, score = null, label = '', skipLabel = '跳過', translucent = false } = {}) {
    if (current) stop(true);
    resize();
    root.hidden = false;
    root.classList.toggle('is-translucent', translucent);
    skip.hidden = !skippable;
    skip.firstChild.textContent = skipLabel;
    caption.textContent = label;
    requestAnimationFrame(() => root.classList.add('is-open'));
    document.body.classList.add('film-open');
    const wasFrozen = controls ? controls.frozen : false;
    if (controls) controls.frozen = true;
    ambience.duck(true);

    return new Promise((resolve) => {
      const state = { film, t: 0, last: performance.now(), raf: 0, resolve, score, minHold, skippable, done: false, wasFrozen };
      current = state;
      const frame = (now) => {
        if (current !== state) return;
        // 分頁被切走時 dt 會很大：上限 0.1 秒，等於暫停
        // rAF 的時間戳可能早於開播時記下的 performance.now()，所以下限是 0
        const dt = Math.max(0, Math.min(0.1, (now - state.last) / 1000));
        state.last = now;
        state.t += dt;
        try { film.render(g, W, H, Math.min(state.t, film.duration)); } catch (err) { console.error('[film]', err); stop(true); return; }
        bar.firstChild.style.transform = `scaleX(${Math.min(1, state.t / film.duration)})`;
        if (state.t >= film.duration) { finish(false); return; }
        state.raf = requestAnimationFrame(frame);
      };
      state.raf = requestAnimationFrame(frame);
    });
  }

  function finish(skipped) {
    const state = current;
    if (!state || state.done) return;
    state.done = true;
    cancelAnimationFrame(state.raf);
    state.score?.stop?.(skipped ? 0.35 : 0.8);
    current = null;
    root.classList.remove('is-open');
    document.body.classList.remove('film-open');
    if (controls) controls.frozen = state.wasFrozen;
    ambience.duck(false);
    setTimeout(() => { if (!current) root.hidden = true; }, 420);
    state.resolve({ skipped });
  }

  function stop(skipped = true) { finish(skipped); }

  function trySkip() {
    if (!current || !current.skippable) return;
    if (current.t < current.minHold) return;
    finish(true);
  }

  skip.addEventListener('click', (e) => { e.stopPropagation(); trySkip(); });
  // 點畫面任何地方：字卡類的短片可直接繼續；前導片則需要按「跳過」鈕，避免誤觸
  root.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (e.target === skip || skip.contains(e.target)) return;
    if (current?.tapToSkip) trySkip();
  });
  window.addEventListener('keydown', (e) => {
    if (!current) return;
    if (['Space', 'Enter', 'Escape'].includes(e.code)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      trySkip();
    }
  }, true);

  const reduced = () => prefersReducedMotion();

  const api = {
    root,
    get active() { return !!current; },
    play,
    stop,

    /** 前導片 */
    async prelude({ minutes = 60 } = {}) {
      audio.init();
      const film = createPrelude({ minutes, reduced: reduced() });
      const score = preludeScore({ reduced: reduced() });
      return play(film, { score, minHold: 0, label: '前導片：一九四七年冬，魔術師林默在告別公演的第十二幕之後消失。三天後，檔案修復小組打開他封存的工作室，清場機關開始倒數。' });
    },

    /** 幕間字卡：第一幕／第二幕／第三幕 */
    async interlude({ kicker, title, sub = '', lines = [], duration = 6.5, tone = 'act' }) {
      const score = sting(tone);
      const film = interludeFilm({ kicker, title, sub, lines, duration, reduced: reduced() });
      const p = play(film, { score, minHold: 1.2, label: `${kicker}　${title}。${sub}`, skipLabel: '繼續', translucent: true });
      current.tapToSkip = true;
      return p;
    },

    /** 林默手記：拿到徽記等關鍵時刻的一頁回憶 */
    async memory({ title, text: body, sign = '——林默', duration = 9 }) {
      const score = sting('memory');
      const film = memoryFilm({ title, body, sign, duration, reduced: reduced() });
      const p = play(film, { score, minHold: 1.2, label: `${title}。${body}`, skipLabel: '收起', translucent: true });
      current.tapToSkip = true;
      return p;
    },

    /** 結局：片尾字卡＋演職員表 */
    async ending({ title, sub, lines, stats }) {
      const score = sting('ending');
      const film = endingFilm({ title, sub, lines, stats, reduced: reduced() });
      const p = play(film, { score, minHold: 1.5, label: `${title}。${lines.join('')}`, skipLabel: '跳到結算' });
      current.tapToSkip = false;
      return p;
    },

    /** 清場：時間用盡 */
    async wipe(lines) {
      const score = sting('wipe');
      const film = wipeFilm({ lines, reduced: reduced() });
      const p = play(film, { score, minHold: 1, label: lines.join(''), skipLabel: '繼續', translucent: true });
      current.tapToSkip = true;
      return p;
    }
  };
  return api;
}

// ── 幕間字卡 ─────────────────────────────────────────────────
function interludeFilm({ kicker, title, sub, lines, duration, reduced }) {
  const total = duration + lines.length * 3.2;
  return {
    duration: total,
    render(g, W, H, t) {
      const u = unit(W, H);
      g.save();
      g.clearRect(0, 0, W, H);
      const bgA = fade(t, 0, total, 0.5, 0.6);
      g.fillStyle = `rgba(11,8,6,${0.9 * bgA})`;
      g.fillRect(0, 0, W, H);
      weave(g, t, W, H, { reduced });
      const fw = Math.min(W * 0.88, u * 84);
      const fh = Math.min(H * 0.66, u * 44);
      const a = fade(t, 0.2, duration, 0.8, 0.7);
      decoFrame(g, W / 2, H / 2, fw, fh, { alpha: a, u });
      text(g, kicker, W / 2, H / 2 - fh * 0.24, Math.min(u * 2.6, fw / 16), { color: PAL.sepiaDim, alpha: a, spacing: 0.5 });
      text(g, title, W / 2, H / 2 - fh * 0.02, Math.min(u * 7, fw / (title.length + 2)), { color: PAL.brassLit, alpha: fade(t, 0.6, duration, 0.9, 0.7), spacing: 0.24, glow: u * 1.2, weight: 600 });
      rule(g, W / 2, H / 2 + fh * 0.14, Math.min(fw * 0.4, u * 24), { alpha: a, u });
      if (sub) text(g, sub, W / 2, H / 2 + fh * 0.27, Math.min(u * 2.4, fw / (sub.length + 4)), { color: PAL.sepia, alpha: fade(t, 1.2, duration, 0.8, 0.7), spacing: 0.12 });
      // 之後的台詞字卡
      lines.forEach((line, i) => {
        const a0 = duration + i * 3.2;
        const la = fade(t, a0, a0 + 3.2, 0.5, 0.5);
        if (la <= 0) return;
        const size = Math.min(u * 3.6, W / 14);
        wrap(g, line, Math.min(W * 0.8, u * 70), size).forEach((l, k, arr) => {
          text(g, l, W / 2, H / 2 + (k - (arr.length - 1) / 2) * size * 1.7, size, { color: PAL.sepia, alpha: la, spacing: 0.06 });
        });
      });
      g.restore();
      filmFX(g, t, W, H, { reduced, vignette: 0.8 * bgA, grainAmt: 0.8 * bgA, flicker: bgA, scratches: bgA });
    }
  };
}

// ── 林默手記（紙頁＋楷書）─────────────────────────────────────
function memoryFilm({ title, body, sign, duration, reduced }) {
  return {
    duration,
    render(g, W, H, t) {
      const u = unit(W, H);
      g.save();
      g.clearRect(0, 0, W, H);
      const bgA = fade(t, 0, duration, 0.5, 0.6);
      g.fillStyle = `rgba(11,8,6,${0.82 * bgA})`;
      g.fillRect(0, 0, W, H);
      weave(g, t, W, H, { reduced });
      const ph = Math.min(H * 0.8, u * 62);
      const pw = Math.min(W * 0.9, ph * 1.25);
      const a = fade(t, 0.15, duration, 0.7, 0.6);
      const lift = (1 - ease((t - 0.15) / 0.9)) * u * 3;
      g.globalAlpha = a;
      paper(g, W / 2, H / 2 + lift, pw, ph, { seed: title.length * 31 + 7, rot: -0.01 });
      const k = ph / 62;
      const top = H / 2 + lift - ph / 2;
      text(g, title, W / 2, top + k * 7, k * 3, { color: '#5a3a1e', spacing: 0.3, weight: 600 });
      rule(g, W / 2, top + k * 11, pw * 0.4, { color: '#7a5a30', u: k });
      // 楷書逐行浮現
      const size = Math.min(k * 3.3, pw / 17);
      const lines = wrap(g, body, pw * 0.8, size, FONT.hand);
      const lh = size * 1.9;
      const y0 = top + k * 18 + Math.max(0, (ph - k * 30 - lines.length * lh) / 2);
      lines.forEach((l, i) => {
        const la = ease((t - 0.8 - i * 0.55) / 0.8);
        text(g, l, W / 2 - pw * 0.4, y0 + i * lh, size, { color: '#2a1a0c', align: 'left', font: FONT.hand, alpha: la });
      });
      text(g, sign, W / 2 + pw * 0.4, top + ph - k * 7, size * 0.9, { color: '#5a3a1e', align: 'right', font: FONT.hand, alpha: ease((t - 1.2 - lines.length * 0.55) / 0.8) });
      g.restore();
      filmFX(g, t, W, H, { reduced, vignette: 0.7 * bgA, grainAmt: 0.6 * bgA, flicker: 0.5 * bgA, scratches: 0.4 * bgA });
    }
  };
}

// ── 結局：字卡 → 台詞 → 演職員表 ──────────────────────────────
function endingFilm({ title, sub, lines, stats, reduced }) {
  const titleDur = 5;
  const perLine = 5.2;
  const creditsAt = titleDur + lines.length * perLine;
  const credits = [
    ['主演', '檔案修復小組'],
    ['機關設計', '林默'],
    ['自動機', '它記得每一場'],
    ['使用時間', stats.time],
    ['排練備忘', `${stats.hints} 次`]
  ];
  const total = creditsAt + 9;
  return {
    duration: total,
    render(g, W, H, t) {
      const u = unit(W, H);
      g.save();
      g.fillStyle = PAL.black;
      g.fillRect(0, 0, W, H);
      weave(g, t, W, H, { reduced });
      // 片名卡
      const a = fade(t, 0, titleDur, 0.8, 0.7);
      if (a > 0) {
        const fw = Math.min(W * 0.86, u * 80);
        const fh = Math.min(H * 0.6, u * 40);
        decoFrame(g, W / 2, H / 2, fw, fh, { alpha: a, u });
        text(g, '尾　聲', W / 2, H / 2 - fh * 0.22, Math.min(u * 2.6, fw / 14), { color: PAL.sepiaDim, alpha: a, spacing: 0.5 });
        text(g, title, W / 2, H / 2, Math.min(u * 7.5, fw / 5), { color: PAL.brassLit, alpha: a, spacing: 0.3, glow: u, weight: 600 });
        text(g, sub, W / 2, H / 2 + fh * 0.24, Math.min(u * 2.4, fw / (sub.length + 4)), { color: PAL.sepia, alpha: a, spacing: 0.12 });
      }
      // 台詞卡
      lines.forEach((line, i) => {
        const a0 = titleDur + i * perLine;
        const la = fade(t, a0, a0 + perLine, 0.7, 0.6);
        if (la <= 0) return;
        const size = Math.min(u * 3.4, W / 15);
        const ls = wrap(g, line, Math.min(W * 0.82, u * 74), size);
        ls.forEach((l, k) => text(g, l, W / 2, H / 2 + (k - (ls.length - 1) / 2) * size * 1.75, size, { color: PAL.sepia, alpha: la, spacing: 0.05 }));
      });
      // 演職員表
      const ca = fade(t, creditsAt, total, 0.8, 1.2);
      if (ca > 0) {
        const spin = (t - creditsAt) * 0.3;
        gear(g, W * 0.12, H * 0.84, Math.min(W, H) * 0.2, 16, spin, { color: 'rgba(120,90,40,.12)', alpha: ca });
        gear(g, W * 0.9, H * 0.16, Math.min(W, H) * 0.14, 12, -spin * 1.4, { color: 'rgba(120,90,40,.1)', alpha: ca });
        const size = Math.min(u * 2.6, W / 20);
        text(g, '第十三幕　完', W / 2, H * 0.2, size * 1.6, { color: PAL.brassLit, alpha: ca, spacing: 0.3, weight: 600 });
        credits.forEach(([k, v], i) => {
          const y = H * 0.36 + i * size * 2.3;
          const ra = ca * ease((t - creditsAt - 0.6 - i * 0.35) / 0.6);
          text(g, k, W / 2 - size * 0.8, y, size * 0.85, { color: PAL.sepiaDim, align: 'right', alpha: ra, spacing: 0.2 });
          text(g, v, W / 2 + size * 0.8, y, size, { color: PAL.sepia, align: 'left', alpha: ra, spacing: 0.08 });
        });
      }
      g.restore();
      filmFX(g, t, W, H, { reduced });
    }
  };
}

// ── 清場（時間用盡）─────────────────────────────────────────
function wipeFilm({ lines, reduced }) {
  const per = 3.4;
  const total = lines.length * per + 1.6;
  return {
    duration: total,
    render(g, W, H, t) {
      const u = unit(W, H);
      g.save();
      g.clearRect(0, 0, W, H);
      // 燈一格一格暗下去
      const steps = Math.min(6, Math.floor(t / 0.35));
      g.fillStyle = `rgba(6,4,4,${0.4 + steps * 0.1})`;
      g.fillRect(0, 0, W, H);
      weave(g, t, W, H, { reduced });
      lines.forEach((line, i) => {
        const a = fade(t, 0.6 + i * per, 0.6 + (i + 1) * per, 0.6, 0.6);
        const size = Math.min(u * 3.6, W / 14);
        wrap(g, line, Math.min(W * 0.8, u * 70), size).forEach((l, k, arr) => {
          text(g, l, W / 2, H / 2 + (k - (arr.length - 1) / 2) * size * 1.7, size, { color: '#d9a090', alpha: a, spacing: 0.06 });
        });
      });
      g.restore();
      filmFX(g, t, W, H, { reduced, flicker: 2 });
    }
  };
}
