"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { cn } from "@/lib/utils";

/**
 * Renderiza markdown via react-markdown com:
 *  - GFM (tabelas, checklists, strikethrough)
 *  - syntax highlighting via rehype-highlight (estilo importado em globals.css)
 *
 * O conteúdo nasce dos prompts de LLM e dos editores. Sempre passar o
 * markdown bruto — frontmatter no estilo `---\nkey: value\n---` é exibido
 * como tabela/texto pelo highlight (ok) e os pipelines do backend já o
 * incluem como header das transcrições.
 *
 * Stack:
 *  - className `crivo-prose` (definida em globals.css) para os estilos
 *  - container já mantém scroll do parent, este componente só renderiza
 */
export function MarkdownPreview({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div className={cn("crivo-prose", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
