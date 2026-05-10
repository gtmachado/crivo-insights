"use client";

import { useQuery } from "@tanstack/react-query";
import { getNicheAnalysis } from "@/lib/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MarkdownPreview } from "@/components/markdown/MarkdownPreview";
import { Sparkles, Loader2, AlertCircle } from "lucide-react";

/**
 * Aba de visualização da análise manual do nicho (Fase 4).
 *
 * Estados:
 *  - loading       → spinner
 *  - sem dados     → call-to-action explicando como gerar
 *  - dados prontos → MarkdownPreview no rolável
 *
 * O cache é invalidado pelo AnalyzeNicheButton quando o job termina.
 */
export function NicheAnalysisTab({
  niche,
  hasInterviewsSelected,
}: {
  niche: string;
  hasInterviewsSelected: boolean;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["niche-analysis", niche],
    queryFn: () => getNicheAnalysis(niche),
    staleTime: 30_000,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center glow-soft">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <p className="text-sm font-medium">Análise do nicho ainda não gerada</p>
        <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
          {hasInterviewsSelected ? (
            <>
              Clique em <strong className="text-foreground">Analisar nicho</strong>{" "}
              acima para rodar a análise consolidada com Claude Sonnet 4.6 sobre
              as entrevistas selecionadas.
            </>
          ) : (
            <>
              Clique em{" "}
              <strong className="text-foreground">Analisar nicho</strong>.
              Você poderá escolher as entrevistas estruturadas antes de iniciar.
            </>
          )}
        </p>
        <p className="text-[11px] text-muted-foreground/70 mt-2 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          A análise usa apenas os arquivos{" "}
          <code className="font-mono">03_estruturada.md</code>.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-6">
        <MarkdownPreview content={data} />
      </div>
    </ScrollArea>
  );
}
