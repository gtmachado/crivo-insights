"use client";

import {
  type GlossaryTerm,
  formatTermForCopy,
  googleSearchUrl,
} from "@/lib/glossary";
import { Button } from "@/components/ui/button";
import {
  Copy,
  ExternalLink,
  Quote,
  Tag,
  X,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Painel de detalhe de um termo. Renderizado inline ao lado do grid (não é
 * modal — fica sempre visível na coluna direita do GlossaryGrid).
 *
 * Estrutura pedida:
 *  - definição
 *  - contexto (exemplo da entrevista)
 *  - termos relacionados (clicáveis pra navegar)
 *  - botão "Pesquisar no Google"
 *  - botão "Copiar"
 *
 * `onSelectRelated` permite navegar entre termos sem fechar o painel.
 */
export function GlossaryDetail({
  term,
  onClose,
  onSelectRelated,
  className,
}: {
  term: GlossaryTerm | null;
  onClose?: () => void;
  onSelectRelated?: (relatedTerm: string) => void;
  className?: string;
}) {
  if (!term) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center text-center gap-3 p-8",
          "glass border border-border/40 rounded-xl",
          className,
        )}
      >
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center glow-soft">
          <BookOpen className="h-5 w-5 text-primary/70" />
        </div>
        <p className="text-sm font-medium">Selecione um termo</p>
        <p className="text-xs text-muted-foreground max-w-xs">
          Clique em qualquer card à esquerda para ver a definição completa,
          contexto e termos relacionados.
        </p>
      </div>
    );
  }

  function handleCopy() {
    void navigator.clipboard.writeText(formatTermForCopy(term!));
    toast.success(`"${term!.term}" copiado.`);
  }

  function handleGoogle() {
    window.open(googleSearchUrl(term!.term), "_blank", "noopener,noreferrer");
  }

  return (
    <div
      className={cn(
        "glass border border-border/40 rounded-xl overflow-hidden flex flex-col",
        className,
      )}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-border/40 bg-background/40">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">
              Termo
            </p>
            <h2 className="text-xl font-bold leading-tight gradient-text break-words">
              {term.term}
            </h2>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar painel"
              className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleGoogle}
            className="gap-1.5"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Pesquisar no Google
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleCopy}
            className="gap-1.5"
          >
            <Copy className="h-3.5 w-3.5" /> Copiar
          </Button>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {term.definition && (
          <section>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1.5">
              Definição
            </p>
            <p className="text-sm leading-relaxed text-foreground/90">
              {term.definition}
            </p>
          </section>
        )}

        {term.example && (
          <section>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1.5 flex items-center gap-1">
              <Quote className="h-3 w-3" /> Contexto da entrevista
            </p>
            <blockquote className="rounded-lg bg-primary/5 border-l-3 border-primary/50 px-4 py-3">
              <p className="text-sm italic text-foreground/85 leading-relaxed">
                &ldquo;{term.example}&rdquo;
              </p>
            </blockquote>
          </section>
        )}

        {term.related.length > 0 && (
          <section>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-2 flex items-center gap-1">
              <Tag className="h-3 w-3" /> Termos relacionados
            </p>
            <div className="flex flex-wrap gap-1.5">
              {term.related.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => onSelectRelated?.(r)}
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium",
                    "border border-primary/30 bg-primary/10 text-primary",
                    "hover:bg-primary/20 hover:border-primary/50 transition-colors",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </section>
        )}

        {!term.definition && !term.example && term.related.length === 0 && (
          <p className="text-xs text-muted-foreground italic">
            Sem detalhes adicionais para este termo.
          </p>
        )}
      </div>
    </div>
  );
}
