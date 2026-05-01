"use client";

import { useEffect } from "react";
import {
  parseGlossaryMarkdown,
  groupByInitial,
  availableInitials,
} from "@/lib/glossary";
import { Printer } from "lucide-react";

/**
 * Layout limpo para impressão / exportação em PDF.
 *
 * - Sem header global, sem sidebar, sem navegação
 * - Tipografia serif legível, fundo branco mesmo em dark mode (forçado por
 *   regra `@page` e `print-only` no globals.css)
 * - Multi-coluna: 2 colunas em A4, 1 em mobile
 * - Termos agrupados por letra inicial (A, B, C…)
 * - Botão "Imprimir" no topo aparece SÓ na tela; some em @media print
 * - useEffect dispara `window.print()` automaticamente após o primeiro paint,
 *   mas só se `autoPrint` for true (default true). Pra revisar antes, abrir
 *   manualmente sem `?print=1`.
 */
export function GlossaryPrintLayout({
  markdown,
  title,
  subtitle,
  autoPrint = true,
}: {
  markdown: string;
  title: string;
  subtitle?: string;
  autoPrint?: boolean;
}) {
  const terms = parseGlossaryMarkdown(markdown);
  const initials = availableInitials(terms);
  const grouped = groupByInitial(terms);

  useEffect(() => {
    if (!autoPrint) return;
    // Atrasa um tick para garantir que o DOM está renderizado e que webfonts
    // carregaram antes do diálogo de impressão abrir.
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, [autoPrint]);

  const generatedAt = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="print-root min-h-screen bg-white text-black">
      {/* Toolbar — visível só na tela */}
      <div className="no-print sticky top-0 z-10 bg-white border-b border-zinc-200 px-6 py-3 flex items-center justify-between">
        <div className="text-sm">
          <span className="font-semibold text-zinc-900">{title}</span>
          {subtitle && (
            <span className="text-zinc-500 ml-2">— {subtitle}</span>
          )}
          <span className="text-zinc-400 ml-2">
            ({terms.length} termo{terms.length === 1 ? "" : "s"})
          </span>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-zinc-900 text-white text-sm hover:bg-zinc-700 transition-colors"
        >
          <Printer className="h-3.5 w-3.5" /> Imprimir / Salvar PDF
        </button>
      </div>

      {/* Conteúdo imprimível */}
      <article className="print-article max-w-[210mm] mx-auto px-12 py-10">
        <header className="text-center mb-8 pb-4 border-b border-zinc-300">
          <h1 className="text-2xl font-bold text-zinc-900">{title}</h1>
          {subtitle && (
            <p className="text-sm text-zinc-600 mt-1">{subtitle}</p>
          )}
          <p className="text-xs text-zinc-400 mt-2">
            Gerado em {generatedAt} · {terms.length} termo
            {terms.length === 1 ? "" : "s"}
          </p>
        </header>

        {terms.length === 0 ? (
          <p className="text-center italic text-zinc-500 py-8">
            Glossário vazio.
          </p>
        ) : (
          <>
            {/* Sumário (índice de iniciais) — só visível em telas grandes */}
            {initials.length > 1 && (
              <nav className="mb-6 text-xs text-zinc-500 flex flex-wrap gap-x-2 gap-y-1 justify-center print-toc">
                {initials.map((letter) => (
                  <a
                    key={letter}
                    href={`#letra-${letter}`}
                    className="hover:text-zinc-900 transition-colors no-underline"
                  >
                    {letter}
                  </a>
                ))}
              </nav>
            )}

            {/* Conteúdo em duas colunas */}
            <div className="print-columns">
              {initials.map((letter) => {
                const group = grouped[letter] ?? [];
                if (group.length === 0) return null;
                return (
                  <section
                    key={letter}
                    id={`letra-${letter}`}
                    className="break-inside-avoid mb-6"
                  >
                    <h2 className="text-lg font-bold text-zinc-900 border-b border-zinc-300 pb-1 mb-3 mt-2">
                      {letter}
                    </h2>
                    <div className="space-y-4">
                      {group.map((t) => (
                        <div
                          key={t.term}
                          className="break-inside-avoid leading-snug"
                        >
                          <h3 className="text-sm font-semibold text-zinc-900">
                            {t.term}
                          </h3>
                          {t.definition && (
                            <p className="text-[13px] text-zinc-700 leading-relaxed mt-0.5">
                              {t.definition}
                            </p>
                          )}
                          {t.example && (
                            <p className="text-[12px] italic text-zinc-500 mt-1 pl-3 border-l-2 border-zinc-300">
                              &ldquo;{t.example}&rdquo;
                            </p>
                          )}
                          {t.related.length > 0 && (
                            <p className="text-[11px] text-zinc-400 mt-1">
                              Ver também:{" "}
                              <span className="italic">
                                {t.related.join(", ")}
                              </span>
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </>
        )}

        <footer className="mt-10 pt-4 border-t border-zinc-200 text-[11px] text-zinc-400 text-center">
          Crivo Insights — glossário gerado automaticamente a partir das
          entrevistas processadas.
        </footer>
      </article>
    </div>
  );
}
