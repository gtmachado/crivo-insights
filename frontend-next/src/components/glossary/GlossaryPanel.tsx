"use client";

import { useMemo, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Copy, Search, ExternalLink } from "lucide-react";
import { toast } from "sonner";

type GlossaryTerm = {
  term: string;
  definition: string;
  example: string;
  related: string[];
};

function parseGlossaryMarkdown(md: string): GlossaryTerm[] {
  const terms: GlossaryTerm[] = [];
  const blocks = md.split(/^## /m).filter(Boolean);

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    const term = lines[0].replace(/^#+\s*/, "").trim();
    if (!term || term.toLowerCase().includes("glossário") || term.toLowerCase().includes("termos")) continue;

    let definition = "";
    let example = "";
    let related: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith("**Definição:**") || line.startsWith("**Definition:**"))
        definition = line.replace(/\*\*Defini[çc][aã]o:\*\*|\*\*Definition:\*\*/i, "").trim();
      else if (line.startsWith("**Exemplo:**") || line.startsWith("**Example:**"))
        example = line.replace(/\*\*Exemplo:\*\*|\*\*Example:\*\*/i, "").replace(/["""]/g, "").trim();
      else if (line.startsWith("**Termos relacionados:**") || line.startsWith("**Related:**"))
        related = line.replace(/\*\*Termos relacionados:\*\*|\*\*Related:\*\*/i, "").split(",").map((s) => s.trim()).filter(Boolean);
    }

    if (term && (definition || example)) terms.push({ term, definition, example, related });
  }

  return terms.sort((a, b) => a.term.localeCompare(b.term));
}

export function GlossaryPanel({ markdown }: { markdown: string }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const terms = useMemo(() => parseGlossaryMarkdown(markdown), [markdown]);

  const filtered = useMemo(
    () => terms.filter((t) =>
      t.term.toLowerCase().includes(search.toLowerCase()) ||
      t.definition.toLowerCase().includes(search.toLowerCase()),
    ),
    [terms, search],
  );

  const selectedTerm = terms.find((t) => t.term === selected);

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  }

  function searchGoogle(term: string) {
    window.open(`https://www.google.com/search?q=${encodeURIComponent(term)}`, "_blank");
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Glossário ({terms.length} termos)
        </p>
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
              <p className="text-xs text-muted-foreground text-center py-4">Nenhum termo encontrado</p>
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
                onClick={() => copy(selectedTerm.term)}
                className="p-1 rounded hover:bg-accent text-muted-foreground"
                title="Copiar"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => searchGoogle(selectedTerm.term)}
                className="p-1 rounded hover:bg-accent text-muted-foreground"
                title="Buscar no Google"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {selectedTerm.definition && (
            <p className="text-xs text-muted-foreground leading-relaxed">{selectedTerm.definition}</p>
          )}

          {selectedTerm.example && (
            <div className="rounded bg-muted/50 px-2 py-1.5">
              <p className="text-xs text-muted-foreground italic">"{selectedTerm.example}"</p>
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
