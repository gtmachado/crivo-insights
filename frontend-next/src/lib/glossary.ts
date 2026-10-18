/**
 * Parser e helpers do glossário. Fonte de verdade: o markdown gerado pelo
 * pipeline (`glossario_local.md`).
 *
 * O prompt do glossário não fixa um formato, e a saída do LLM varia. O parser
 * aceita as variações vistas nos dados reais:
 *
 *   ## Termo                         ### **Termo**                ## 1. Termo
 *   **Definição:** texto             *   **Definição:** texto     **Definição:**
 *   **Exemplo:** "texto"             *   **Exemplo de Uso:** …    texto na linha seguinte
 *   **Termos relacionados:** a, b    *   **Termos Relacionados:** a, b
 *
 * Títulos de nível 2 a 4 abrem um termo. Um bloco só vira termo se tiver
 * definição ou exemplo — por isso a introdução ("Termos relevantes do nicho…")
 * é ignorada sem lista de exceções. Rótulos também em inglês (Definition /
 * Example / Related).
 */

export type GlossaryTerm = {
  term: string;
  definition: string;
  example: string;
  related: string[];
};

type Field = "definition" | "example" | "related";

const HEADING_RE = /^#{2,4}\s+(.+?)\s*$/;

// [marcadores de lista/citação] **Rótulo** [:] valor — o ":" pode estar dentro ou fora do negrito.
const FIELD_RE =
  /^[\s>*\-•]*\**\s*(defini[çc][aã]o|definition|exemplo(?:\s+(?:de\s+uso|na\s+entrevista))?|example|termos?\s+relacionados?|related(?:\s+terms)?)\s*:?\s*\**\s*:?\s*\**\s*(.*)$/i;

function fieldOf(label: string): Field {
  const l = label.toLowerCase();
  if (l.startsWith("defin")) return "definition";
  if (l.startsWith("exemplo") || l.startsWith("example")) return "example";
  return "related";
}

/** "**1. Nome:**" → "Nome". */
function cleanTitle(raw: string): string {
  return raw
    .replace(/[*_`]/g, "")
    .replace(/^\d+[.)]\s*/, "")
    .replace(/:\s*$/, "")
    .trim();
}

/** Tira marcadores de citação/ênfase nas pontas e aspas que envolvem o texto todo. */
function cleanText(raw: string): string {
  return raw
    .trim()
    .replace(/^[>\s*_]+|[*_\s]+$/g, "")
    .replace(/^["“]+|["”]+$/g, "")
    .trim();
}

export function parseGlossaryMarkdown(md: string): GlossaryTerm[] {
  if (!md) return [];

  type Draft = { term: string; text: Record<Field, string[]> };
  const drafts: Draft[] = [];
  let current: Draft | null = null;
  let field: Field | null = null;

  for (const line of md.split(/\r?\n/)) {
    const heading = HEADING_RE.exec(line);
    if (heading) {
      current = { term: cleanTitle(heading[1]), text: { definition: [], example: [], related: [] } };
      drafts.push(current);
      field = null;
      continue;
    }
    if (!current) continue;

    const match = FIELD_RE.exec(line);
    if (match) {
      field = fieldOf(match[1]);
      if (match[2].trim()) current.text[field].push(match[2]);
    } else if (line.trim() === "" || /^-{3,}$/.test(line.trim())) {
      field = null; // linha em branco ou "---" encerra o campo corrente
    } else if (field) {
      current.text[field].push(line); // continuação de um valor que ocupa várias linhas
    }
  }

  const terms: GlossaryTerm[] = [];
  for (const { term, text } of drafts) {
    const definition = cleanText(text.definition.join(" "));
    const example = cleanText(text.example.join(" "));
    if (!term || (!definition && !example)) continue;
    const related = text.related
      .join(" ")
      .split(/[,;]/)
      .map((s) => s.replace(/[*_]/g, "").replace(/\.$/, "").trim())
      .filter(Boolean);
    terms.push({ term, definition, example, related });
  }

  return terms.sort((a, b) => a.term.localeCompare(b.term, "pt-BR"));
}

// ── Helpers de UI ────────────────────────────────────────────────────────────

/** Marcas de acento combinadas (0x300–0x36F) deixadas por normalize("NFD"). Montada por código para não depender de caracteres invisíveis no fonte. */
const DIACRITICS = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, "g");

function stripAccents(text: string): string {
  return text.normalize("NFD").replace(DIACRITICS, "");
}

/**
 * Devolve a primeira letra normalizada (sem acento, maiúscula) — usada
 * pra agrupar termos em colunas A-Z.
 */
export function initialOf(term: string): string {
  if (!term) return "#";
  const first = term
    .normalize("NFD")
    .replace(DIACRITICS, "")
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
  const q = stripAccents(query.toLowerCase());
  const matches = (s: string) => stripAccents(s.toLowerCase()).includes(q);
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
