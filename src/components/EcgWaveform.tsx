import { useEffect, useRef } from "react";

type Props = {
  color: string;
  label: string;
  unit?: string;
  height?: number;
  getSample: () => number;
  speed?: number;
  amplitude?: number;
};

export function EcgWaveform({ color, label, unit = "mV", height = 180, getSample, speed = 2.2, amplitude = 1 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bufferRef = useRef<number[]>([]);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const container = containerRef.current!;
    const ctx = canvas.getContext("2d")!;
    let dpr = window.devicePixelRatio || 1;
    let width = 0;
    let h = height;

    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      width = container.clientWidth;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bufferRef.current = new Array(Math.floor(width)).fill(0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const draw = (now: number) => {
      const dt = lastTimeRef.current ? (now - lastTimeRef.current) / 1000 : 0.016;
      lastTimeRef.current = now;
      const stepsPerFrame = Math.max(1, Math.round(speed * 60 * dt));
      const buf = bufferRef.current;
      for (let i = 0; i < stepsPerFrame; i++) {
        buf.shift();
        buf.push(getSample());
      }
      ctx.clearRect(0, 0, width, h);
      ctx.strokeStyle = "rgba(120,160,180,0.08)";
      ctx.lineWidth = 1;
      const grid = 24;
      for (let x = 0; x < width; x += grid) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y < h; y += grid) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }

      ctx.beginPath();
      const mid = h / 2;
      const amp = (h / 2 - 8) * amplitude;
      for (let x = 0; x < buf.length; x++) {
        const y = mid - buf[x] * amp;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      ctx.lineJoin = "round";
      ctx.stroke();
      ctx.shadowBlur = 0;

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [color, height, getSample, speed, amplitude]);

  return (
    <div className="rounded-xl glass p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full pulse-dot" style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
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
