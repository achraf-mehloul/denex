import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, Rewind, FastForward, ZoomIn, ZoomOut, ArrowLeft, FileSpreadsheet, FileJson, Database } from "lucide-react";
import { z } from "zod";
import { getSession, type Session } from "@/lib/db";
import { EcgPlayback } from "@/components/EcgPlayback";
import { EmptyState } from "@/components/EmptyState";
import { exportCsv, exportJson, fromSession } from "@/lib/export";

const search = z.object({ id: z.string().optional() });

export const Route = createFileRoute("/_app/replay")({
  validateSearch: search,
  component: ReplayPage,
});

function ReplayPage() {
  const { id } = Route.useSearch();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    getSession(id).then((s) => { setSession(s); setLoading(false); });
  }, [id]);

  const total = session?.original.length ?? 0;
  const fs = session?.sampleRate ?? 250;

  const [playhead, setPlayhead] = useState(0);
  const [zoom, setZoom] = useState(1); // 1 = full window
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const rafRef = useRef<number>(0);
  const lastRef = useRef<number>(0);

  // Window span in samples — clamped 1s … full duration.
  const span = useMemo(() => {
    const max = Math.max(fs, total);
    const base = Math.max(fs, Math.floor(total / Math.max(1, zoom)));
    return Math.min(max, base);
  }, [zoom, total, fs]);

  const start = Math.max(0, Math.min(total - span, playhead - Math.floor(span / 2)));

  useEffect(() => { setPlayhead(0); }, [id]);

  useEffect(() => {
    if (!playing || !session) return;
    lastRef.current = performance.now();
    const tick = (t: number) => {
      const dt = (t - lastRef.current) / 1000;
      lastRef.current = t;
      setPlayhead((p) => {
        const next = p + dt * fs * rate;
        if (next >= total) { setPlaying(false); return total - 1; }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, rate, fs, total, session]);

  if (loading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading session…</div>;
  }
  if (!id || !session) {
    return (
      <div className="p-4 md:p-8 max-w-[1400px] mx-auto space-y-6">
        <Header />
        <EmptyState
          icon={Database}
          title="Pick a session to replay"
          description="Open the Sessions archive and choose a recording. The replay viewer scrubs Original, Noisy and Filtered streams in lockstep."
          ctaLabel="Go to sessions"
          ctaTo="/sessions"
        />
      </div>
    );
  }

  const tSec = (playhead / fs).toFixed(2);
  const totalSec = (total / fs).toFixed(2);

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto space-y-5">
      <Header />

      <div className="rounded-xl glass p-4 flex flex-wrap items-center gap-3">
        <button onClick={() => setPlaying((p) => !p)} className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium">
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />} {playing ? "Pause" : "Play"}
        </button>
        <button onClick={() => setPlayhead((p) => Math.max(0, p - fs))} className="p-2 rounded border border-border hover:bg-secondary/40" title="-1s"><Rewind className="h-4 w-4" /></button>
        <button onClick={() => setPlayhead((p) => Math.min(total - 1, p + fs))} className="p-2 rounded border border-border hover:bg-secondary/40" title="+1s"><FastForward className="h-4 w-4" /></button>
        <div className="flex items-center gap-1">
          {[0.5, 1, 2, 4].map((r) => (
            <button key={r} onClick={() => setRate(r)} className={`px-2 py-1 text-xs rounded text-mono ${rate === r ? "bg-primary text-primary-foreground" : "border border-border hover:bg-secondary/40"}`}>{r}×</button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setZoom((z) => Math.max(1, z / 1.5))} className="p-2 rounded border border-border hover:bg-secondary/40" title="Zoom out"><ZoomOut className="h-4 w-4" /></button>
          <span className="text-xs text-mono text-muted-foreground w-14 text-center">{(zoom).toFixed(1)}×</span>
          <button onClick={() => setZoom((z) => Math.min(64, z * 1.5))} className="p-2 rounded border border-border hover:bg-secondary/40" title="Zoom in"><ZoomIn className="h-4 w-4" /></button>
        </div>
        <div className="ml-auto text-xs text-mono text-muted-foreground">{tSec}s / {totalSec}s</div>
        <button onClick={() => exportCsv(fromSession(session))} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-border text-xs hover:bg-secondary/40"><FileSpreadsheet className="h-3.5 w-3.5" /> CSV</button>
        <button onClick={() => exportJson(fromSession(session))} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-border text-xs hover:bg-secondary/40"><FileJson className="h-3.5 w-3.5" /> JSON</button>
      </div>

      <input
        type="range"
        min={0}
        max={Math.max(0, total - 1)}
        value={Math.floor(playhead)}
        onChange={(e) => setPlayhead(+e.target.value)}
        className="w-full accent-[oklch(0.78_0.15_190)]"
      />

      <div className="grid gap-4">
        <EcgPlayback label="Original ECG" color="oklch(0.78 0.15 215)" buffer={session.original} start={start} span={span} marker={Math.floor(playhead)} height={180} />
        <EcgPlayback label="Noisy capture" color="oklch(0.70 0.20 35)" buffer={session.noisy} start={start} span={span} marker={Math.floor(playhead)} height={150} />
        <EcgPlayback label="Filtered output" color="oklch(0.78 0.18 155)" buffer={session.filtered} start={start} span={span} marker={Math.floor(playhead)} height={150} />
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Replay</div>
        <h1 className="text-2xl md:text-3xl font-semibold mt-1">Session Playback</h1>
      </div>
      <Link to="/sessions" className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-border text-xs hover:bg-secondary/40">
        <ArrowLeft className="h-3.5 w-3.5" /> Sessions
      </Link>
    </div>
  );
}
