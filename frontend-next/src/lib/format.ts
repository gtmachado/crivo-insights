/** Data curta em pt-BR (ex.: 17 out. 2026). Aceita ISO; devolve null se inválida/ausente. */
export function formatDate(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Separa o frontmatter (`---\nchave: valor\n---`) que o pipeline grava no topo
 * dos documentos. Devolve os pares e o corpo restante.
 */
export function splitFrontmatter(markdown: string): { meta: [string, string][]; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(markdown);
  if (!match) return { meta: [], body: markdown };
  const meta = match[1]
    .split(/\r?\n/)
    .map((line): [string, string] | null => {
      const i = line.indexOf(":");
      return i > 0 ? [line.slice(0, i).trim(), line.slice(i + 1).trim()] : null;
    })
    .filter((pair): pair is [string, string] => pair !== null);
  return { meta, body: markdown.slice(match[0].length) };
}
