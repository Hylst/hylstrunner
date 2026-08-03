// Audio engine: procedural music & SFX via Web Audio API
// No external audio files needed.

type Ctx = AudioContext;

class AudioEngine {
  ctx: Ctx | null = null;
  master: GainNode | null = null;
  musicGain: GainNode | null = null;
  sfxGain: GainNode | null = null;
  musicOn = true;
  sfxOn = true;
  musicNodes: { stop: () => void }[] = [];
  currentLevel = 0;

  ensure() {
    if (this.ctx) return this.ctx;
    const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(ctx.destination);
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0.28;
    this.musicGain.connect(this.master);
    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = 0.55;
    this.sfxGain.connect(this.master);
    return ctx;
  }

  resume() {
    const ctx = this.ensure();
    if (ctx.state === "suspended") ctx.resume();
  }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    if (this.musicGain) {
      this.musicGain.gain.setTargetAtTime(this.musicOn ? 0.28 : 0, this.ctx!.currentTime, 0.05);
    }
    return this.musicOn;
  }

  toggleSfx() {
    this.sfxOn = !this.sfxOn;
    return this.sfxOn;
  }

  stopMusic() {
    this.musicNodes.forEach(n => { try { n.stop(); } catch {} });
    this.musicNodes = [];
  }

  // ---- Procedural music per level ----
  // Each level has its own scale, chord progression and arp pattern.
  startMusic(levelIndex: number) {
    this.stopMusic();
    const ctx = this.ensure();
    if (ctx.state === "suspended") ctx.resume();

    const level = LEVEL_MUSIC[levelIndex % LEVEL_MUSIC.length];
    const startTime = ctx.currentTime + 0.1;

    // Reverb-ish effect via delay
    const delay = ctx.createDelay(1.0);
    delay.delayTime.value = 0.32;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.28;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    delay.connect(feedback); feedback.connect(delay);
    delay.connect(wet); wet.connect(this.musicGain!);

    const pad = this.playPad(level, startTime);
    const bass = this.playBass(level, startTime);
    const arp = this.playArp(level, startTime);
    const drums = this.playDrums(level, startTime);

    // connect pad through delay for atmosphere
    pad.gain.connect(delay);
    arp.gain.connect(delay);

    this.musicNodes = [pad, bass, arp, drums];
  }

  private playPad(level: LevelMusic, start: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.6, start + 2);
    g.connect(this.musicGain!);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    filter.Q.value = 2;
    filter.connect(g);

    // LFO on filter
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.15;
    lfoGain.gain.value = 400;
    lfo.connect(lfoGain); lfoGain.connect(filter.frequency);
    lfo.start(start);

    const oscs: OscillatorNode[] = [];
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator();
      o.type = i === 0 ? "sawtooth" : "triangle";
      o.detune.value = (i - 1) * 8;
      o.connect(filter);
      o.start(start);
      oscs.push(o);
    }

    let step = 0;
    const bpm = level.bpm;
    const beat = 60 / bpm;
    const bar = beat * 4;
    const interval = setInterval(() => {
      if (!this.ctx) return;
      const chord = level.chords[step % level.chords.length];
      const now = this.ctx.currentTime;
      chord.forEach((semitone, i) => {
        const freq = level.root * Math.pow(2, semitone / 12) * (i === 0 ? 0.5 : 1);
        oscs[i].frequency.setTargetAtTime(freq, now, 0.4);
      });
      step++;
    }, bar * 1000);

    return {
      stop() {
        clearInterval(interval);
        const t = ctx.currentTime;
        g.gain.cancelScheduledValues(t);
        g.gain.setTargetAtTime(0, t, 0.15);
        oscs.forEach(o => { try { o.stop(t + 0.5); } catch {} });
        try { lfo.stop(t + 0.5); } catch {}
      },
      gain: g
    };
  }

  private playBass(level: LevelMusic, start: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.7, start + 0.5);
    g.connect(this.musicGain!);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 500;
    filter.connect(g);

    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.connect(filter);
    osc.start(start);

    const beat = 60 / level.bpm;
    const bar = beat * 4;
    let step = 0;
    const interval = setInterval(() => {
      if (!this.ctx) return;
      const chord = level.chords[step % level.chords.length];
      const freq = level.root * Math.pow(2, chord[0] / 12) * 0.25;
      const now = this.ctx.currentTime;
      osc.frequency.setTargetAtTime(freq, now, 0.05);
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(0.7, now);
      g.gain.setTargetAtTime(0.25, now + 0.05, 0.1);
      step++;
    }, bar * 1000);

    return {
      stop() {
        clearInterval(interval);
        const t = ctx.currentTime;
        g.gain.cancelScheduledValues(t);
        g.gain.setTargetAtTime(0, t, 0.1);
        try { osc.stop(t + 0.4); } catch {}
      },
      gain: g
    };
  }

  private playArp(level: LevelMusic, _start: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.value = 0.35;
    g.connect(this.musicGain!);

    const beat = 60 / level.bpm;
    const eighth = beat / 2;
    let step = 0;
    const interval = setInterval(() => {
      if (!this.ctx) return;
      const chordIdx = Math.floor(step / (level.arpPattern.length)) % level.chords.length;
      const patIdx = step % level.arpPattern.length;
      const semitone = level.chords[chordIdx][level.arpPattern[patIdx] % level.chords[chordIdx].length];
      const freq = level.root * Math.pow(2, semitone / 12) * 2;
      const now = this.ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      const og = ctx.createGain();
      og.gain.setValueAtTime(0, now);
      og.gain.linearRampToValueAtTime(0.35, now + 0.01);
      og.gain.exponentialRampToValueAtTime(0.001, now + eighth * 0.9);
      osc.frequency.value = freq;
      osc.connect(og); og.connect(g);
      osc.start(now);
      osc.stop(now + eighth);
      step++;
    }, eighth * 1000);

    return {
      stop() {
        clearInterval(interval);
        const t = ctx.currentTime;
        g.gain.setTargetAtTime(0, t, 0.1);
      },
      gain: g
    };
  }

  private playDrums(level: LevelMusic, _start: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.value = level.drums ? 0.6 : 0;
    g.connect(this.musicGain!);

    const beat = 60 / level.bpm;
    const sixteenth = beat / 4;
    let step = 0;

    const kick = () => {
      const now = ctx.currentTime;
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.frequency.setValueAtTime(140, now);
      o.frequency.exponentialRampToValueAtTime(40, now + 0.15);
      og.gain.setValueAtTime(1, now);
      og.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      o.connect(og); og.connect(g);
      o.start(now); o.stop(now + 0.3);
    };
    const snare = () => {
      const now = ctx.currentTime;
      const bufSize = ctx.sampleRate * 0.2;
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = "highpass"; f.frequency.value = 1500;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.6, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      src.connect(f); f.connect(ng); ng.connect(g);
      src.start(now);
    };
    const hat = (open: boolean) => {
      const now = ctx.currentTime;
      const bufSize = ctx.sampleRate * (open ? 0.15 : 0.05);
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = "highpass"; f.frequency.value = 7000;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.18, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + (open ? 0.14 : 0.04));
      src.connect(f); f.connect(ng); ng.connect(g);
      src.start(now);
    };

    const interval = setInterval(() => {
      if (!level.drums) return;
      const s = step % 16;
      if (s === 0 || s === 8) kick();
      if (s === 4 || s === 12) snare();
      if (s % 2 === 0) hat(s === 14);
      step++;
    }, sixteenth * 1000);

    return {
      stop() { clearInterval(interval); g.gain.setTargetAtTime(0, ctx.currentTime, 0.05); },
      gain: g
    };
  }

  // ---- SFX ----
  sfx(type: "shoot" | "explode" | "hit" | "powerup" | "levelup" | "click" | "die") {
    if (!this.sfxOn) return;
    const ctx = this.ensure();
    if (ctx.state === "suspended") ctx.resume();
    const now = ctx.currentTime;
    const g = ctx.createGain();
    g.connect(this.sfxGain!);

    switch (type) {
      case "shoot": {
        const o = ctx.createOscillator();
        o.type = "square";
        o.frequency.setValueAtTime(880, now);
        o.frequency.exponentialRampToValueAtTime(220, now + 0.08);
        g.gain.setValueAtTime(0.35, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        o.connect(g); o.start(now); o.stop(now + 0.11);
        break;
      }
      case "hit": {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.setValueAtTime(180, now);
        o.frequency.exponentialRampToValueAtTime(50, now + 0.2);
        g.gain.setValueAtTime(0.5, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        o.connect(g); o.start(now); o.stop(now + 0.25);
        break;
      }
      case "explode": {
        const bufSize = ctx.sampleRate * 0.6;
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const f = ctx.createBiquadFilter();
        f.type = "lowpass"; f.frequency.setValueAtTime(1200, now);
        f.frequency.exponentialRampToValueAtTime(100, now + 0.5);
        g.gain.setValueAtTime(0.7, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        src.connect(f); f.connect(g);
        src.start(now);
        break;
      }
      case "powerup": {
        [440, 660, 880, 1320].forEach((f, i) => {
          const o = ctx.createOscillator();
          o.type = "sine";
          const og = ctx.createGain();
          og.gain.setValueAtTime(0, now + i * 0.07);
          og.gain.linearRampToValueAtTime(0.3, now + i * 0.07 + 0.01);
          og.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.18);
          o.frequency.value = f;
          o.connect(og); og.connect(g);
          o.start(now + i * 0.07); o.stop(now + i * 0.07 + 0.2);
        });
        break;
      }
      case "levelup": {
        [523, 659, 784, 1046, 1318].forEach((f, i) => {
          const o = ctx.createOscillator();
          o.type = "triangle";
          const og = ctx.createGain();
          og.gain.setValueAtTime(0, now + i * 0.1);
          og.gain.linearRampToValueAtTime(0.35, now + i * 0.1 + 0.02);
          og.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.35);
          o.frequency.value = f;
          o.connect(og); og.connect(g);
          o.start(now + i * 0.1); o.stop(now + i * 0.1 + 0.4);
        });
        break;
      }
      case "click": {
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = 660;
        g.gain.setValueAtTime(0.25, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        o.connect(g); o.start(now); o.stop(now + 0.06);
        break;
      }
      case "die": {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.setValueAtTime(440, now);
        o.frequency.exponentialRampToValueAtTime(55, now + 1.2);
        g.gain.setValueAtTime(0.55, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
        o.connect(g); o.start(now); o.stop(now + 1.25);
        break;
      }
    }
  }
}

type LevelMusic = {
  name: string;
  root: number; // Hz
  bpm: number;
  chords: number[][]; // semitones relative to root
  arpPattern: number[]; // indices into chord
  drums: boolean;
};

const A3 = 220; // A3
// Levels tuned musically
const LEVEL_MUSIC: LevelMusic[] = [
  { // 1: Nebula Drift, Am
    name: "Nebula Drift",
    root: A3 * Math.pow(2, -3/12), // F? use A minor feel
    bpm: 92,
    chords: [[0, 3, 7], [-3, 0, 4], [-5, -2, 2], [-7, -4, 0]], // Am, F, Dm, C (in semitones relative)
    arpPattern: [0, 1, 2, 1],
    drums: false
  },
  { // 2: Cyber Grid, Em
    name: "Cyber Grid",
    root: A3 * Math.pow(2, -5/12),
    bpm: 108,
    chords: [[0, 3, 7], [-2, 2, 5], [-4, 0, 3], [-5, -2, 2]],
    arpPattern: [0, 2, 1, 2, 0, 1, 2, 1],
    drums: true
  },
  { // 3: Solar Flare, Dm (driving)
    name: "Solar Flare",
    root: A3 * Math.pow(2, -7/12),
    bpm: 128,
    chords: [[0, 3, 7], [-2, 2, 5], [3, 7, 10], [-5, -2, 2]],
    arpPattern: [0, 1, 2, 1, 2, 0, 1, 0],
    drums: true
  },
  { // 4: Abyssal Void, Bm
    name: "Abyssal Void",
    root: A3 * Math.pow(2, -10/12),
    bpm: 100,
    chords: [[0, 3, 7], [-2, 2, 5], [-7, -4, 0], [5, 8, 12]],
    arpPattern: [0, 2, 1, 0, 2, 1, 2, 0],
    drums: true
  },
  { // 5: Hyper Core, Cmaj (epic)
    name: "Hyper Core",
    root: A3 * Math.pow(2, -12/12) * 2,
    bpm: 140,
    chords: [[0, 4, 7], [5, 9, 12], [-2, 2, 5], [-4, 0, 3]],
    arpPattern: [0, 1, 2, 1, 2, 0, 2, 1, 0, 2, 1, 0],
    drums: true
  }
];

export const audio = new AudioEngine();
export { LEVEL_MUSIC };
