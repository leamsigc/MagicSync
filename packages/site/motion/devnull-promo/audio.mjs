/**
 * Synthesise the promo soundtrack as a 48 kHz stereo WAV.
 *
 * No samples, no network: every sound is generated from the same timeline the
 * picture uses, so clicks land on the keystrokes and chimes land on the beats.
 *
 *   node motion/devnull-promo/audio.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(here, '../../../doc/public/video')
mkdirSync(outDir, { recursive: true })

const SR = 48000;
const DUR = 47;
const N = Math.round(SR * DUR);
const L = new Float32Array(N);
const R = new Float32Array(N);

/* ---------- helpers ---------- */
const idx = (t) => Math.round(t * SR);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** write a mono signal into the stereo bus with a constant-power pan */
function mix(startSample, samples, pan = 0) {
  const gl = Math.cos(((pan + 1) * Math.PI) / 4);
  const gr = Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = 0; i < samples.length; i++) {
    const j = startSample + i;
    if (j < 0 || j >= N) continue;
    L[j] += samples[i] * gl;
    R[j] += samples[i] * gr;
  }
}

const env = (i, len, attack, decay) => {
  const a = Math.min(1, i / (attack * SR));
  const d = Math.exp((-i / SR) / decay);
  return a * d;
};

/** decaying sine */
function tone({ t0, dur, freq, amp = 0.1, attack = 0.004, decay = 0.2, pan = 0, detune = 0 }) {
  const len = Math.round(dur * SR);
  const s = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const v = Math.sin(2 * Math.PI * freq * t) + 0.4 * Math.sin(2 * Math.PI * (freq * (1 + detune)) * t);
    s[i] = v * amp * env(i, len, attack, decay);
  }
  mix(idx(t0), s, pan);
}

/** short filtered noise click — keystrokes, ticks */
function click({ t0, amp = 0.06, freq = 2400, dur = 0.035, pan = 0, noise = 0.6 }) {
  const len = Math.round(dur * SR);
  const s = new Float32Array(len);
  let lp = 0;
  let seed = 12345;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed / 0x7fffffff) * 2 - 1;
  };
  const a = Math.exp(-2 * Math.PI * freq / SR);
  for (let i = 0; i < len; i++) {
    const n = rnd();
    lp = n * (1 - a) + lp * a;
    const ping = Math.sin(2 * Math.PI * freq * (i / SR)) * 0.5;
    s[i] = (lp * noise + ping * (1 - noise)) * amp * env(i, len, 0.001, 0.012);
  }
  mix(idx(t0), s, pan);
}

/** band-passed noise sweep — whooshes, risers */
function sweep({ t0, dur, amp = 0.12, f0 = 300, f1 = 4000, q = 2.2, pan = 0 }) {
  const len = Math.round(dur * SR);
  const s = new Float32Array(len);
  let low = 0, band = 0;
  let seed = 987654;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed / 0x7fffffff) * 2 - 1;
  };
  for (let i = 0; i < len; i++) {
    const k = i / len;
    const fc = f0 * Math.pow(f1 / f0, k);
    const f = 2 * Math.sin((Math.PI * fc) / SR);
    const damp = 1 / q;
    const high = rnd() - low - damp * band;
    band += f * high;
    low += f * band;
    const shape = Math.sin(Math.PI * Math.min(1, k * 1.15));
    s[i] = band * amp * shape;
  }
  mix(idx(t0), s, pan);
}

/** soft bell — partials with independent decays */
function chime({ t0, freq = 880, amp = 0.12, dur = 1.6, pan = 0 }) {
  const len = Math.round(dur * SR);
  const s = new Float32Array(len);
  const partials = [[1, 1, 0.5], [2.01, 0.45, 0.34], [2.99, 0.22, 0.2], [4.18, 0.12, 0.12]];
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    let v = 0;
    for (const [ratio, gain, dec] of partials) {
      v += gain * Math.sin(2 * Math.PI * freq * ratio * t) * Math.exp(-t / dec);
    }
    s[i] = v * amp * Math.min(1, i / (0.004 * SR));
  }
  mix(idx(t0), s, pan);
}

/** low thump */
function sub({ t0, freq = 62, amp = 0.3, dur = 0.9 }) {
  const len = Math.round(dur * SR);
  const s = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const f = freq * (1 + 2.2 * Math.exp(-t / 0.06));
    s[i] = Math.sin(2 * Math.PI * f * t) * amp * Math.exp(-t / 0.22) * Math.min(1, i / (0.003 * SR));
  }
  mix(idx(t0), s, 0);
}

/* ============================================================
   CUES
   ============================================================ */

/* --- bed: a slow detuned drone that breathes for the whole film --- */
{
  const s = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const swell = 0.55 + 0.45 * Math.sin(2 * Math.PI * 0.035 * t - 1.2);
    const fadeIn = Math.min(1, t / 2.2);
    const fadeOut = Math.min(1, (DUR - t) / 2.5);
    const v =
      0.50 * Math.sin(2 * Math.PI * 55.0 * t) +
      0.34 * Math.sin(2 * Math.PI * 82.5 * t + 0.4) +
      0.22 * Math.sin(2 * Math.PI * 110.0 * t + 1.1) +
      0.16 * Math.sin(2 * Math.PI * 164.8 * t + 2.2);
    s[i] = v * 0.055 * swell * fadeIn * Math.max(0, fadeOut);
  }
  mix(0, s, 0);
}

