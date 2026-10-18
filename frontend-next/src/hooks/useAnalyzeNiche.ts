import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { analyzeNiche, errorMessage, getNicheAnalysisJob } from "@/lib/api";
import { qk } from "@/lib/query-keys";

const POLL_MS = 2_500;

/**
 * Dispara a análise do nicho e acompanha o job até terminar.
 *
 * Fica na página (não em um botão que pode desmontar): o acompanhamento
 * sobrevive à troca de aba, e o resultado invalida o cache da análise.
 * Antes eram um `setTimeout` recursivo manual dentro do botão.
 */
export function useAnalyzeNiche(niche: string) {
  const qc = useQueryClient();
  const [jobId, setJobId] = useState<string | null>(null);

  const start = useMutation({
    mutationFn: (slugs: string[]) => analyzeNiche(niche, slugs),
    onSuccess: (data, slugs) => {
      setJobId(data.job_id);
      toast.info(
        `Análise iniciada com ${slugs.length} entrevista${slugs.length > 1 ? "s" : ""}. Pode levar alguns minutos.`,
      );
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const job = useQuery({
    queryKey: qk.analysisJob(niche, jobId ?? ""),
    queryFn: () => getNicheAnalysisJob(niche, jobId as string),
    enabled: jobId !== null,
    retry: false,
    refetchInterval: (q) => (q.state.data && q.state.data.status !== "running" ? false : POLL_MS),
  });

  const status = job.data?.status;
  const lastLog = job.data?.log[job.data.log.length - 1];

  useEffect(() => {
    if (status === "done") {
      qc.invalidateQueries({ queryKey: qk.nicheAnalysis(niche) });
      toast.success("Análise do nicho concluída.");
    } else if (status === "error") {
      toast.error(lastLog ?? "Erro durante a análise.");
    }
  }, [status, lastLog, niche, qc]);

  return {
    start: (slugs: string[]) => start.mutate(slugs),
    isRunning: start.isPending || status === "running",
    failure: status === "error" ? (lastLog ?? "Erro durante a análise.") : null,
  };
}
