import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { NicheOverview } from "@/hooks/useNicheOverview";
import { Skeleton } from "@/components/ui/skeleton";

/** Cartão de um nicho na página inicial: nome em serifa e a contagem de entrevistas. */
export function NicheCard({ niche }: { niche: NicheOverview }) {
  const { name, interviews } = niche;
  const structured = interviews?.filter((i) => i.stages.structured).length;

  return (
    <Link
      href={`/nicho/${encodeURIComponent(name)}`}
      className="group flex flex-col justify-between gap-6 rounded-xl bg-card p-4 ring-1 ring-foreground/10 outline-none transition-shadow hover:ring-foreground/25 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-heading text-lg font-semibold leading-tight">{name}</h3>
        <ArrowRight
          className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
          aria-hidden
        />
      </div>
      {interviews === undefined ? (
        <Skeleton className="h-4 w-32" />
      ) : (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium tabular-nums text-foreground">{interviews.length}</span>{" "}
          {interviews.length === 1 ? "entrevista" : "entrevistas"}
          {" · "}
          <span className="tabular-nums">{structured}</span> {structured === 1 ? "estruturada" : "estruturadas"}
        </p>
      )}
    </Link>
  );
}
