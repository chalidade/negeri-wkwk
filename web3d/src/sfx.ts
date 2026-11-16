// Efek suara disintesis langsung (tanpa file audio).
let ctx: AudioContext | null = null;
let muted = localStorage.getItem("wkwk.mute") === "1";

function ac(): AudioContext | null {
  if (muted) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.14, to = freq, delay = 0): void {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(30, to), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol = 0.12, delay = 0): void {
  const a = ac();
  if (!a) return;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = a.createBufferSource();
  const g = a.createGain();
  g.gain.value = vol;
  src.buffer = buf;
  src.connect(g).connect(a.destination);
  src.start(a.currentTime + delay);
}

export const sfx = {
  click: () => tone(520, 0.06, "triangle", 0.1),
  dice: () => [0, 0.09, 0.2, 0.33, 0.5].forEach((d) => noise(0.05, 0.14, d)),
  step: () => tone(440 + Math.random() * 180, 0.07, "triangle", 0.09),
  coin: () => (tone(988, 0.09, "square", 0.07), tone(1319, 0.22, "square", 0.07, 1319, 0.08)),
  pay: () => tone(330, 0.2, "sawtooth", 0.08, 160),
  card: () => noise(0.16, 0.08),
  build: () => (tone(300, 0.1, "square", 0.07, 600), tone(600, 0.14, "square", 0.07, 900, 0.09)),
  hit: () => (noise(0.25, 0.22), tone(140, 0.3, "sawtooth", 0.16, 50)),
  bad: () => (tone(220, 0.18, "sawtooth", 0.1, 180), tone(160, 0.3, "sawtooth", 0.1, 110, 0.16)),
  siren: () => [0, 0.22, 0.44].forEach((d) => tone(700, 0.2, "square", 0.05, 950, d)),
  good: () => [523, 659, 784].forEach((f, i) => tone(f, 0.14, "triangle", 0.11, f, i * 0.08)),
  fanfare: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.22, "square", 0.08, f, i * 0.13)),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, "triangle", 0.12, f * 0.94, i * 0.22)),
};

export const isMuted = (): boolean => muted;
export function toggleMute(): boolean {
  muted = !muted;
  localStorage.setItem("wkwk.mute", muted ? "1" : "0");
  return muted;
}
