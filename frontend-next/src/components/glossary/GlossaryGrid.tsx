"use client";

import { useEffect, useMemo, useState } from "react";
import {
  parseGlossaryMarkdown,
  filterTerms,
  availableInitials,
  initialOf,
  type GlossaryTerm,
} from "@/lib/glossary";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GlossaryCard } from "./GlossaryCard";
import { GlossaryDetail } from "./GlossaryDetail";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Sparkles, Printer, X } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Página completa de glossário — visual moderno, navegável.
 *
 * Layout:
 *  - Header: título + busca + filtro A-Z + ações (imprimir / fechar)
 *  - Grid (esquerda, ~65%): cards de termos
 *  - Detail panel (direita, ~35%): definição completa + ações
 *
 * Markdown é a fonte de verdade — sempre re-parseado quando muda.
 *
 * Performance:
 *  - parseGlossaryMarkdown em useMemo — só roda quando o markdown muda
 *  - filtro também em useMemo
 *  - cards são botões nativos (zero overhead vs solução com framer/animação)
 *  - lazy loading natural: como tudo é em memória, só renderiza filtrados
 */
export function GlossaryGrid({
  markdown,
  title,
  subtitle,
  printHref,
  backHref,
}: {
  markdown: string;
  title: string;
  subtitle?: string;
  /** Link para a versão imprimível (opcional). Abre em nova aba. */
  printHref?: string;
  /** Link para voltar (header esquerdo). */
  backHref?: string;
}) {
  const [search, setSearch] = useState("");
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);

  const allTerms = useMemo(() => parseGlossaryMarkdown(markdown), [markdown]);
  const initials = useMemo(() => availableInitials(allTerms), [allTerms]);

  const filtered = useMemo(() => {
    let ts = filterTerms(allTerms, search);
    if (activeLetter) ts = ts.filter((t) => initialOf(t.term) === activeLetter);
    return ts;
  }, [allTerms, search, activeLetter]);

  const selected = useMemo<GlossaryTerm | null>(
    () => allTerms.find((t) => t.term === selectedTerm) ?? null,
    [allTerms, selectedTerm],
  );

  // Reset seleção se o termo selecionado sumiu (ex: markdown atualizou)
  useEffect(() => {
    if (selectedTerm && !allTerms.find((t) => t.term === selectedTerm)) {
      setSelectedTerm(null);
    }
  }, [allTerms, selectedTerm]);

  // Navegação por relacionados — se não existe no glossário, abre Google
  function handleSelectRelated(name: string) {
    const exists = allTerms.find(
      (t) => t.term.toLowerCase() === name.toLowerCase(),
    );
    if (exists) {
      setSelectedTerm(exists.term);
    } else {
      window.open(
        `https://www.google.com/search?q=${encodeURIComponent(name)}`,
        "_blank",
        "noopener,noreferrer",
      );
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="px-6 py-4 border-b border-border bg-background/40 backdrop-blur-sm shrink-0 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <h1 className="text-xl font-bold gradient-text truncate">
                {title}
              </h1>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
                {allTerms.length} termo{allTerms.length === 1 ? "" : "s"}
              </span>
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {printHref && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() =>
                  window.open(printHref, "_blank", "noopener,noreferrer")
                }
              >
                <Printer className="h-3.5 w-3.5" />
                Exportar PDF
              </Button>
            )}
            {backHref && (
              <Link
                href={backHref}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
                Fechar
              </Link>
            )}
          </div>
        </div>

        {/* Busca + filtro alfabético */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar termo, definição ou contexto…"
              className="h-8 pl-8 text-sm"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Limpar busca"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {initials.length > 1 && (
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveLetter(null)}
                className={cn(
                  "h-7 min-w-7 px-2 text-[11px] font-semibold rounded-md transition-colors",
                  activeLetter === null
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                Todos
              </button>
              {initials.map((letter) => (
                <button
                  key={letter}
                  type="button"
                  onClick={() =>
                    setActiveLetter((cur) => (cur === letter ? null : letter))
                  }
                  className={cn(
                    "h-7 w-7 text-[11px] font-semibold rounded-md transition-colors",
                    activeLetter === letter
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {letter}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* ── Body: grid + detail ────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Grid */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-6">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                  <Sparkles className="h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm font-medium">Nenhum termo encontrado</p>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    {search || activeLetter
                      ? "Tente limpar a busca ou o filtro alfabético."
                      : "Esse glossário ainda está vazio."}
                  </p>
                  {(search || activeLetter) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={() => {
                        setSearch("");
                        setActiveLetter(null);
                      }}
                    >
                      Limpar filtros
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filtered.map((t) => (
                    <GlossaryCard
                      key={t.term}
                      term={t}
                      active={selectedTerm === t.term}
                      onClick={() => setSelectedTerm(t.term)}
                    />
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Detail panel */}
        <aside className="hidden xl:flex w-[420px] shrink-0 border-l border-border bg-background/30 backdrop-blur-sm p-4 overflow-hidden">
          <GlossaryDetail
            term={selected}
            onClose={() => setSelectedTerm(null)}
            onSelectRelated={handleSelectRelated}
            className="flex-1 min-h-0"
          />
        </aside>

        {/* Mobile/tablet: detail como overlay deslizando da direita */}
        {selected && (
          <div
            className="xl:hidden fixed inset-0 z-40 flex"
            role="dialog"
            aria-modal="true"
          >
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setSelectedTerm(null)}
            />
            <div className="relative ml-auto w-full max-w-md h-full p-3 bg-background/0">
              <div className="h-full glass-strong rounded-xl overflow-hidden flex flex-col shadow-2xl glow-soft">
                <GlossaryDetail
                  term={selected}
                  onClose={() => setSelectedTerm(null)}
                  onSelectRelated={handleSelectRelated}
                  className="flex-1 min-h-0 border-0 rounded-none"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
