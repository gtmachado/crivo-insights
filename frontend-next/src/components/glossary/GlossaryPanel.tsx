"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Copy,
  Search,
  ExternalLink,
  Maximize2,
} from "lucide-react";
import { toast } from "sonner";
import {
  parseGlossaryMarkdown,
  filterTerms,
  formatTermForCopy,
  googleSearchUrl,
} from "@/lib/glossary";

/**
 * Painel compacto do glossário — modo embutido no sidebar direito da página
 * da entrevista (Fase 1). Mantém a UX antiga (lista clicável + detalhe inline
 * em baixo) mas agora consome o parser do `@/lib/glossary` e oferece um
 * atalho para a página completa em `glossarioFullHref`.
 *
 * Pra UX rica (cards, filtro A-Z, detail panel completo, exportar PDF),
 * use `GlossaryGrid` em página dedicada.
 */
export function GlossaryPanel({
  markdown,
  glossarioFullHref,
}: {
  markdown: string;
  /** Se passado, mostra um botão "abrir página completa" no header */
  glossarioFullHref?: string;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const terms = useMemo(() => parseGlossaryMarkdown(markdown), [markdown]);
  const filtered = useMemo(() => filterTerms(terms, search), [terms, search]);
  const selectedTerm = terms.find((t) => t.term === selected);

  function copy(text: string) {
    void navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between mb-2 gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
            Glossário ({terms.length})
          </p>
          {glossarioFullHref && (
            <Link
              href={glossarioFullHref}
              title="Abrir glossário em página completa"
              className="shrink-0 inline-flex items-center justify-center h-6 w-6 rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <Maximize2 className="h-3 w-3" />
            </Link>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar termo..."
            className="h-7 pl-7 text-xs"
          />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Lista de termos */}
        <ScrollArea className="w-full border-r border-border">
          <div className="p-2 space-y-0.5">
            {filtered.map((t) => (
              <button
                key={t.term}
                onClick={() => setSelected(t.term === selected ? null : t.term)}
                className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                  selected === t.term
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent text-foreground"
                }`}
              >
                {t.term}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Nenhum termo encontrado
              </p>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Detalhe do termo selecionado */}
      {selectedTerm && (
        <div className="border-t border-border p-3 space-y-2 max-h-64 overflow-y-auto">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold">{selectedTerm.term}</p>
            <div className="flex gap-1">
              <button
                onClick={() => copy(formatTermForCopy(selectedTerm))}
                className="p-1 rounded hover:bg-accent text-muted-foreground"
                title="Copiar"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
              <a
                href={googleSearchUrl(selectedTerm.term)}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 rounded hover:bg-accent text-muted-foreground"
                title="Buscar no Google"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          {selectedTerm.definition && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              {selectedTerm.definition}
            </p>
          )}

          {selectedTerm.example && (
            <div className="rounded bg-muted/50 px-2 py-1.5">
              <p className="text-xs text-muted-foreground italic">
                &ldquo;{selectedTerm.example}&rdquo;
              </p>
            </div>
          )}

          {selectedTerm.related.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {selectedTerm.related.map((r) => (
                <Badge
                  key={r}
                  variant="outline"
                  className="text-xs cursor-pointer hover:bg-accent"
                  onClick={() => setSelected(r)}
                >
                  {r}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
