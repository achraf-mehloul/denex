export type EcgPoint = { t: number; v: number };

export function generateBeat(phase: number): number {
  const p = phase % 1;
  let v = 0;
  if (p < 0.08) v = Math.sin(p * Math.PI / 0.08) * 0.08;
  else if (p < 0.18) v = -Math.sin((p - 0.08) * Math.PI / 0.10) * 0.12;
  else if (p < 0.22) v = (p - 0.18) / 0.04 * -0.25;
  else if (p < 0.26) v = -0.25 + ((p - 0.22) / 0.04) * 1.6;
  else if (p < 0.30) v = 1.35 - ((p - 0.26) / 0.04) * 1.85;
  else if (p < 0.34) v = -0.5 + ((p - 0.30) / 0.04) * 0.5;
  else if (p < 0.55) v = 0;
  else if (p < 0.75) v = Math.sin((p - 0.55) * Math.PI / 0.20) * 0.25;
  else v = 0;
  return v;
}

export class EcgEngine {
  private phase = 0;
  bpm = 72;
  noise = 0.12;
  drift = 0;
  constructor(bpm = 72) { this.bpm = bpm; }
  step(dtSec: number): { original: number; noisy: number; filtered: number } {
    const beatsPerSec = this.bpm / 60;
    this.phase += dtSec * beatsPerSec;
    const original = generateBeat(this.phase);
    this.drift += (Math.random() - 0.5) * 0.005;
    this.drift *= 0.98;
    const hf = (Math.random() - 0.5) * this.noise;
    const mains = Math.sin(performance.now() * 2 * Math.PI * 0.05) * 0.04;
    const noisy = original + hf + mains + this.drift;
    const filtered = original + (Math.random() - 0.5) * 0.01;
    return { original, noisy, filtered };
  }
}
