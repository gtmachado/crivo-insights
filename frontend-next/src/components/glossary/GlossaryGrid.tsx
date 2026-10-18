"use client";

import { useMemo, useState } from "react";
import { BookOpen, Search, X } from "lucide-react";
import {
  availableInitials,
  filterTerms,
  googleSearchUrl,
  initialOf,
  parseGlossaryMarkdown,
} from "@/lib/glossary";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/common/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { GlossaryCard } from "./GlossaryCard";
import { GlossaryDetail } from "./GlossaryDetail";

/**
 * Glossário navegável: busca (sem acento), filtro A–Z, cartões e detalhe.
 * É só o conteúdo — título, trilha e ações ficam no `PageHeader` da página.
 *
 * O markdown é a fonte de verdade e é reparseado quando muda. O detalhe fica
 * numa coluna lateral fixa em telas largas e num painel deslizante nas demais.
 */
export function GlossaryGrid({ markdown }: { markdown: string }) {
  const [search, setSearch] = useState("");
  const [letter, setLetter] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const wide = useMediaQuery("(min-width: 80rem)"); // xl: o detalhe é coluna fixa, sem painel

  const terms = useMemo(() => parseGlossaryMarkdown(markdown), [markdown]);
  const initials = useMemo(() => availableInitials(terms), [terms]);

  const filtered = useMemo(() => {
    const matches = filterTerms(terms, search);
    return letter ? matches.filter((t) => initialOf(t.term) === letter) : matches;
  }, [terms, search, letter]);

  // Se o termo sumiu (markdown atualizado), a seleção simplesmente deixa de existir.
  const selected = terms.find((t) => t.term === selectedName) ?? null;

  // Relacionado: abre no painel se existir no glossário; senão pesquisa no Google.
  function selectRelated(name: string) {
    const found = terms.find((t) => t.term.toLowerCase() === name.toLowerCase());
    if (found) setSelectedName(found.term);
    else window.open(googleSearchUrl(name), "_blank", "noopener,noreferrer");
  }

  if (terms.length === 0) {
    return <EmptyState icon={BookOpen} title="Este glossário ainda está vazio" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 max-w-md flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar termo, definição ou contexto…"
            aria-label="Buscar no glossário"
            className="pl-8"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Limpar busca"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          )}
        </div>

        {initials.length > 1 && (
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Filtrar por inicial">
            {[null, ...initials].map((l) => (
              <button
                key={l ?? "all"}
                type="button"
                aria-pressed={letter === l}
                onClick={() => setLetter((cur) => (cur === l ? null : l))}
                className={cn(
                  "h-7 min-w-7 rounded-md px-1.5 text-2xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  letter === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {l ?? "Todos"}
              </button>
            ))}
          </div>
        )}

        <p className="ml-auto text-xs text-muted-foreground" aria-live="polite">
          {filtered.length === terms.length
            ? `${terms.length} termo${terms.length === 1 ? "" : "s"}`
            : `${filtered.length} de ${terms.length} termos`}
        </p>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            title="Nenhum termo encontrado"
            description="Tente limpar a busca ou o filtro alfabético."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setLetter(null);
                }}
              >
                Limpar filtros
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {filtered.map((t) => (
              <GlossaryCard key={t.term} term={t} active={selectedName === t.term} onClick={() => setSelectedName(t.term)} />
            ))}
          </div>
        )}

        <aside className="sticky top-4 hidden max-h-[calc(100dvh-2rem)] xl:flex" aria-label="Detalhe do termo">
          <GlossaryDetail
            term={selected}
            onClose={() => setSelectedName(null)}
            onSelectRelated={selectRelated}
            className="min-h-64 flex-1"
          />
        </aside>
      </div>

      {/* Telas menores: o detalhe desliza da direita. */}
      <Sheet open={selected !== null && !wide} onOpenChange={(open) => !open && setSelectedName(null)}>
        <SheetContent side="right" className="w-full max-w-md gap-0 p-3">
          <SheetTitle className="sr-only">{selected?.term ?? "Termo"}</SheetTitle>
          <SheetDescription className="sr-only">Detalhe do termo do glossário</SheetDescription>
          <GlossaryDetail term={selected} onSelectRelated={selectRelated} className="min-h-0 flex-1" />
        </SheetContent>
      </Sheet>
    </div>
  );
}
