// 配樂與環境聲：全部用 Web Audio 合成，不含音檔。
//   · filmScore：前導片的鋼琴圓舞曲、放映機轉動聲與音效，時間軸與畫面一致
//   · sting：幕間字卡與手記的短音型
//   · ambience：房間底噪、牆裡的鐘擺聲；剩餘時間越少越緊
import { audio } from './audio.js';

const midiFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

function piano(bus, midi, at, { dur = 1.8, gain = 0.07 } = {}) {
  const f = midiFreq(midi);
  audio.tone({ freq: f, dur, gain, type: 'triangle', attack: 0.004, at, out: bus });
  audio.tone({ freq: f * 2, dur: dur * 0.45, gain: gain * 0.32, type: 'sine', attack: 0.004, at, out: bus });
  audio.tone({ freq: f * 3.01, dur: dur * 0.22, gain: gain * 0.1, type: 'sine', attack: 0.003, at, out: bus });
}

function musicBox(bus, midi, at, gain = 0.05) {
  const f = midiFreq(midi);
  audio.tone({ freq: f, dur: 1.3, gain, type: 'sine', attack: 0.002, at, out: bus });
  audio.tone({ freq: f * 4.02, dur: 0.35, gain: gain * 0.25, type: 'sine', attack: 0.002, at, out: bus });
}

function pad(bus, midis, at, dur, gain = 0.02) {
  midis.forEach((m, i) => audio.tone({
    freq: midiFreq(m), dur, gain, type: 'sawtooth', attack: Math.min(1.4, dur * 0.4), at,
    detune: (i % 2 ? 6 : -6), filter: { type: 'lowpass', freq: 700, q: 0.6 }, out: bus
  }));
}

function whoosh(bus, at, { dur = 0.9, from = 300, to = 2600, gain = 0.12 } = {}) {
  const ctx = audio.ctx;
  const t = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = audio.noise;
  src.loop = true;
  const bq = ctx.createBiquadFilter();
  bq.type = 'bandpass';
  bq.Q.value = 1.2;
  bq.frequency.setValueAtTime(from, t);
  bq.frequency.exponentialRampToValueAtTime(to, t + dur * 0.6);
  bq.frequency.exponentialRampToValueAtTime(from * 0.8, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.5);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bq).connect(g).connect(bus);
  src.start(t);
  src.stop(t + dur + 0.05);
}

function boom(bus, at, gain = 0.4) {
  const ctx = audio.ctx;
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(96, t);
  osc.frequency.exponentialRampToValueAtTime(30, t + 1.2);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
  osc.connect(g).connect(bus);
  osc.start(t);
  osc.stop(t + 1.7);
  audio.noiseBurst({ dur: 1.1, gain: 0.12, freq: 420, type: 'lowpass', at, out: bus });
}

function shimmer(bus, at) {
  for (let i = 0; i < 9; i++) {
    audio.tone({ freq: 1400 + i * 260, dur: 0.6, gain: 0.025, type: 'sine', at: at + i * 0.035, out: bus });
  }
}

function creak(bus, at, gain = 0.05) {
  const ctx = audio.ctx;
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(70, t);
  osc.frequency.linearRampToValueAtTime(110, t + 0.5);
  osc.frequency.linearRampToValueAtTime(64, t + 1.3);
  const bq = ctx.createBiquadFilter();
  bq.type = 'bandpass';
  bq.frequency.value = 620;
  bq.Q.value = 6;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.2);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
  osc.connect(bq).connect(g).connect(bus);
  osc.start(t);
  osc.stop(t + 1.5);
}

function tick(bus, at, high = true, gain = 0.05) {
  audio.noiseBurst({ dur: 0.025, gain, freq: high ? 3400 : 2600, q: 3, at, out: bus });
}

