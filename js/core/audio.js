// 全部聲音都用 Web Audio 即時合成，專案不含任何音檔。
// 好處：零下載體積、可即時改變音高與音色、鐘繩／電話／鼓點能精準對齊互動。

const A4 = 440;
export const noteFreq = (semitonesFromA4) => A4 * Math.pow(2, semitonesFromA4 / 12);

// 五條鐘繩：五種音色與音高（純律感的五聲音階）
export const BELL_SPECS = [
  { freq: 392.0, type: 'triangle', partials: [1, 2.76, 5.4], decay: 2.6, name: '低銅鐘' },
  { freq: 466.2, type: 'sine', partials: [1, 2.4, 4.1], decay: 2.2, name: '銀鈴' },
  { freq: 523.3, type: 'triangle', partials: [1, 3.0, 6.2], decay: 2.0, name: '手鐘' },
  { freq: 622.3, type: 'sine', partials: [1, 2.1, 3.8], decay: 1.7, name: '玻璃鐘' },
  { freq: 784.0, type: 'triangle', partials: [1, 2.7, 4.9], decay: 1.4, name: '高音鈴' }
];

// 五段聲紋（孩童 → 年長）：基頻與共振腔不同，聽得出年齡差
export const VOICE_SPECS = [
  { name: '孩童', base: 296, formant: 1750, rough: 0.03, rate: 6.4 },
  { name: '少年', base: 232, formant: 1400, rough: 0.05, rate: 5.6 },
  { name: '青年', base: 176, formant: 1050, rough: 0.12, rate: 4.8 },
  { name: '中年', base: 132, formant: 820, rough: 0.22, rate: 4.2 },
  { name: '年長', base: 104, formant: 640, rough: 0.38, rate: 3.4 }
];

function makeNoiseBuffer(ctx, seconds = 2) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

