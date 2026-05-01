"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { analyzeNiche, getNicheAnalysisJob } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Botão "Analisar nicho" — primário da página do nicho na Fase 4.
 *
 * - Disabled quando `selectedSlugs` é vazio.
 * - Dispara POST /niches/{niche}/analyze (Sonnet 4.6 obrigatório no backend).
 * - Faz polling do job a cada 2s até done | error.
 * - Ao terminar com sucesso, invalida cache de getNicheAnalysis e mostra toast.
 *
 * O modelo usado é fixo (Claude Sonnet 4.6 via OpenRouter, fallback Anthropic);
 * não há override por env. Mostra isso no tooltip do botão pra deixar claro.
 */
export function AnalyzeNicheButton({
  niche,
  selectedSlugs,
  totalCount,
  className,
}: {
  niche: string;
  selectedSlugs: string[];
  totalCount: number;
  className?: string;
}) {
  const qc = useQueryClient();
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);
  const [pollStatus, setPollStatus] = useState<"running" | "done" | "error" | null>(null);
  const stopRef = useRef(false);

  const startMutation = useMutation({
    mutationFn: () => analyzeNiche(niche, selectedSlugs),
    onSuccess: (data) => {
      toast.info(
        `Análise iniciada com ${selectedSlugs.length} entrevista${selectedSlugs.length > 1 ? "s" : ""}. Pode levar alguns minutos.`,
      );
      stopRef.current = false;
      setPollStatus("running");
      setPollingJobId(data.job_id);
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Erro ao iniciar análise.";
      toast.error(msg);
    },
  });

  // Polling: roda enquanto pollingJobId estiver setado e status === "running"
  useEffect(() => {
    if (!pollingJobId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      if (stopRef.current) return;
      try {
        const job = await getNicheAnalysisJob(niche, pollingJobId!);
        if (job.status === "done") {
          setPollStatus("done");
          setPollingJobId(null);
          qc.invalidateQueries({ queryKey: ["niche-analysis", niche] });
          toast.success("Análise do nicho concluída.");
          return;
        }
        if (job.status === "error") {
          setPollStatus("error");
          setPollingJobId(null);
          toast.error(
            job.log?.[job.log.length - 1] ?? "Erro durante a análise.",
          );
          return;
        }
        // ainda running — agenda próximo tick
        timer = setTimeout(tick, 2000);
      } catch {
        // se backend ficar momentaneamente indisponível, tenta de novo em 4s
        timer = setTimeout(tick, 4000);
      }
    }

    tick();
    return () => {
      stopRef.current = true;
      if (timer) clearTimeout(timer);
    };
  }, [pollingJobId, niche, qc]);

  const isLoading = startMutation.isPending || pollStatus === "running";
  const empty     = selectedSlugs.length === 0;

  let label = "Analisar nicho";
  if (selectedSlugs.length > 0) {
    label = `Analisar nicho (${selectedSlugs.length}${
      totalCount ? `/${totalCount}` : ""
    })`;
  }
  if (isLoading) label = "Analisando…";

  return (
    <Button
      type="button"
      size="lg"
      onClick={() => !isLoading && startMutation.mutate()}
      disabled={empty || isLoading}
      title={
        empty
          ? "Selecione ao menos uma entrevista"
          : "Roda Claude Sonnet 4.6 sobre as entrevistas selecionadas"
      }
      className={cn(
        "gap-2 gradient-bg text-white border-0 hover:opacity-90 disabled:opacity-50 glow-soft",
        className,
      )}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Sparkles className="h-4 w-4" />
      )}
      {label}
    </Button>
  );
}
