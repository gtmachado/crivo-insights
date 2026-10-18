import { Check } from "lucide-react";
import type { InterviewStages } from "@/lib/api";
import { cn } from "@/lib/utils";

const LABELS: Record<keyof InterviewStages, string> = {
  raw: "Bruta",
  refined: "Refinada",
  structured: "Estruturada",
  glossary: "Glossário",
};

/** Quais documentos da entrevista já existem: chip preenchido = gerado. */
export function StageChips({ stages, className }: { stages: InterviewStages; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-1", className)}>
      {(Object.keys(LABELS) as (keyof InterviewStages)[]).map((key) => {
        const done = stages[key];
        return (
          <li
            key={key}
            className={cn(
              "inline-flex h-5 items-center gap-1 rounded-full px-2 text-2xs font-medium",
              done ? "bg-success-soft text-success-foreground" : "bg-muted text-muted-foreground/70",
            )}
          >
            {done && <Check className="size-3" aria-hidden />}
            {LABELS[key]}
            <span className="sr-only">{done ? " (gerado)" : " (pendente)"}</span>
          </li>
        );
      })}
    </ul>
  );
}
