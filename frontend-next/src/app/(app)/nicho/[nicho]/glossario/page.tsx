"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getConsolidatedGlossary } from "@/lib/api";
import { GlossaryGrid } from "@/components/glossary/GlossaryGrid";
import { Loader2, AlertCircle } from "lucide-react";

/**
 * Página dedicada do glossário CONSOLIDADO do nicho.
 *
 * Fonte de verdade: backend → /niches/{niche}/glossary
 * (que lê _glossary/glossario_nicho.md). Esse arquivo é gerado pelo botão
 * "Consolidar Glossário" na página do nicho.
 */
export default function NichoGlossarioPage() {
  const params = useParams<{ nicho: string }>();
  const niche = decodeURIComponent(params.nicho);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["consolidated-glossary", niche],
    queryFn: () => getConsolidatedGlossary(niche),
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
          Glossário consolidado ainda não gerado.
        </p>
        <p className="text-xs text-muted-foreground max-w-md">
          Volte à página do nicho e use o botão{" "}
          <strong className="text-foreground">Consolidar Glossário</strong>{" "}
          para gerar uma versão unificada de todas as entrevistas.
        </p>
      </div>
    );
  }

  const backHref  = `/nicho/${encodeURIComponent(niche)}`;
  const printHref = `/nicho/${encodeURIComponent(niche)}/glossario/print`;

  return (
    <div className="-m-6 h-[calc(100vh-3.5rem)]">
      <GlossaryGrid
        markdown={data}
        title={`Glossário do nicho ${niche}`}
        subtitle="Consolidado — termos unificados de todas as entrevistas"
        backHref={backHref}
        printHref={printHref}
      />
    </div>
  );
}
