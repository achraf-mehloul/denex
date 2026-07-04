import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Play, Pause, Rewind, FastForward, ZoomIn, ZoomOut, ArrowLeft, FileSpreadsheet, FileJson, Database, Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { getSession, type Session } from "@/lib/db";
import { EcgPlayback } from "@/components/EcgPlayback";
import { EmptyState } from "@/components/EmptyState";
import { exportCsv, exportJson, fromSession } from "@/lib/export";
import { addAnnotation, listAnnotations, removeAnnotation, type Annotation } from "@/lib/annotations";

const search = z.object({ id: z.string().optional() });
export const Route = createFileRoute("/_app/replay")({ validateSearch: search, component: ReplayPage });

function ReplayPage() {
  const { id } = Route.useSearch();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    getSession(id).then((s) => { setSession(s); setLoading(false); });
    setAnnotations(id ? listAnnotations(id) : []);
  }, [id]);

  const total = session?.original.length ?? 0;
  const fs = session?.sampleRate ?? 250;

  const [playhead, setPlayhead] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const rafRef = useRef<number>(0);
  const lastRef = useRef<number>(0);

  const span = useMemo(() => {
    const max = Math.max(fs, total);
    return Math.min(max, Math.max(fs, Math.floor(total / Math.max(1, zoom))));
  }, [zoom, total, fs]);
  const start = Math.max(0, Math.min(total - span, playhead - Math.floor(span / 2)));

  useEffect(() => { setPlayhead(0); }, [id]);

  useEffect(() => {
    if (!playing || !session) return;
    lastRef.current = performance.now();
    const tick = (t: number) => {
      const dt = (t - lastRef.current) / 1000; lastRef.current = t;
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

  // Keyboard shortcuts
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (!session) return;
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.code === "Space") { e.preventDefault(); setPlaying((p) => !p); }
    else if (e.code === "ArrowLeft") setPlayhead((p) => Math.max(0, p - fs * (e.shiftKey ? 5 : 1)));
    else if (e.code === "ArrowRight") setPlayhead((p) => Math.min(total - 1, p + fs * (e.shiftKey ? 5 : 1)));
    else if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(64, z * 1.5));
    else if (e.key === "-" || e.key === "_") setZoom((z) => Math.max(1, z / 1.5));
  }, [session, fs, total]);
  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  const addNote = () => {
    if (!id) return;
    const text = window.prompt("Note pour cet instant :");
    if (!text) return;
    const a = addAnnotation(id, Math.floor(playhead), text);
    setAnnotations((prev) => [...prev, a].sort((x, y) => x.sampleIndex - y.sampleIndex));
  };
  const rmNote = (aid: string) => {
    if (!id) return;
    removeAnnotation(id, aid);
    setAnnotations((prev) => prev.filter((a) => a.id !== aid));
  };

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Chargement…</div>;
  if (!id || !session) {
    return (
      <div className="p-4 md:p-8 max-w-[1400px] mx-auto space-y-6">
        <Header />
        <EmptyState icon={Database} title="Choisir une session à relire" description="Ouvrez l'archive et sélectionnez un enregistrement. Le lecteur synchronise les trois pistes." ctaLabel="Aller aux sessions" ctaTo="/sessions" />
      </div>
    );
  }

  const tSec = (playhead / fs).toFixed(2);
  const totalSec = (total / fs).toFixed(2);

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto space-y-4">
      <Header />

      <motion.div layoutId={`session-${id}`} className="rounded-2xl glass p-4 flex flex-wrap items-center gap-2">
        <button onClick={() => setPlaying((p) => !p)} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium glow-primary">
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />} {playing ? "Pause" : "Lire"}
        </button>
        <button onClick={() => setPlayhead((p) => Math.max(0, p - fs))} className="p-2 rounded-full border border-border hover:bg-secondary/40" title="-1s"><Rewind className="h-4 w-4" /></button>
        <button onClick={() => setPlayhead((p) => Math.min(total - 1, p + fs))} className="p-2 rounded-full border border-border hover:bg-secondary/40" title="+1s"><FastForward className="h-4 w-4" /></button>
        <div className="flex items-center gap-1">
          {[0.5, 1, 2, 4].map((r) => (
            <button key={r} onClick={() => setRate(r)} className={`px-2 py-1 text-xs rounded-full text-mono ${rate === r ? "bg-primary text-primary-foreground" : "border border-border hover:bg-secondary/40"}`}>{r}×</button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setZoom((z) => Math.max(1, z / 1.5))} className="p-2 rounded-full border border-border hover:bg-secondary/40"><ZoomOut className="h-4 w-4" /></button>
          <span className="text-xs text-mono text-muted-foreground w-12 text-center">{zoom.toFixed(1)}×</span>
          <button onClick={() => setZoom((z) => Math.min(64, z * 1.5))} className="p-2 rounded-full border border-border hover:bg-secondary/40"><ZoomIn className="h-4 w-4" /></button>
        </div>
        <button onClick={addNote} className="p-2 rounded-full border border-border hover:bg-secondary/40" title="Ajouter une note"><Plus className="h-4 w-4" /></button>
        <div className="ml-auto text-xs text-mono text-muted-foreground">{tSec}s / {totalSec}s</div>
        <button onClick={() => exportCsv(fromSession(session))} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs hover:bg-secondary/40"><FileSpreadsheet className="h-3.5 w-3.5" /> CSV</button>
        <button onClick={() => exportJson(fromSession(session))} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs hover:bg-secondary/40"><FileJson className="h-3.5 w-3.5" /> JSON</button>
      </motion.div>

      <div className="text-[10px] text-muted-foreground text-mono">
        Raccourcis : Espace = lecture · ← → = ±1s (Shift ±5s) · + / − = zoom
      </div>

      <input
        type="range" min={0} max={Math.max(0, total - 1)} value={Math.floor(playhead)}
        onChange={(e) => setPlayhead(+e.target.value)}
        className="w-full accent-[oklch(0.78_0.15_190)]"
      />

      <div className="grid gap-3">
        <EcgPlayback label="Original" color="oklch(0.78 0.15 215)" buffer={session.original} start={start} span={span} marker={Math.floor(playhead)} height={170} />
        <EcgPlayback label="Bruité" color="oklch(0.70 0.20 35)" buffer={session.noisy} start={start} span={span} marker={Math.floor(playhead)} height={140} />
        <EcgPlayback label="Filtré" color="oklch(0.78 0.18 155)" buffer={session.filtered} start={start} span={span} marker={Math.floor(playhead)} height={140} />
      </div>

      {annotations.length > 0 && (
        <div className="rounded-2xl glass p-4">
          <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground mb-2">Annotations · {annotations.length}</div>
          <div className="space-y-1.5">
            {annotations.map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-sm">
                <button onClick={() => setPlayhead(a.sampleIndex)} className="text-mono text-xs px-2 py-1 rounded bg-secondary/40 hover:bg-secondary/60">{(a.sampleIndex / fs).toFixed(2)}s</button>
                <span className="flex-1 truncate">{a.text}</span>
                <button onClick={() => rmNote(a.id)} className="p-1 rounded hover:bg-secondary/60 text-[oklch(0.70_0.20_25)]"><Trash2 className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Relecture</div>
        <h1 className="font-display text-2xl md:text-3xl mt-1">Lecture de session</h1>
      </div>
      <Link to="/sessions" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border text-xs hover:bg-secondary/40">
        <ArrowLeft className="h-3.5 w-3.5" /> Sessions
      </Link>
    </div>
  );
}
