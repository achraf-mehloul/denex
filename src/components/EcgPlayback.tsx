// Renders a static (recorded) sample buffer with a viewport (offset+span)
// driven by the parent. Used by the replay scrubber and the correction
// before/after preview.

import { useEffect, useRef } from "react";

type Props = {
  color: string;
  label: string;
  buffer: Float32Array;
  start: number; // sample index of left edge
  span: number;  // number of samples shown
  height?: number;
  amplitude?: number;
  unit?: string;
  marker?: number; // sample index of playhead
};

export function EcgPlayback({ color, label, buffer, start, span, height = 160, amplitude = 1, unit = "mV", marker }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const container = containerRef.current!;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const h = height;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, width, h);
    // Grid.
    ctx.strokeStyle = "rgba(120,160,180,0.08)";
    ctx.lineWidth = 1;
    const grid = 24;
    for (let x = 0; x < width; x += grid) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += grid) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }

    if (buffer.length === 0 || span <= 0) return;

    const mid = h / 2;
    const amp = (h / 2 - 8) * amplitude;
    ctx.beginPath();
    for (let x = 0; x < width; x++) {
      const idx = Math.floor(start + (x / width) * span);
      if (idx < 0 || idx >= buffer.length) continue;
      const y = mid - buffer[idx] * amp;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (marker !== undefined && marker >= start && marker <= start + span) {
      const mx = ((marker - start) / span) * width;
      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(mx, 0); ctx.lineTo(mx, h); ctx.stroke();
    }
  }, [color, height, buffer, start, span, amplitude, marker]);

  return (
    <div className="rounded-xl glass p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
          <h3 className="text-sm font-medium tracking-wide">{label}</h3>
        </div>
        <span className="text-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{unit} · 250Hz</span>
      </div>
      <div ref={containerRef} style={{ height }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
