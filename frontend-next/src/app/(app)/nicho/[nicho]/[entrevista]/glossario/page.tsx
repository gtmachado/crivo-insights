"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getDocument } from "@/lib/api";
import { GlossaryGrid } from "@/components/glossary/GlossaryGrid";
import { Loader2, AlertCircle } from "lucide-react";

/**
 * Página dedicada do glossário LOCAL da entrevista.
 *
 * Fonte de verdade: backend → /interviews/{niche}/{interview}/glossary
 * (que lê glossary/glossario_local.md). Re-fetch sempre que rota muda.
 */
export default function EntrevistaGlossarioPage() {
  const params = useParams<{ nicho: string; entrevista: string }>();
  const niche     = decodeURIComponent(params.nicho);
  const interview = decodeURIComponent(params.entrevista);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["doc", niche, interview, "glossary"],
    queryFn: () => getDocument(niche, interview, "glossary"),
    staleTime: 5 * 60_000,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-2 text-center p-8">
        <AlertCircle className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm font-medium">
          Glossário ainda não gerado para esta entrevista.
        </p>
        <p className="text-xs text-muted-foreground max-w-md">
          O glossário local é gerado automaticamente como última etapa do
          pipeline. Verifique a timeline da entrevista.
        </p>
      </div>
    );
  }

  const backHref     = `/nicho/${encodeURIComponent(niche)}/${encodeURIComponent(interview)}`;
  const printHref    = `/nicho/${encodeURIComponent(niche)}/${encodeURIComponent(interview)}/glossario/print`;

  return (
    // -m-6 zera o padding global do main pra usar a área inteira
    <div className="-m-6 h-[calc(100vh-3.5rem)]">
      <GlossaryGrid
        markdown={data}
        title={interview}
        subtitle={`Glossário local · nicho ${niche}`}
        backHref={backHref}
        printHref={printHref}
      />
    </div>
  );
}
