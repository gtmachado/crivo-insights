"use client";

import { ChevronRight } from "lucide-react";
import type { GlossaryTerm } from "@/lib/glossary";
import { cn } from "@/lib/utils";

/**
 * Cartão de um termo no grid: nome, definição em até 3 linhas e indicadores
 * de relacionados/contexto. `active` marca o termo aberto no painel de detalhe.
 */
export function GlossaryCard({
  term,
  active = false,
  onClick,
}: {
  term: GlossaryTerm;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "group flex flex-col gap-2 rounded-xl bg-card p-4 text-left ring-1 ring-foreground/10 outline-none transition-shadow",
        "hover:ring-foreground/25 focus-visible:ring-2 focus-visible:ring-ring",
        active && "ring-2 ring-primary",
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <h3 className={cn("truncate text-sm font-semibold leading-tight", active && "text-primary")}>{term.term}</h3>
        <ChevronRight
          className="mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </div>

      {term.definition && (
        <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">{term.definition}</p>
      )}

      {(term.related.length > 0 || term.example) && (
        <p className="mt-1 flex items-center gap-3 text-2xs text-muted-foreground">
          {term.related.length > 0 && (
            <span>
              {term.related.length} relacionado{term.related.length > 1 ? "s" : ""}
            </span>
          )}
          {term.example && <span>com contexto</span>}
        </p>
      )}
    </button>
  );
}
