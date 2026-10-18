"use client";

import { AlertCircle, ChevronUp, Cpu, ScrollText, Timer } from "lucide-react";
import { type Stage, STAGE_HINTS, formatElapsed } from "@/lib/pipeline";
import { STAGE_STATUS, TONE } from "@/lib/status";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";

function Metric({ icon: Icon, label, children }: { icon?: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <p className="flex items-center gap-1 text-2xs uppercase tracking-wider text-muted-foreground">
        {Icon && <Icon className="size-2.5" aria-hidden />} {label}
      </p>
      {children}
    </div>
  );
}

/**
 * Detalhe de uma etapa (a "sanfona" da timeline): status, tempo, modelo,
 * logs coletados e mensagem de erro.
 */
export function PipelineStageDetails({ stage, onClose }: { stage: Stage; onClose?: () => void }) {
  const meta = STAGE_STATUS[stage.status];
  const elapsed = formatElapsed(stage.started_at, stage.ended_at);

  return (
    <div className="mt-2 space-y-3 rounded-lg border border-border bg-card p-3 text-sm animate-in fade-in slide-in-from-top-1 duration-150">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium leading-tight">{stage.label}</p>
          <p className="text-xs text-muted-foreground">{STAGE_HINTS[stage.id]}</p>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon-xs" onClick={onClose} aria-label="Recolher detalhes">
            <ChevronUp aria-hidden />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 border-t border-border pt-3 text-xs">
        <Metric label="Status">
          <StatusBadge tone={meta.tone} label={meta.label} />
        </Metric>
        <Metric icon={Timer} label="Tempo">
          <p className="font-mono">{elapsed ?? "—"}</p>
        </Metric>
        <Metric icon={Cpu} label="Modelo">
          <p className="truncate font-mono text-2xs" title={stage.model ?? undefined}>
            {stage.model ?? "—"}
          </p>
        </Metric>
      </div>

      {stage.logs && stage.logs.length > 0 && (
        <div className="space-y-1.5 border-t border-border pt-3">
          <p className="flex items-center gap-1 text-2xs uppercase tracking-wider text-muted-foreground">
            <ScrollText className="size-2.5" aria-hidden /> Logs ({stage.logs.length})
          </p>
          <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-muted p-2.5 font-mono text-2xs leading-relaxed text-muted-foreground">
            {stage.logs.join("\n")}
          </pre>
        </div>
      )}

      {stage.error && (
        <div className={`flex gap-2 rounded-md p-2.5 ${TONE.danger.soft}`}>
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="text-xs font-medium">Falha na execução</p>
            <p className="mt-0.5 break-words font-mono text-2xs">{stage.error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