export const audio = {
  ctx: null,
  master: null,
  noise: null,
  droneNodes: null,
  muted: false,
  _volume: 0.8,

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this._volume;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 6;
    this.master.connect(comp).connect(this.ctx.destination);
    this.noise = makeNoiseBuffer(this.ctx, 2.5);
    return this.ctx;
  },

  setVolume(v) {
    this._volume = v;
    if (this.master) this.master.gain.value = this.muted ? 0 : v;
  },

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : this._volume;
    return this.muted;
  },

  get time() { return this.ctx ? this.ctx.currentTime : 0; },

  // ── 基本單元 ────────────────────────────────────────────────
  tone({ freq = 440, dur = 0.3, type = 'sine', gain = 0.2, attack = 0.006, at = 0, detune = 0, filter = null }) {
    const ctx = this.init();
    if (!ctx) return;
    const t = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (detune) osc.detune.setValueAtTime(detune, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (filter) {
      const bq = ctx.createBiquadFilter();
      bq.type = filter.type || 'lowpass';
      bq.frequency.value = filter.freq || 1200;
      bq.Q.value = filter.q ?? 1;
      node.connect(bq);
      node = bq;
    }
    node.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  },

  noiseBurst({ dur = 0.4, gain = 0.2, freq = 900, type = 'bandpass', q = 1, at = 0 }) {
    const ctx = this.init();
    if (!ctx) return;
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const bq = ctx.createBiquadFilter();
    bq.type = type;
    bq.frequency.value = freq;
    bq.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bq).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.05);
  },

  // ── 遊戲音效 ────────────────────────────────────────────────
  hover() { this.tone({ freq: 1180, dur: 0.05, gain: 0.028, type: 'sine' }); },
  click() { this.tone({ freq: 660, dur: 0.07, gain: 0.075, type: 'square', filter: { freq: 2200 } }); },
  softClick() { this.tone({ freq: 320, dur: 0.09, gain: 0.05, type: 'sine' }); },

  success() {
    [0, 4, 7, 12].forEach((s, i) => this.tone({
      freq: noteFreq(s + 3), dur: 1.1, gain: 0.12, type: 'triangle', at: i * 0.075
    }));
  },

  error() {
    this.tone({ freq: 116, dur: 0.42, gain: 0.16, type: 'sawtooth', filter: { freq: 420 } });
    this.tone({ freq: 109, dur: 0.42, gain: 0.1, type: 'square', filter: { freq: 300 }, at: 0.04 });
  },

  latch() {
    this.noiseBurst({ dur: 0.11, gain: 0.2, freq: 2600, q: 0.8 });
    this.tone({ freq: 165, dur: 0.22, gain: 0.12, type: 'square', filter: { freq: 700 }, at: 0.02 });
  },

  drawer() {
    this.noiseBurst({ dur: 0.55, gain: 0.1, freq: 480, type: 'lowpass' });
    this.tone({ freq: 92, dur: 0.5, gain: 0.1, type: 'triangle' });
  },

  drum() {
    const ctx = this.init();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.34);
    g.gain.setValueAtTime(0.34, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.44);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.5);
    this.noiseBurst({ dur: 0.09, gain: 0.06, freq: 220, type: 'lowpass' });
  },

  /** 五條鐘繩之一：泛音堆疊 + 長衰減 */
  bell(index, { at = 0, gain = 0.22 } = {}) {
    const spec = BELL_SPECS[index % BELL_SPECS.length];
    spec.partials.forEach((mult, i) => {
      this.tone({
        freq: spec.freq * mult,
        dur: spec.decay / (1 + i * 0.7),
        gain: gain / (1 + i * 1.6),
        type: i === 0 ? spec.type : 'sine',
        attack: 0.004,
        at
      });
    });
    this.noiseBurst({ dur: 0.05, gain: 0.03, freq: spec.freq * 3, q: 2, at });
  },

  chord(indices = [0, 2, 4], spacing = 0.06) {
    indices.forEach((idx, i) => this.bell(idx, { at: i * spacing, gain: 0.18 }));
  },

  /** 依序播放鐘聲，回傳 Promise 供 UI 等待 */
  playBellSequence(sequence, interval = 0.62) {
    this.init();
    sequence.forEach((n, i) => this.bell(n - 1, { at: i * interval }));
    return new Promise((r) => setTimeout(r, sequence.length * interval * 1000 + 300));
  },

  dialClick() {
    this.noiseBurst({ dur: 0.035, gain: 0.14, freq: 1800, q: 1.4 });
  },

  dialReturn(steps = 6) {
    for (let i = 0; i < steps; i++) {
      this.noiseBurst({ dur: 0.03, gain: 0.1, freq: 1500 + i * 40, q: 2, at: i * 0.055 });
    }
  },

  phoneRing(times = 2) {
    for (let n = 0; n < times; n++) {
      const base = n * 1.6;
      for (let i = 0; i < 14; i++) {
        this.tone({ freq: i % 2 ? 1060 : 1400, dur: 0.05, gain: 0.09, type: 'sine', at: base + i * 0.05 });
      }
    }
    return new Promise((r) => setTimeout(r, times * 1600));
  },

  /** 合成「人聲」：不是語音合成，而是有年齡感的說話律動，搭配字幕 */
  speak(voiceIndex = 1, seconds = 1.6) {
    const ctx = this.init();
    if (!ctx) return;
    const spec = VOICE_SPECS[voiceIndex % VOICE_SPECS.length];
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const bq = ctx.createBiquadFilter();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc2.type = 'square';
    osc.frequency.value = spec.base;
    osc2.frequency.value = spec.base * 0.5;
    bq.type = 'bandpass';
    bq.frequency.value = spec.formant;
    bq.Q.value = 3.2;

    // 音節律動：用 gain 的階梯模擬說話
    const syllables = Math.max(3, Math.round(seconds * spec.rate / 2));
    g.gain.setValueAtTime(0.0001, t);
    for (let i = 0; i < syllables; i++) {
      const s = t + (i / syllables) * seconds;
      g.gain.exponentialRampToValueAtTime(0.07 + Math.random() * 0.05, s + 0.04);
      g.gain.exponentialRampToValueAtTime(0.006, s + seconds / syllables * 0.82);
      osc.frequency.exponentialRampToValueAtTime(spec.base * (0.88 + Math.random() * 0.3), s + 0.05);
    }
    g.gain.exponentialRampToValueAtTime(0.0001, t + seconds + 0.1);

    osc.connect(bq);
    osc2.connect(bq);
    bq.connect(g).connect(this.master);
    osc.start(t); osc2.start(t);
    osc.stop(t + seconds + 0.2); osc2.stop(t + seconds + 0.2);
    // 留聲機底噪
    this.noiseBurst({ dur: seconds, gain: 0.012, freq: 2600, type: 'highpass' });
    return new Promise((r) => setTimeout(r, seconds * 1000));
  },

  gramophoneHiss(on) {
    if (!on) { this.stopDrone('hiss'); return; }
    this.startDrone({ id: 'hiss', freq: 3000, type: 'highpass', gain: 0.02, noise: true });
  },

  /** 持續低頻／噪音層，用於靜默感測與終幕 */
  startDrone({ id = 'drone', freq = 58, gain = 0.06, type = 'lowpass', noise = false } = {}) {
    const ctx = this.init();
    if (!ctx) return;
    this.droneNodes = this.droneNodes || {};
    if (this.droneNodes[id]) return;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + 1.2);
    let src;
    if (noise) {
      src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const bq = ctx.createBiquadFilter();
      bq.type = type;
      bq.frequency.value = freq;
      src.connect(bq).connect(g).connect(this.master);
    } else {
      src = ctx.createOscillator();
      src.type = 'sine';
      src.frequency.value = freq;
      const bq = ctx.createBiquadFilter();
      bq.type = 'lowpass';
      bq.frequency.value = 200;
      src.connect(bq).connect(g).connect(this.master);
    }
    src.start();
    this.droneNodes[id] = { src, g };
  },

  stopDrone(id = 'drone') {
    const node = this.droneNodes?.[id];
    if (!node) return;
    const t = this.ctx.currentTime;
    node.g.gain.cancelScheduledValues(t);
    node.g.gain.setValueAtTime(node.g.gain.value || 0.0001, t);
    node.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    try { node.src.stop(t + 0.7); } catch { /* oscillator 可能已停 */ }
    delete this.droneNodes[id];
  },

  /** 靜默進度的即時回饋：進度越高，音高越上升 */
  silenceTick(progress) {
    this.tone({ freq: 320 + progress * 520, dur: 0.09, gain: 0.05, type: 'sine' });
  },

  applause(seconds = 3.2) {
    const ctx = this.init();
    if (!ctx) return;
    for (let i = 0; i < 46; i++) {
      this.noiseBurst({
        dur: 0.09 + Math.random() * 0.16,
        gain: 0.03 + Math.random() * 0.05,
        freq: 900 + Math.random() * 2600,
        q: 0.6,
        at: Math.random() * seconds
      });
    }
    this.tone({ freq: 196, dur: seconds, gain: 0.03, type: 'triangle', filter: { freq: 500 } });
  },

  curtain() {
    this.noiseBurst({ dur: 2.4, gain: 0.09, freq: 380, type: 'lowpass' });
    this.tone({ freq: 74, dur: 2.2, gain: 0.09, type: 'triangle' });
  },

  // ── 麥克風（靜默感測的可選強化）────────────────────────────
  mic: {
    stream: null, analyser: null, data: null, active: false,
    async start() {
      if (this.active) return true;
      try {
        const ctx = audio.init();
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true } });
        const src = ctx.createMediaStreamSource(this.stream);
        this.analyser = ctx.createAnalyser();
        this.analyser.fftSize = 1024;
        this.data = new Uint8Array(this.analyser.fftSize);
        src.connect(this.analyser);   // 不連到 destination，避免回音
        this.active = true;
        return true;
      } catch (err) {
        console.info('麥克風未啟用，改用「不動」判定。', err?.name || err);
        return false;
      }
    },
    /** 回傳 0..1 的音量（RMS） */
    level() {
      if (!this.active || !this.analyser) return 0;
      this.analyser.getByteTimeDomainData(this.data);
      let sum = 0;
      for (let i = 0; i < this.data.length; i++) {
        const v = (this.data[i] - 128) / 128;
        sum += v * v;
      }
      return Math.min(1, Math.sqrt(sum / this.data.length) * 6);
    },
    stop() {
      this.stream?.getTracks().forEach((t) => t.stop());
      this.stream = null;
      this.analyser = null;
      this.active = false;
    }
  }
};

export default audio;
