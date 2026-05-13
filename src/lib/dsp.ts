// Lightweight DSP primitives used across the platform.
// All filters are designed for a 250 Hz sampling rate by default.

export type FilterParams = {
  notch: { enabled: boolean; freq: number; q: number };
  highpass: { enabled: boolean; freq: number };
  smooth: { enabled: boolean; window: number };
};

export const defaultFilterParams = (): FilterParams => ({
  notch: { enabled: true, freq: 50, q: 30 },
  highpass: { enabled: true, freq: 0.5 },
  smooth: { enabled: true, window: 5 },
});

// Biquad notch filter (RBJ cookbook).
export class NotchFilter {
  private b0 = 1; private b1 = 0; private b2 = 0;
  private a1 = 0; private a2 = 0;
  private x1 = 0; private x2 = 0; private y1 = 0; private y2 = 0;
  constructor(freq: number, q: number, fs: number) { this.design(freq, q, fs); }
  design(freq: number, q: number, fs: number) {
    const w0 = (2 * Math.PI * freq) / fs;
    const alpha = Math.sin(w0) / (2 * q);
    const cos = Math.cos(w0);
    const a0 = 1 + alpha;
    this.b0 = 1 / a0;
    this.b1 = (-2 * cos) / a0;
    this.b2 = 1 / a0;
    this.a1 = (-2 * cos) / a0;
    this.a2 = (1 - alpha) / a0;
  }
  process(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x;
    this.y2 = this.y1; this.y1 = y;
    return y;
  }
  reset() { this.x1 = this.x2 = this.y1 = this.y2 = 0; }
}

// First-order high-pass to remove baseline drift.
export class HighPassFilter {
  private alpha: number;
  private prevX = 0; private prevY = 0;
  constructor(freq: number, fs: number) {
    const rc = 1 / (2 * Math.PI * freq);
    const dt = 1 / fs;
    this.alpha = rc / (rc + dt);
  }
  redesign(freq: number, fs: number) {
    const rc = 1 / (2 * Math.PI * freq);
    const dt = 1 / fs;
    this.alpha = rc / (rc + dt);
  }
  process(x: number): number {
    const y = this.alpha * (this.prevY + x - this.prevX);
    this.prevX = x; this.prevY = y;
    return y;
  }
  reset() { this.prevX = this.prevY = 0; }
}

// Centered moving average smoother (causal version).
export class MovingAverage {
  private buf: number[] = [];
  constructor(private window: number) {}
  resize(n: number) { this.window = Math.max(1, n); this.buf = []; }
  process(x: number): number {
    this.buf.push(x);
    if (this.buf.length > this.window) this.buf.shift();
    let sum = 0;
    for (const v of this.buf) sum += v;
    return sum / this.buf.length;
  }
  reset() { this.buf = []; }
}

// Convenience pipeline that applies notch → highpass → smooth.
export class SignalPipeline {
  notch: NotchFilter;
  hp: HighPassFilter;
  smooth: MovingAverage;
  constructor(public params: FilterParams, public fs = 250) {
    this.notch = new NotchFilter(params.notch.freq, params.notch.q, fs);
    this.hp = new HighPassFilter(params.highpass.freq, fs);
    this.smooth = new MovingAverage(params.smooth.window);
  }
  update(params: FilterParams) {
    this.params = params;
    this.notch.design(params.notch.freq, params.notch.q, this.fs);
    this.hp.redesign(params.highpass.freq, this.fs);
    this.smooth.resize(params.smooth.window);
  }
  process(x: number): number {
    let y = x;
    if (this.params.notch.enabled) y = this.notch.process(y);
    if (this.params.highpass.enabled) y = this.hp.process(y);
    if (this.params.smooth.enabled) y = this.smooth.process(y);
    return y;
  }
  reset() { this.notch.reset(); this.hp.reset(); this.smooth.reset(); }
}

// Apply a pipeline to a buffer (offline).
export function applyPipeline(buffer: Float32Array, params: FilterParams, fs = 250): Float32Array {
  const pipe = new SignalPipeline(params, fs);
  const out = new Float32Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) out[i] = pipe.process(buffer[i]);
  return out;
}
