import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { signal } from "@/lib/signal";
import { computeHrv, evaluateArrhythmia } from "@/lib/analytics";
import { HrvPanel } from "@/components/HrvPanel";
import { ArrhythmiaFlags } from "@/components/ArrhythmiaFlags";
import { BpmHistory } from "@/components/BpmHistory";

export const Route = createFileRoute("/_app/analytics")({ component: AnalyticsPage });

function AnalyticsPage() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const u = signal.subscribe(() => setTick((t) => t + 1));
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => { u(); clearInterval(id); };
  }, []);

  const snap = signal.snapshot();
  const hrv2 = useMemo(() => computeHrv(signal.bpmHistory, 120_000), [signal.bpmHistory.length]);
  const hrv5 = useMemo(() => computeHrv(signal.bpmHistory, 300_000), [signal.bpmHistory.length]);
  const flags = useMemo(() => evaluateArrhythmia(snap.bpm, hrv2), [snap.bpm, hrv2]);

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto space-y-5">
      <div>
        <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Analyse</div>
        <h1 className="font-display text-2xl md:text-3xl mt-1">HRV & Arythmies</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">Métriques dérivées de la série d'intervalles RR reçus depuis le capteur.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="rounded-2xl glass p-4">
          <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground mb-3">Fenêtre 2 minutes</div>
          <HrvPanel metrics={hrv2} />
        </div>
        <div className="rounded-2xl glass p-4">
          <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground mb-3">Fenêtre 5 minutes</div>
          <HrvPanel metrics={hrv5} />
        </div>
      </div>

      <div className="rounded-2xl glass p-4">
        <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground mb-3">État du rythme</div>
        <ArrhythmiaFlags flags={flags} />
      </div>

      {signal.bpmHistory.length > 1 && (
        <div className="rounded-2xl glass p-5">
          <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground mb-2">Tendance HR — historique complet</div>
          <BpmHistory data={signal.bpmHistory} height={200} />
        </div>
      )}
    </div>
  );
}
