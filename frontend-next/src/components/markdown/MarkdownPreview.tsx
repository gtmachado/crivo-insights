"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { splitFrontmatter } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Renderiza markdown (GFM + realce de código) com a tipografia de leitura
 * `.crivo-prose`. O frontmatter que o pipeline grava no topo dos documentos
 * vira uma linha de metadados discreta em vez de aparecer como texto solto.
 *
 * `wide` remove a medida de ~72 caracteres (útil para tabelas largas).
 */
export function MarkdownPreview({
  content,
  className,
  wide = false,
}: {
  content: string;
  className?: string;
  wide?: boolean;
}) {
  const { meta, body } = splitFrontmatter(content);
  return (
    <div className={cn("crivo-prose", wide && "crivo-prose--wide", className)}>
      {meta.length > 0 && (
        <dl className="mb-6 flex flex-wrap gap-x-5 gap-y-1 border-b border-border pb-3 text-xs">
          {meta.map(([key, value]) => (
            <div key={key} className="flex gap-1.5">
              <dt className="text-muted-foreground">{key}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {body}
      </ReactMarkdown>
    </div>
  );
}
