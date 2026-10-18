"use client";

import Link from "next/link";
import type { Interview } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StageChips } from "./StageChips";

/**
 * Entrevistas do nicho. Só as que já têm o documento estruturado podem ser
 * marcadas — é o que a análise de nicho consome.
 */
export function InterviewTable({
  niche,
  interviews,
  selected,
  onToggle,
  onToggleAll,
}: {
  niche: string;
  interviews: Interview[];
  selected: Set<string>;
  onToggle: (name: string) => void;
  onToggleAll: () => void;
}) {
  const eligible = interviews.filter((i) => i.stages.structured);
  const allSelected = eligible.length > 0 && eligible.every((i) => selected.has(i.name));
  const someSelected = !allSelected && eligible.some((i) => selected.has(i.name));

  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10 pl-4">
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected}
                disabled={eligible.length === 0}
                onCheckedChange={onToggleAll}
                aria-label="Selecionar todas as entrevistas elegíveis"
              />
            </TableHead>
            <TableHead>Entrevista</TableHead>
            <TableHead className="hidden md:table-cell">Documentos</TableHead>
            <TableHead className="hidden w-36 text-right sm:table-cell">Criada em</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {interviews.map((iv) => {
            const href = `/nicho/${encodeURIComponent(niche)}/${encodeURIComponent(iv.name)}`;
            const canSelect = iv.stages.structured;
            const checked = selected.has(iv.name);
            const heading = iv.title || iv.name;
            return (
              <TableRow key={iv.name} data-state={checked ? "selected" : undefined} className={cn(checked && "bg-accent/60")}>
                <TableCell className="pl-4">
                  <Checkbox
                    checked={checked}
                    disabled={!canSelect}
                    onCheckedChange={() => onToggle(iv.name)}
                    aria-label={`Incluir ${heading} na análise`}
                    title={canSelect ? undefined : "Gere o documento estruturado para incluir na análise"}
                  />
                </TableCell>
                <TableCell className="min-w-0 whitespace-normal">
                  <Link
                    href={href}
                    className="rounded font-medium outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {heading}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {[iv.interviewee_name, iv.title ? iv.name : null].filter(Boolean).join(" · ") || " "}
                  </p>
                  <StageChips stages={iv.stages} className="mt-1.5 md:hidden" />
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <StageChips stages={iv.stages} />
                </TableCell>
                <TableCell className="hidden text-right text-xs text-muted-foreground sm:table-cell">
                  {formatDate(iv.created_at) ?? "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
