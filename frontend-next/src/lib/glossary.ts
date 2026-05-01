/**
 * Parser e helpers do glossário. Fonte de verdade: o markdown gerado
 * pelo pipeline (`glossario_local.md` ou `glossario_nicho.md`).
 *
 * Formato esperado de cada termo:
 *
 *   ## Termo
 *   **Definição:** ...
 *   **Exemplo:** "..."
 *   **Termos relacionados:** termo1, termo2
 *
 * Aceita também os equivalentes em inglês (Definition / Example / Related)
 * caso o LLM responda noutro idioma.
 *
 * Anteriormente vivia inline em `GlossaryPanel.tsx`. Foi extraído pra ser
 * reutilizado pela GlossaryGrid (página dedicada) e pelo PrintLayout, sem
 * duplicar lógica.
 */

export type GlossaryTerm = {
  term: string;
  definition: string;
  example: string;
  related: string[];
};

const HEADER_BLACKLIST = ["glossário", "glossario", "termos", "glossary"];

export function parseGlossaryMarkdown(md: string): GlossaryTerm[] {
  if (!md) return [];
  const terms: GlossaryTerm[] = [];
  const blocks = md.split(/^## /m).filter(Boolean);

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    const term = lines[0].replace(/^#+\s*/, "").trim();
    if (!term) continue;
    const lower = term.toLowerCase();
    if (HEADER_BLACKLIST.some((h) => lower.includes(h))) continue;

    let definition = "";
    let example = "";
    let related: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith("**Definição:**") || line.startsWith("**Definition:**")) {
        definition = line
          .replace(/\*\*Defini[çc][aã]o:\*\*|\*\*Definition:\*\*/i, "")
          .trim();
      } else if (line.startsWith("**Exemplo:**") || line.startsWith("**Example:**")) {
        example = line
          .replace(/\*\*Exemplo:\*\*|\*\*Example:\*\*/i, "")
          .replace(/["“”]/g, "")
          .trim();
      } else if (
        line.startsWith("**Termos relacionados:**") ||
        line.startsWith("**Related:**")
      ) {
        related = line
          .replace(/\*\*Termos relacionados:\*\*|\*\*Related:\*\*/i, "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }

    if (term && (definition || example)) {
      terms.push({ term, definition, example, related });
    }
  }

  return terms.sort((a, b) => a.term.localeCompare(b.term, "pt-BR"));
}

// ── Helpers de UI ────────────────────────────────────────────────────────────

/**
 * Devolve a primeira letra normalizada (sem acento, maiúscula) — usada
 * pra agrupar termos em colunas A-Z.
 */
export function initialOf(term: string): string {
  if (!term) return "#";
  const first = term
    .normalize("NFD")
    .replace(/̀-ͯ/g, "")
    .charAt(0)
    .toUpperCase();
  return /[A-Z]/.test(first) ? first : "#";
}

export function groupByInitial(terms: GlossaryTerm[]): Record<string, GlossaryTerm[]> {
  return terms.reduce<Record<string, GlossaryTerm[]>>((acc, t) => {
    const k = initialOf(t.term);
    (acc[k] ??= []).push(t);
    return acc;
  }, {});
}

/**
 * Lista única e ordenada das iniciais presentes nos termos.
 * Garante o "#" sempre por último.
 */
export function availableInitials(terms: GlossaryTerm[]): string[] {
  const set = new Set(terms.map((t) => initialOf(t.term)));
  const arr = Array.from(set).filter((x) => x !== "#").sort();
  if (set.has("#")) arr.push("#");
  return arr;
}

/**
 * Filtra por busca textual (term + definition + example) — case-insensitive,
 * sem acento.
 */
export function filterTerms(terms: GlossaryTerm[], query: string): GlossaryTerm[] {
  if (!query.trim()) return terms;
  const q = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/̀-ͯ/g, "");
  const matches = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/̀-ͯ/g, "")
      .includes(q);
  return terms.filter(
    (t) => matches(t.term) || matches(t.definition) || matches(t.example),
  );
}

/**
 * Cria URL de busca no Google pro termo. Inclui prefixo "definição de"
 * pra ranking melhor de fontes.
 */
export function googleSearchUrl(term: string): string {
  const q = encodeURIComponent(`definição de "${term}"`);
  return `https://www.google.com/search?q=${q}`;
}

/**
 * Texto formatado pra copiar (term + definition + exemplo).
 */
export function formatTermForCopy(t: GlossaryTerm): string {
  const parts = [t.term];
  if (t.definition) parts.push(`\nDefinição: ${t.definition}`);
  if (t.example)    parts.push(`\nExemplo: "${t.example}"`);
  if (t.related.length) parts.push(`\nRelacionados: ${t.related.join(", ")}`);
  return parts.join("\n");
}
