'use strict';
/* ============================================================
   SKYBOUND · audio.js — WebAudio synth: SFX + ambient pad music
   Everything is generated at runtime. Never autoplays: the
   AudioContext is created/resumed on first user gesture.
   ============================================================ */
class AudioSystem {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.soundOn = Save.data.sound;
    this.musicOn = Save.data.music;
    this.musicStarted = false;
    this._collectStreak = 0;
    this._streakT = 0;
    this._musicTimer = null;
    this._padOscs = [];
    this._windSrc = null;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.soundOn ? 1 : 0;
      this.sfxGain.connect(this.master);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicOn ? 0.16 : 0;
      this.musicGain.connect(this.master);
      if (this.musicOn) this.startMusic();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setSound(on) {
    this.soundOn = on;
    Save.data.sound = on; Save.save();
    if (this.sfxGain) this.sfxGain.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.02);
  }

  setMusic(on) {
    this.musicOn = on;
    Save.data.music = on; Save.save();
    if (!this.ctx) return;
    if (on) { this.startMusic(); this.musicGain.gain.setTargetAtTime(0.16, this.ctx.currentTime, 0.4); }
    else this.musicGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
  }

  /* ---------- tiny synth primitives ---------- */
  _tone(freq, dur, { type = 'sine', vol = 0.2, attack = 0.005, slideTo = 0, delay = 0 } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.sfxGain);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  _noise(dur, { vol = 0.25, freq = 1200, q = 1, slideTo = 0, type = 'bandpass', delay = 0 } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, (dur * this.ctx.sampleRate) | 0);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
    if (slideTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.sfxGain);
    src.start(t0);
  }

  /* ---------- Game SFX ---------- */
  flap() {
    this._noise(0.16, { vol: 0.16, freq: 900, slideTo: 2600, q: 0.8 });
    this._tone(rand(560, 640), 0.12, { type: 'triangle', vol: 0.09, slideTo: 980 });
  }

  collect() {
    const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
    if (now - this._streakT > 900) this._collectStreak = 0; else this._collectStreak++;
    this._streakT = now;
    const base = 880 * Math.pow(1.06, Math.min(12, this._collectStreak));
    this._tone(base, 0.14, { type: 'sine', vol: 0.16 });
    this._tone(base * 1.5, 0.18, { type: 'sine', vol: 0.1, delay: 0.05 });
  }

  combo(level) {
    this._tone(500 + level * 90, 0.16, { type: 'triangle', vol: 0.14 });
    this._tone(750 + level * 135, 0.2, { type: 'sine', vol: 0.1, delay: 0.06 });
  }

  powerup() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => this._tone(n, 0.22, { type: 'triangle', vol: 0.13, delay: i * 0.07 }));
  }

  revive() {
    [392, 523, 659, 880].forEach((n, i) => this._tone(n, 0.26, { type: 'triangle', vol: 0.15, delay: i * 0.08 }));
    this._noise(0.3, { vol: 0.12, freq: 1800, slideTo: 300 });
  }

  bomb() {
    this._noise(0.4, { vol: 0.5, freq: 480, slideTo: 55, type: 'lowpass' });
    this._tone(72, 0.45, { type: 'sine', vol: 0.4, slideTo: 30 });
  }

  phased() {
    this._tone(1100, 0.16, { type: 'sine', vol: 0.12, slideTo: 1900 });
  }

  hit() {
    this._noise(0.3, { vol: 0.5, freq: 700, slideTo: 120, type: 'lowpass' });
    this._tone(90, 0.4, { type: 'sine', vol: 0.4, slideTo: 40 });
  }

  gameover() {
    const notes = [392, 330, 262, 196];
    notes.forEach((n, i) => this._tone(n, 0.4, { type: 'triangle', vol: 0.16, delay: i * 0.22 }));
  }

  milestone() {
    [660, 880, 1320].forEach((n, i) => this._tone(n, 0.3, { type: 'sine', vol: 0.14, delay: i * 0.09 }));
  }

  event() {
    this._tone(330, 0.5, { type: 'sine', vol: 0.12, slideTo: 660 });
    this._noise(0.5, { vol: 0.06, freq: 500, slideTo: 3000 });
  }

  click() {
    this._tone(640, 0.07, { type: 'triangle', vol: 0.12 });
  }

  record() {
    [523, 659, 784, 1046, 1318].forEach((n, i) => this._tone(n, 0.34, { type: 'triangle', vol: 0.15, delay: i * 0.1 }));
  }

  /* ---------- Generative ambient music ---------- */
  startMusic() {
    if (!this.ctx || this.musicStarted) return;
    this.musicStarted = true;
    const ctx = this.ctx;

    // Warm pad: 3 detuned voices through a soft lowpass
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    filter.Q.value = 0.6;
    filter.connect(this.musicGain);

    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      const g = ctx.createGain();
      g.gain.value = 0.33;
      o.connect(g); g.connect(filter);
      o.start();
      this._padOscs.push(o);
    }

    // Gentle wind bed
    const len = 2 * ctx.sampleRate;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { // brown-ish noise
      last = (last + (Math.random() * 2 - 1) * 0.02) * 0.998;
      d[i] = last * 3;
    }
    const wind = ctx.createBufferSource();
    wind.buffer = buf; wind.loop = true;
    const wf = ctx.createBiquadFilter();
    wf.type = 'lowpass'; wf.frequency.value = 400;
    const wg = ctx.createGain(); wg.gain.value = 0.05;
    wind.connect(wf); wf.connect(wg); wg.connect(this.musicGain);
    wind.start();
    this._windSrc = wind;

    // Slow chord progression: Am — F — C — G (calm, floating)
    const CHORDS = [
      [110.0, 220.0, 261.63, 329.63],
      [87.31, 174.61, 220.0, 261.63],
      [130.81, 196.0, 261.63, 329.63],
      [98.0, 196.0, 246.94, 293.66]
    ];
    let chordIdx = 0;
    const applyChord = () => {
      if (!this.musicStarted) return;
      const c = CHORDS[chordIdx % CHORDS.length];
      chordIdx++;
      const now = ctx.currentTime;
      this._padOscs.forEach((o, i) => {
        o.frequency.setTargetAtTime(c[i % c.length] * (i === 0 ? 1 : rand(0.998, 1.002)), now, 1.6);
      });
    };
    applyChord();
    this._musicTimer = setInterval(applyChord, 7000);
  }

  stopMusic() {
    this.musicStarted = false;
    if (this._musicTimer) { clearInterval(this._musicTimer); this._musicTimer = null; }
    this._padOscs.forEach(o => { try { o.stop(); } catch (e) {} });
    this._padOscs.length = 0;
    if (this._windSrc) { try { this._windSrc.stop(); } catch (e) {} this._windSrc = null; }
  }
}
