import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronRight, Sparkles, RotateCcw } from "lucide-react";
import { signal } from "@/lib/signal";
import { defaultFilterParams, applyPipeline, type FilterParams } from "@/lib/dsp";
import { EcgPlayback } from "@/components/EcgPlayback";

export const Route = createFileRoute("/_app/correction")({
  component: CorrectionPage,
});

type Step = {
  id: keyof FilterParams;
  title: string;
  description: string;
};

const STEPS: Step[] = [
  { id: "highpass", title: "Baseline drift removal", description: "A first-order high-pass filter at 0.5 Hz removes slow wander caused by respiration and electrode movement." },
  { id: "notch", title: "Mains notch filter", description: "An IIR biquad notch suppresses 50/60 Hz interference from power lines and nearby electronics." },
  { id: "smooth", title: "Smoothing", description: "A short moving-average window cleans residual high-frequency noise without erasing the QRS complex." },
];

function snapshotFromLive(): Float32Array {
  const len = 250 * 6; // last 6 seconds
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) out[i] = signal.getSampleAt("noisy", -(len - i));
  return out;
}

function CorrectionPage() {
  const [stepIdx, setStepIdx] = useState(0);
  const [params, setParams] = useState<FilterParams>(() => {
    const p = defaultFilterParams();
    // Workflow starts with everything off so each step demonstrates impact.
    p.highpass.enabled = false; p.notch.enabled = false; p.smooth.enabled = false;
    return p;
  });
  const [snapshot, setSnapshot] = useState<Float32Array>(() => snapshotFromLive());
  const [confirmed, setConfirmed] = useState(false);

  // Keep snapshot fresh while the user is on the page and not yet confirming.
  useEffect(() => {
    if (confirmed) return;
    const id = setInterval(() => setSnapshot(snapshotFromLive()), 1500);
    return () => clearInterval(id);
  }, [confirmed]);

  const after = useMemo(() => applyPipeline(snapshot, params), [snapshot, params]);
  const currentStep = STEPS[stepIdx];

  const update = (mut: (p: FilterParams) => void) => {
    setParams((prev) => {
      const next: FilterParams = JSON.parse(JSON.stringify(prev));
      mut(next);
      return next;
    });
  };

  const confirm = () => {
    signal.setFilterParams(params);
    setConfirmed(true);
  };

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto space-y-6">
      <div>
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Signal correction</div>
        <h1 className="text-2xl md:text-3xl font-semibold mt-1">Guided artifact removal</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">Step through each correction layer. Toggle it on, see the before/after preview update on a 6-second snapshot of your live capture, then confirm.</p>
      </div>

      <div className="grid lg:grid-cols-[280px_1fr] gap-6">
        <ol className="rounded-xl glass p-4 space-y-1">
          {STEPS.map((s, i) => {
            const active = i === stepIdx;
            const done = i < stepIdx;
            return (
              <li key={s.id}>
                <button
                  onClick={() => setStepIdx(i)}
                  className={`w-full text-left flex items-start gap-3 p-3 rounded-md ${active ? "bg-primary/10 text-primary border border-primary/20" : done ? "text-foreground hover:bg-secondary/40" : "text-muted-foreground hover:bg-secondary/40"}`}
                >
                  <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] text-mono shrink-0 ${active ? "bg-primary text-primary-foreground" : done ? "bg-[oklch(0.78_0.18_155)]/20 text-[oklch(0.78_0.18_155)]" : "bg-secondary"}`}>
                    {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span>
                    <span className="block text-sm font-medium">{s.title}</span>
                    <span className="block text-[11px] mt-0.5 leading-snug">{s.description}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className="space-y-5">
          <div className="rounded-xl glass p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-lg font-medium">{currentStep.title}</h2>
                <p className="text-xs text-muted-foreground mt-1 max-w-xl">{currentStep.description}</p>
              </div>
              {currentStep.id === "highpass" && (
                <Toggle label="Enable" value={params.highpass.enabled} onChange={(v) => update((p) => { p.highpass.enabled = v; })} />
              )}
              {currentStep.id === "notch" && (
                <Toggle label="Enable" value={params.notch.enabled} onChange={(v) => update((p) => { p.notch.enabled = v; })} />
              )}
              {currentStep.id === "smooth" && (
                <Toggle label="Enable" value={params.smooth.enabled} onChange={(v) => update((p) => { p.smooth.enabled = v; })} />
              )}
            </div>

            <div className="mt-5 grid md:grid-cols-2 gap-4">
              {currentStep.id === "highpass" && (
                <Slider label="Cutoff" unit="Hz" min={0.05} max={3} step={0.05} value={params.highpass.freq}
                  onChange={(v) => update((p) => { p.highpass.freq = v; })} />
              )}
              {currentStep.id === "notch" && (
                <>
                  <Slider label="Frequency" unit="Hz" min={45} max={65} step={1} value={params.notch.freq}
                    onChange={(v) => update((p) => { p.notch.freq = v; })} />
                  <Slider label="Q" unit="" min={5} max={60} step={1} value={params.notch.q}
                    onChange={(v) => update((p) => { p.notch.q = v; })} />
                </>
              )}
              {currentStep.id === "smooth" && (
                <Slider label="Window" unit="samples" min={1} max={21} step={2} value={params.smooth.window}
                  onChange={(v) => update((p) => { p.smooth.window = Math.round(v); })} />
              )}
            </div>
          </div>

          <div className="grid gap-4">
            <EcgPlayback label="Before" color="oklch(0.70 0.20 35)" buffer={snapshot} start={0} span={snapshot.length} height={150} />
            <EcgPlayback label="After" color="oklch(0.78 0.18 155)" buffer={after} start={0} span={after.length} height={150} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
              disabled={stepIdx === 0}
              className="px-3 py-2 rounded border border-border text-sm disabled:opacity-30 hover:bg-secondary/40"
            >Back</button>
            {stepIdx < STEPS.length - 1 ? (
              <button onClick={() => setStepIdx((i) => i + 1)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-primary text-primary-foreground text-sm font-medium">
                Next step <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button onClick={confirm} className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-primary text-primary-foreground text-sm font-medium">
                <Sparkles className="h-4 w-4" /> Apply to live stream
              </button>
            )}
            <button onClick={() => setParams(defaultFilterParams())} className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-border text-xs text-muted-foreground hover:bg-secondary/40">
              <RotateCcw className="h-3.5 w-3.5" /> Reset to defaults
            </button>
            {confirmed && <span className="text-xs text-[oklch(0.78_0.18_155)] inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Filters active on the live dashboard.</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2 text-xs">
      <span className="text-muted-foreground uppercase tracking-[0.2em]">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative h-6 w-11 rounded-full transition-colors ${value ? "bg-primary" : "bg-secondary"}`}
      >
        <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-background transition-transform ${value ? "translate-x-5" : ""}`} />
      </button>
    </label>
  );
}

function Slider({ label, unit, min, max, step, value, onChange }: { label: string; unit: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs text-mono">{value.toFixed(step < 1 ? 2 : 0)} {unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} className="w-full accent-[oklch(0.78_0.15_190)] mt-1" />
    </div>
  );
}