/** 放映機轉動聲：帶 18Hz 顫動的窄頻噪音，回傳停止函式 */
function projector(bus, gain = 0.03) {
  const ctx = audio.ctx;
  const src = ctx.createBufferSource();
  src.buffer = audio.noise;
  src.loop = true;
  const bq = ctx.createBiquadFilter();
  bq.type = 'bandpass';
  bq.frequency.value = 1900;
  bq.Q.value = 0.9;
  const g = ctx.createGain();
  g.gain.value = gain * 0.5;
  const lfo = ctx.createOscillator();
  lfo.type = 'square';
  lfo.frequency.value = 18;
  const depth = ctx.createGain();
  depth.gain.value = gain * 0.5;
  lfo.connect(depth).connect(g.gain);
  src.connect(bq).connect(g).connect(bus);
  src.start();
  lfo.start();
  return () => { try { src.stop(); lfo.stop(); } catch { /* 已停 */ } };
}

// ── 前導片配樂（與 js/cinema/prelude.js 的時間軸對齊）──────────────
const CHORDS = {
  Am: { bass: 45, triad: [57, 60, 64] },
  F: { bass: 41, triad: [53, 57, 60] },
  Dm: { bass: 50, triad: [57, 62, 65] },
  E: { bass: 40, triad: [52, 56, 59] },
  C: { bass: 48, triad: [60, 64, 67] }
};

// 每小節的旋律：[拍, midi, 拍長]
const WALTZ = [
  ['Am', [[0, 76, 2], [2, 72, 1]]],
  ['F', [[0, 77, 1.5], [1.5, 76, 0.5], [2, 72, 1]]],
  ['Dm', [[0, 74, 2], [2, 69, 1]]],
  ['E', [[0, 71, 1], [1, 68, 1], [2, 64, 1]]],
  ['Am', [[0, 69, 2], [2, 72, 1]]],
  ['F', [[0, 77, 2], [2, 76, 1]]],
  ['E', [[0, 71, 1.5], [1.5, 74, 0.5], [2, 71, 1]]],
  ['E', [[0, 68, 3]]]
];

