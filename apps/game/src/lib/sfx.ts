// Efek suara kecil yang disintesis (tanpa file audio) + getar ringan di HP.
let ctx: AudioContext | null = null;
const prefs = { sound: true, haptics: true };
try {
  const s = JSON.parse(localStorage.getItem('kb-prefs') ?? '{}');
  Object.assign(prefs, s);
} catch { /* abaikan */ }

export function getPrefs() { return { ...prefs }; }
export function setPref(k: 'sound' | 'haptics', v: boolean) {
  prefs[k] = v;
  try { localStorage.setItem('kb-prefs', JSON.stringify(prefs)); } catch { /* abaikan */ }
}

function tone(freq: number, dur = 0.12, type: OscillatorType = 'sine', vol = 0.08, slide = 0, delay = 0) {
  if (!prefs.sound) return;
  try {
    ctx ??= new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch { /* abaikan */ }
}

export const buzz = (ms: number | number[] = 12) => { if (prefs.haptics && 'vibrate' in navigator) try { navigator.vibrate(ms); } catch { /* abaikan */ } };

export const sfx = {
  tap: () => { tone(520, 0.06, 'triangle', 0.05); buzz(8); },
  pop: () => { tone(380, 0.12, 'sine', 0.08, 380); buzz(10); },
  coin: () => { tone(988, 0.08, 'square', 0.04); tone(1318, 0.14, 'square', 0.04, 0, 0.07); buzz(14); },
  eat: () => { tone(300, 0.08, 'triangle', 0.07); tone(260, 0.08, 'triangle', 0.07, 0, 0.1); },
  splash: () => { tone(200, 0.25, 'sawtooth', 0.03, -120); buzz([20, 30, 20]); },
  error: () => { tone(200, 0.16, 'square', 0.04, -60); buzz([30, 40, 30]); },
  level: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.14, 'triangle', 0.06, 0, i * 0.09)); buzz([20, 40, 60]); },
  hop: () => tone(440, 0.07, 'triangle', 0.05, 200),
  tuk: () => { tone(620, 0.05, 'sine', 0.06, -80); buzz(10); },
  snap: () => { tone(900, 0.06, 'square', 0.04, -600); tone(160, 0.2, 'sawtooth', 0.03, -60, 0.05); buzz([40, 30, 80]); },
  bite: () => { tone(880, 0.1, 'square', 0.05); tone(880, 0.1, 'square', 0.05, 0, 0.14); buzz([60, 40, 60]); },
};
