"use client";

import { type GlossaryTerm } from "@/lib/glossary";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

/**
 * Card individual de termo no grid. Glass effect com hover lift e glow.
 *
 * - Truncamento da definição em 3 linhas (line-clamp-3)
 * - Badge com contagem de relacionados (se houver)
 * - Active state quando o termo está selecionado no detail panel
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
      className={cn(
        "group relative flex flex-col gap-2 p-4 rounded-xl text-left",
        "glass border border-border/40",
        "transition-all duration-200",
        "hover:border-primary/40 hover:-translate-y-0.5 hover:glow-soft",
        active &&
          "border-primary/60 ring-2 ring-primary/30 -translate-y-0.5 glow-soft",
      )}
    >
      <div className="flex items-start justify-between gap-2 min-w-0">
        <h3
          className={cn(
            "text-sm font-semibold leading-tight truncate",
            active && "text-primary",
          )}
        >
          {term.term}
        </h3>
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 shrink-0 mt-0.5 transition-all",
            active
              ? "text-primary translate-x-0.5"
              : "text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5",
          )}
        />
      </div>

      {term.definition && (
        <p
          className="text-xs text-muted-foreground leading-relaxed overflow-hidden"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
          }}
        >
          {term.definition}
        </p>
      )}

      {(term.related.length > 0 || term.example) && (
        <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground/70">
          {term.related.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <span className="h-1 w-1 rounded-full bg-primary/60" />
              {term.related.length} relacionado{term.related.length > 1 ? "s" : ""}
            </span>
          )}
          {term.example && (
            <span className="inline-flex items-center gap-1">
              <span className="h-1 w-1 rounded-full bg-accent-foreground/60" />
              contexto
            </span>
          )}
        </div>
      )}
    </button>
  );
}
