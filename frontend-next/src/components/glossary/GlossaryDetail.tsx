"use client";

import { BookOpen, Copy, ExternalLink, Quote, Tag, X } from "lucide-react";
import { toast } from "sonner";
import { formatTermForCopy, googleSearchUrl, type GlossaryTerm } from "@/lib/glossary";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function Label({ icon: Icon, children }: { icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <p className="mb-1.5 flex items-center gap-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
      {Icon && <Icon className="size-3" aria-hidden />} {children}
    </p>
  );
}

/**
 * Detalhe de um termo: definição, contexto da entrevista, relacionados (que
 * navegam sem fechar o painel) e ações de pesquisar/copiar.
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
      <div className={cn("flex flex-col items-center justify-center gap-3 rounded-xl bg-card p-8 text-center ring-1 ring-foreground/10", className)}>
        <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <BookOpen className="size-5" aria-hidden />
        </div>
        <p className="text-sm font-medium">Selecione um termo</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          Clique em um cartão para ver a definição completa, o contexto e os termos relacionados.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10", className)}>
      <div className="space-y-3 border-b border-border px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Label>Termo</Label>
            <h2 className="break-words font-heading text-xl font-semibold leading-tight">{term.term}</h2>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Fechar painel">
              <X aria-hidden />
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.open(googleSearchUrl(term.term), "_blank", "noopener,noreferrer")}
          >
            <ExternalLink aria-hidden /> Pesquisar no Google
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              void navigator.clipboard.writeText(formatTermForCopy(term));
              toast.success(`"${term.term}" copiado.`);
            }}
          >
            <Copy aria-hidden /> Copiar
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        {term.definition && (
          <section>
            <Label>Definição</Label>
            <p className="text-sm leading-relaxed">{term.definition}</p>
          </section>
        )}

        {term.example && (
          <section>
            <Label icon={Quote}>Contexto da entrevista</Label>
            <blockquote className="border-l-[3px] border-highlight py-0.5 pl-4 font-heading text-[0.95rem] italic leading-relaxed">
              &ldquo;{term.example}&rdquo;
            </blockquote>
          </section>
        )}

        {term.related.length > 0 && (
          <section>
            <Label icon={Tag}>Termos relacionados</Label>
            <div className="flex flex-wrap gap-1.5">
              {term.related.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => onSelectRelated?.(r)}
                  className="inline-flex items-center rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground outline-none transition-colors hover:bg-accent/70 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {r}
                </button>
              ))}
            </div>
          </section>
        )}

        {!term.definition && !term.example && term.related.length === 0 && (
          <p className="text-xs italic text-muted-foreground">Sem detalhes adicionais para este termo.</p>
        )}
      </div>
    </div>
  );
}
