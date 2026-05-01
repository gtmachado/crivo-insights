"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getConsolidatedGlossary } from "@/lib/api";
import { GlossaryPrintLayout } from "@/components/glossary/GlossaryPrintLayout";
import { Loader2 } from "lucide-react";

/**
 * Versão imprimível do glossário consolidado do nicho.
 */
export default function NichoGlossarioPrintPage() {
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
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-8">
        <p className="text-sm text-zinc-600">
          Glossário consolidado ainda não gerado para este nicho.
        </p>
      </div>
    );
  }

  return (
    <GlossaryPrintLayout
      markdown={data}
      title={`Glossário do nicho ${niche}`}
      subtitle="Consolidado de todas as entrevistas"
      autoPrint
    />
  );
}
