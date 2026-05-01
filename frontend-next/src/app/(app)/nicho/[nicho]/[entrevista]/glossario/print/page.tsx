"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getDocument } from "@/lib/api";
import { GlossaryPrintLayout } from "@/components/glossary/GlossaryPrintLayout";
import { Loader2 } from "lucide-react";

/**
 * Versão imprimível do glossário local da entrevista.
 *
 * Layout limpo (sem chrome global — controlado por (app)/layout.tsx via match
 * de "/print/" no pathname). useEffect dispara `window.print()` automatic-
 * amente após render.
 */
export default function EntrevistaGlossarioPrintPage() {
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
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-8">
        <p className="text-sm text-zinc-600">
          Glossário não disponível para esta entrevista.
        </p>
      </div>
    );
  }

  return (
    <GlossaryPrintLayout
      markdown={data}
      title={interview}
      subtitle={`Glossário local — nicho ${niche}`}
      autoPrint
    />
  );
}