export function preludeScore({ reduced = false } = {}) {
  const ctx = audio.init();
  if (!ctx) return { stop() {} };
  const bus = audio.createBus(0.9);
  const music = ctx.createGain();
  music.connect(bus);
  const stopProjector = projector(bus, 0.026);

  // 0–4.5 片頭倒數：三聲嗶
  [0.6, 1.8, 3.0].forEach((t) => audio.tone({ freq: 1000, dur: 0.12, gain: 0.06, type: 'sine', at: t, out: bus }));
  audio.tone({ freq: 1000, dur: 0.5, gain: 0.05, type: 'sine', at: 4.2, out: bus });

  // 4.5–20.8 圓舞曲
  const beat = 0.72;
  const start = 4.5;
  WALTZ.forEach(([chord, melody], m) => {
    const t0 = start + m * beat * 3;
    const c = CHORDS[chord];
    piano(music, c.bass, t0, { dur: 2.2, gain: 0.06 });
    c.triad.forEach((n) => { piano(music, n, t0 + beat, { dur: 0.7, gain: 0.025 }); piano(music, n, t0 + beat * 2, { dur: 0.7, gain: 0.022 }); });
    melody.forEach(([b, n, len]) => piano(music, n, t0 + b * beat, { dur: Math.max(0.9, len * beat * 1.6), gain: 0.07 }));
  });
  pad(music, [45, 52], 4.5, 7, 0.012);
  pad(music, [41, 48], 11.5, 6, 0.012);
  pad(music, [40, 47], 17.0, 4, 0.014);

  // 20.8 燈滅：音樂驟停 → 爆閃
  music.gain.setValueAtTime(1, ctx.currentTime + 20.75);
  music.gain.linearRampToValueAtTime(0, ctx.currentTime + 20.85);
  shimmer(bus, 20.2);
  boom(bus, 20.8, reduced ? 0.22 : 0.38);
  music.gain.setValueAtTime(0, ctx.currentTime + 22.4);
  music.gain.linearRampToValueAtTime(1, ctx.currentTime + 23.4);

  // 22.6– 只剩一頂帽子：音樂盒
  [[22.8, 81], [23.5, 79], [24.2, 76], [25.0, 77], [25.8, 76], [26.6, 72]].forEach(([t, n]) => musicBox(music, n, t));
  pad(music, [45, 52, 60], 22.6, 5, 0.01);

  // 26.5 報紙
  whoosh(bus, 26.4, { dur: 1.0 });
  audio.noiseBurst({ dur: 0.18, gain: 0.16, freq: 260, type: 'lowpass', at: 27.35, out: bus });
  pad(music, [40, 41, 52], 27.3, 4.6, 0.016);
  [27.4, 28.84, 30.28].forEach((t, i) => piano(music, [40, 41, 40][i], t, { dur: 1.6, gain: 0.07 }));

  // 32 工作室的門
  pad(music, [45, 52, 57], 32, 8, 0.012);
  creak(bus, 34.3, 0.06);
  for (let i = 0; i < 9; i++) tick(bus, 37.2 + i * 0.32, i % 2 === 0, 0.08);
  audio.noiseBurst({ dur: 0.12, gain: 0.12, freq: 2200, q: 0.8, at: 37.2, out: bus });
  [33.0, 35.16, 37.32].forEach((t, i) => musicBox(music, [69, 72, 76][i], t, 0.035));

  // 40 清場機關：滴答與心跳
  for (let s = 0; s < 6; s++) {
    tick(bus, 41 + s, true, 0.07);
    tick(bus, 41.5 + s, false, 0.05);
  }
  [40.2, 42.2, 44.2].forEach((t) => boom(bus, t, 0.16));
  pad(music, [40, 46], 40, 6, 0.014);

  // 46 片名：鐘聲和弦
  [0, 2, 4].forEach((i, k) => audio.bell(i, { at: 46.2 + k * 0.09, gain: 0.12, out: bus }));
  pad(music, [45, 52, 59, 64], 46.2, 5.5, 0.012);
  piano(music, 57, 46.2, { dur: 3.2, gain: 0.06 });
  piano(music, 76, 47.0, { dur: 3.2, gain: 0.05 });

  let stopped = false;
  return {
    bus,
    stop(seconds = 0.6) {
      if (stopped) return;
      stopped = true;
      audio.fadeBus(bus, 0, seconds, { disconnect: true });
      setTimeout(stopProjector, seconds * 1000);
    }
  };
}

/** 幕間字卡／手記／結局用的短音型 */
export function sting(kind = 'act') {
  const ctx = audio.init();
  if (!ctx) return { stop() {} };
  const bus = audio.createBus(0.9);
  if (kind === 'act') {
    const stopP = projector(bus, 0.018);
    piano(bus, 45, 0.05, { dur: 3, gain: 0.07 });
    [57, 60, 64, 69].forEach((n, i) => piano(bus, n, 0.3 + i * 0.22, { dur: 2.4, gain: 0.045 }));
    pad(bus, [45, 52, 57], 0.1, 4.5, 0.012);
    return { stop(s = 0.6) { audio.fadeBus(bus, 0, s, { disconnect: true }); setTimeout(stopP, s * 1000); } };
  }
  if (kind === 'memory') {
    [[0.1, 81], [0.55, 76], [1.0, 79], [1.6, 72], [2.3, 74], [3.0, 76]].forEach(([t, n]) => musicBox(bus, n, t, 0.04));
    pad(bus, [57, 64], 0.2, 4, 0.008);
    return { stop(s = 0.6) { audio.fadeBus(bus, 0, s, { disconnect: true }); } };
  }
  if (kind === 'ending') {
    const stopP = projector(bus, 0.02);
    const prog = ['Am', 'F', 'C', 'E', 'Am', 'F', 'Dm', 'E', 'Am'];
    prog.forEach((name, m) => {
      const c = CHORDS[name];
      const t0 = 0.2 + m * 2.4;
      piano(bus, c.bass, t0, { dur: 2.4, gain: 0.055 });
      c.triad.forEach((n, i) => piano(bus, n + 12, t0 + 0.8 + i * 0.27, { dur: 1.2, gain: 0.025 }));
    });
    pad(bus, [45, 52, 57], 0.2, 22, 0.008);
    return { stop(s = 1) { audio.fadeBus(bus, 0, s, { disconnect: true }); setTimeout(stopP, s * 1000); } };
  }
  if (kind === 'wipe') {
    boom(bus, 0.05, 0.3);
    pad(bus, [33, 34, 40], 0.05, 5, 0.03);
    return { stop(s = 0.8) { audio.fadeBus(bus, 0, s, { disconnect: true }); } };
  }
  return { stop() {} };
}

