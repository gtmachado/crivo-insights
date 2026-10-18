"use client";

import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { ApiError, getNicheAnalysis } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/States";
import { MarkdownPreview } from "@/components/markdown/MarkdownPreview";
import { Button } from "@/components/ui/button";

/**
 * Análise consolidada do nicho (Claude Sonnet 4.6 sobre as entrevistas
 * estruturadas selecionadas). O cache é invalidado quando o job termina.
 *
 * "Ainda não gerada" (404) e falha real são estados diferentes.
 */
export function NicheAnalysisTab({ niche, onGoToInterviews }: { niche: string; onGoToInterviews: () => void }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.nicheAnalysis(niche),
    queryFn: () => getNicheAnalysis(niche),
    staleTime: 30_000,
    retry: false,
  });

  if (isLoading) return <LoadingState lines={6} />;

  if (error) {
    if (error instanceof ApiError && error.status === 404) {
      return (
        <EmptyState
          icon={Sparkles}
          title="A análise deste nicho ainda não foi gerada"
          description="Escolha as entrevistas estruturadas na aba Entrevistas e gere a análise. Ela usa apenas o documento estruturado de cada uma."
          action={
            <Button variant="outline" onClick={onGoToInterviews}>
              Escolher entrevistas
            </Button>
          }
        />
      );
    }
    return <ErrorState title="Não foi possível carregar a análise" error={error} onRetry={() => refetch()} />;
  }

  return (
    <article className="rounded-xl bg-card px-5 py-6 ring-1 ring-foreground/10 sm:px-10 sm:py-8">
      <MarkdownPreview content={data ?? ""} />
    </article>
  );
}
