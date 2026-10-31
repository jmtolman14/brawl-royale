// All sound is synthesized with WebAudio at runtime: no audio files, no licensing.
import { useSettings } from '../store/settings';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let crowdGain: GainNode | null = null;
let crowdFilter: BiquadFilterNode | null = null;

export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume();
    return;
  }
  try {
    ctx = new AudioContext();
  } catch {
    return;
  }
  master = ctx.createGain();
  master.gain.value = useSettings.getState().volume;
  master.connect(ctx.destination);
  useSettings.subscribe((s) => {
    if (master && ctx) master.gain.setTargetAtTime(s.volume, ctx.currentTime, 0.05);
  });
  // 2 seconds of white noise, reused by every noisy sound
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

const now = () => ctx!.currentTime;

function out(pan: number, vol: number) {
  const g = ctx!.createGain();
  g.gain.value = vol;
  if (pan !== 0 && 'createStereoPanner' in ctx!) {
    const p = ctx!.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    g.connect(p).connect(master!);
  } else g.connect(master!);
  return g;
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, pan = 0, endFreq?: number, delay = 0) {
  if (!ctx || !master) return;
  const t = now() + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(1, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out(pan, vol));
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, filter: BiquadFilterType, freq: number, vol: number, pan = 0, endFreq?: number, q = 1, delay = 0) {
  if (!ctx || !master || !noiseBuf) return;
  const t = now() + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = ctx.createBiquadFilter();
  f.type = filter;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (endFreq) f.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(1, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(out(pan, vol));
  src.start(t, Math.random());
  src.stop(t + dur + 0.02);
}

export const sfx = {
  punch(heavy: boolean, pan: number, vol: number) {
    tone(heavy ? 85 : 140, heavy ? 0.18 : 0.09, 'sine', vol * (heavy ? 0.9 : 0.6), pan, heavy ? 40 : 70);
    noise(heavy ? 0.14 : 0.07, 'bandpass', heavy ? 900 : 1600, vol * (heavy ? 0.8 : 0.55), pan, 400, 0.8);
  },
  block(pan: number, vol: number) {
    tone(700, 0.06, 'square', vol * 0.15, pan, 450);
    noise(0.06, 'highpass', 2500, vol * 0.35, pan);
  },
  whoosh(heavy: boolean, pan: number, vol: number) {
    noise(heavy ? 0.22 : 0.13, 'bandpass', heavy ? 350 : 600, vol * 0.25, pan, heavy ? 1400 : 2200, 2);
  },
  parry(pan: number, vol: number) {
    tone(1250, 0.45, 'sine', vol * 0.35, pan);
    tone(1880, 0.35, 'sine', vol * 0.2, pan);
    noise(0.05, 'highpass', 4000, vol * 0.4, pan);
  },
  slam(pan: number, vol: number) {
    tone(70, 0.45, 'sine', vol, pan, 32);
    noise(0.3, 'lowpass', 900, vol * 0.8, pan, 120);
  },
  bell(times = 1) {
    for (let i = 0; i < times; i++) {
      const d = i * 0.32;
      tone(830, 1.4, 'sine', 0.35, 0, undefined, d);
      tone(2140, 0.9, 'sine', 0.14, 0, undefined, d);
      tone(3310, 0.5, 'sine', 0.08, 0, undefined, d);
    }
  },
  cheer(strength = 1) {
    noise(1.6 * strength, 'bandpass', 700, 0.35 * strength, 0, 1300, 0.6);
    noise(1.2 * strength, 'bandpass', 1800, 0.18 * strength, 0, 2600, 0.8, 0.1);
  },
  pickup() {
    tone(660, 0.08, 'triangle', 0.25);
    tone(990, 0.12, 'triangle', 0.22, 0, undefined, 0.06);
  },
  crate(pan: number, vol: number) {
    noise(0.18, 'bandpass', 500, vol * 0.7, pan, 200, 1.5);
    tone(180, 0.12, 'triangle', vol * 0.4, pan, 90);
  },
  use() {
    tone(520, 0.1, 'sine', 0.2);
    tone(780, 0.14, 'sine', 0.2, 0, undefined, 0.08);
    tone(1040, 0.2, 'sine', 0.18, 0, undefined, 0.16);
  },
  storm() {
    tone(55, 2.2, 'sawtooth', 0.12, 0, 48);
    noise(2, 'lowpass', 300, 0.3, 0, 120);
  },
  jump() {
    noise(0.8, 'bandpass', 300, 0.4, 0, 1200, 1);
  },
  land(vol: number) {
    tone(90, 0.2, 'sine', vol * 0.7, 0, 45);
    noise(0.15, 'lowpass', 600, vol * 0.5);
  },
  finisher() {
    tone(45, 1.2, 'sine', 0.9, 0, 30);
    noise(1.2, 'lowpass', 1200, 0.6, 0, 100);
  },
  ui() {
    tone(880, 0.05, 'square', 0.08);
  },
};

/** Ambient crowd that swells with the player's hype. */
export function startCrowd() {
  if (!ctx || !master || !noiseBuf || crowdGain) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  crowdFilter = ctx.createBiquadFilter();
  crowdFilter.type = 'bandpass';
  crowdFilter.frequency.value = 600;
  crowdFilter.Q.value = 0.5;
  crowdGain = ctx.createGain();
  crowdGain.gain.value = 0;
  src.connect(crowdFilter).connect(crowdGain).connect(master);
  src.start();
}

export function setCrowd(level: number) {
  if (!ctx || !crowdGain || !crowdFilter) return;
  crowdGain.gain.setTargetAtTime(0.02 + level * 0.12, ctx.currentTime, 0.4);
  crowdFilter.frequency.setTargetAtTime(500 + level * 600, ctx.currentTime, 0.4);
}

export function stopCrowd() {
  if (crowdGain && ctx) crowdGain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
}