/* --- S0: typing the publish command (1.55s → 3.53s) --- */
for (let i = 0; i < 33; i++) {
  const t = 1.55 + i * 0.06;
  click({ t0: t, amp: 0.05 + (i % 3) * 0.006, freq: 1800 + (i % 4) * 260, pan: -0.25 + (i % 5) * 0.12 });
}
click({ t0: 4.02, amp: 0.075, freq: 3200, dur: 0.05 });          // signed
chime({ t0: 4.05, freq: 1318.5, amp: 0.07, dur: 0.9, pan: 0.2 });
click({ t0: 4.62, amp: 0.06, freq: 2600, dur: 0.05 });          // published
sweep({ t0: 5.15, dur: 1.0, amp: 0.11, f0: 260, f1: 5200, q: 1.6 });

/* --- S1: the connection --- */
sweep({ t0: 6.15, dur: 0.8, amp: 0.08, f0: 4200, f1: 380, q: 1.8 });
sweep({ t0: 7.45, dur: 1.3, amp: 0.1, f0: 340, f1: 2900, q: 3.0, pan: 0.15 }); // pulse flight
chime({ t0: 8.75, freq: 783.99, amp: 0.1, dur: 1.6 });                     // pulse lands
sub({ t0: 8.75, freq: 78, amp: 0.16 });
[8.90, 9.09, 9.28].forEach((t, i) => {                                    // chips
  click({ t0: t, amp: 0.07, freq: 1400 + i * 420, dur: 0.06, pan: -0.3 + i * 0.3 });
  tone({ t0: t, dur: 0.3, freq: 523.25 * Math.pow(2, i / 12), amp: 0.045, decay: 0.16, pan: -0.3 + i * 0.3 });
});

/* --- S2: three steps --- */
sweep({ t0: 12.75, dur: 0.7, amp: 0.07, f0: 3600, f1: 420, q: 1.8 });
[13.50, 14.40, 15.30].forEach((t, i) => {                                 // cards land
  sub({ t0: t, freq: 70 + i * 6, amp: 0.13 });
  tone({ t0: t, dur: 0.5, freq: 196 * Math.pow(2, i / 12), amp: 0.05, decay: 0.25 });
});
sweep({ t0: 17.2, dur: 1.3, amp: 0.055, f0: 1400, f1: 5200, q: 4.0, pan: 0.2 }); // signature
sweep({ t0: 18.9, dur: 1.8, amp: 0.1, f0: 420, f1: 3400, q: 2.4 });            // packet flight
chime({ t0: 20.75, freq: 1046.5, amp: 0.11, dur: 1.8 });                       // commit lands

/* --- S3: one post, everywhere --- */
sweep({ t0: 24.15, dur: 0.7, amp: 0.07, f0: 3400, f1: 400, q: 1.8 });
for (let i = 0; i < 60; i++) {                                                 // typing the post
  const t = 25.0 + i * 0.032;
  click({ t0: t, amp: 0.03 + (i % 4) * 0.004, freq: 2600 + (i % 3) * 300, dur: 0.025, pan: -0.2 + (i % 5) * 0.1 });
}
[27.30, 27.41, 27.52, 27.63, 27.74].forEach((t, i) => {                        // platform chips
  click({ t0: t, amp: 0.06, freq: 1600 + i * 300, dur: 0.05, pan: -0.35 + i * 0.17 });
});
sweep({ t0: 28.6, dur: 2.8, amp: 0.11, f0: 300, f1: 4200, q: 2.0 });            // the post flies
chime({ t0: 31.30, freq: 1174.66, amp: 0.13, dur: 2.4 });                      // it lands in the feed
sub({ t0: 31.30, freq: 88, amp: 0.15 });

/* --- S4: the call to action --- */
sweep({ t0: 33.4, dur: 1.1, amp: 0.1, f0: 300, f1: 6000, q: 1.5 });            // riser
sub({ t0: 34.55, freq: 58, amp: 0.3, dur: 1.2 });                              // mark lands
chime({ t0: 34.6, freq: 659.25, amp: 0.09, dur: 2.2 });
sweep({ t0: 37.4, dur: 0.9, amp: 0.05, f0: 900, f1: 4200, q: 3.2 });           // underline draws
chime({ t0: 37.5, freq: 987.77, amp: 0.1, dur: 2.6 });

/* ============================================================
   MASTER
   ============================================================ */
let peak = 0;
for (let i = 0; i < N; i++) {
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = peak > 0 ? 0.89 / peak : 1;
const pcm = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) {
  const l = Math.max(-1, Math.min(1, L[i] * norm));
  const r = Math.max(-1, Math.min(1, R[i] * norm));
  pcm.writeInt16LE(Math.round(l * 32767), i * 4);
  pcm.writeInt16LE(Math.round(r * 32767), i * 4 + 2);
}

const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + pcm.length, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(2, 22);
header.writeUInt32LE(SR, 24);
header.writeUInt32LE(SR * 4, 28);
header.writeUInt16LE(4, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(pcm.length, 40);

const out = join(outDir, 'magicsync-dev-null-sh.audio.wav');
writeFileSync(out, Buffer.concat([header, pcm]))
console.log(`audio → ${out} (${DUR}s, ${SR} Hz stereo, peak normalised to 0.89)`)