/** 清場警告：齒輪換檔 */
export function gearShift() {
  const ctx = audio.init();
  if (!ctx) return;
  const bus = audio.createBus(1);
  for (let i = 0; i < 7; i++) tick(bus, i * 0.09, i % 2 === 0, 0.1);
  boom(bus, 0.6, 0.22);
  creak(bus, 0.2, 0.05);
  setTimeout(() => { try { bus.disconnect(); } catch { /* 忽略 */ } }, 3000);
}

// ── 房間環境聲 ───────────────────────────────────────────────
export const ambience = {
  bus: null,
  roomTone: null,
  timer: 0,
  tension: 0,
  phase: 0,
  nextCreak: 0,

  start() {
    const ctx = audio.init();
    if (!ctx || this.bus) return;
    this.bus = audio.createBus(0);
    audio.fadeBus(this.bus, 1, 2.5);
    // 房間底噪：低通噪音
    const src = ctx.createBufferSource();
    src.buffer = audio.noise;
    src.loop = true;
    const bq = ctx.createBiquadFilter();
    bq.type = 'lowpass';
    bq.frequency.value = 240;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    src.connect(bq).connect(g).connect(this.bus);
    src.start();
    this.roomTone = { src, g };
    this.nextCreak = 14 + Math.random() * 20;
    // 牆裡的鐘擺：一秒一響，緊張時半秒一響、低頻心跳加入
    let last = performance.now();
    this.timer = setInterval(() => {
      if (!this.bus || audio.ctx.state !== 'running') return;
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      this.phase += dt;
      const period = this.tension > 0.66 ? 0.5 : 1;
      if (this.phase >= period) {
        this.phase = 0;
        this.flip = !this.flip;
        tick(this.bus, 0, this.flip, 0.012 + this.tension * 0.03);
        if (this.tension > 0.33 && this.flip) {
          audio.tone({ freq: 52, dur: 0.3, gain: 0.03 + this.tension * 0.05, type: 'sine', out: this.bus });
        }
      }
      this.nextCreak -= dt;
      if (this.nextCreak <= 0) {
        this.nextCreak = 18 + Math.random() * 26;
        creak(this.bus, 0, 0.012 + Math.random() * 0.012);
      }
    }, 100);
  },

  /** 0..1：剩餘時間越少越高 */
  setTension(v) {
    this.tension = Math.max(0, Math.min(1, v));
    if (this.roomTone) this.roomTone.g.gain.value = 0.05 + this.tension * 0.05;
  },

  /** 過場時把環境聲壓低 */
  duck(on) {
    if (this.bus) audio.fadeBus(this.bus, on ? 0.15 : 1, 0.6);
  },

  stop() {
    if (!this.bus) return;
    clearInterval(this.timer);
    const { src } = this.roomTone || {};
    audio.fadeBus(this.bus, 0, 1.2, { disconnect: true });
    setTimeout(() => { try { src?.stop(); } catch { /* 已停 */ } }, 1300);
    this.bus = null;
    this.roomTone = null;
  }
};
