"use client";

import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";
import { useJobs, sortJobs } from "@/hooks/useJobs";
import { useNicheOverview } from "@/hooks/useNicheOverview";
import { useSystemStatus } from "@/hooks/useSystemStatus";
import { cn } from "@/lib/utils";
import { PageContainer, PageHeader, SectionLabel } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/States";
import { JobCard } from "@/components/dashboard/JobCard";
import { NicheCard } from "@/components/dashboard/NicheCard";
import { buttonVariants } from "@/components/ui/button";

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-3xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SystemInfo() {
  const { data } = useSystemStatus({ refetchInterval: false });
  if (!data) return null;
  const items: [string, string, boolean][] = [
    ["Provedor", data.llm_provider, false],
    ["Transcrição", `whisper-${data.whisper_model}`, true],
    ["Refino", data.models.refine ?? "—", true],
    ["Estruturação", data.models.structure ?? "—", true],
  ];
  return (
    <section aria-labelledby="sistema">
      <SectionLabel>
        <span id="sistema">Sistema</span>
      </SectionLabel>
      <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl bg-card p-4 text-sm ring-1 ring-foreground/10 sm:grid-cols-4">
        {items.map(([label, value, mono]) => (
          <div key={label} className="min-w-0">
            <dt className="text-2xs uppercase tracking-wider text-muted-foreground">{label}</dt>
            <dd className={cn("truncate", mono && "font-mono text-xs")} title={value}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default function DashboardPage() {
  const overview = useNicheOverview();
  const jobsQuery = useJobs();

  const jobs = sortJobs(jobsQuery.data ?? []);
  const running = jobs.filter((j) => j.status === "running");
  const recent = jobs.filter((j) => j.status !== "running");
  const interviewCount = overview.niches.reduce((sum, n) => sum + (n.interviews?.length ?? 0), 0);
  const countsReady = overview.niches.every((n) => n.interviews !== undefined);

  return (
    <PageContainer>
      <PageHeader
        title="Início"
        description="O que está acontecendo nos seus nichos e entrevistas."
        actions={
          <Link href="/upload" className={buttonVariants({ size: "lg" })}>
            <Plus aria-hidden /> Nova entrevista
          </Link>
        }
      />

      <div className="space-y-8">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label="Nichos" value={overview.isLoading ? "–" : overview.niches.length} />
          <Stat label="Entrevistas" value={countsReady && !overview.isLoading ? interviewCount : "–"} />
          <Stat
            label="Em processamento"
            value={jobsQuery.isLoading ? "–" : running.length}
            hint={running.length > 0 ? "Atualiza a cada 3 s" : undefined}
          />
        </div>

        {running.length > 0 && (
          <section aria-labelledby="processando" className="space-y-2">
            <SectionLabel>
              <span id="processando">Em processamento</span>
            </SectionLabel>
            <div className="grid gap-3 lg:grid-cols-2">
              {running.map((job) => (
                <JobCard key={job.job_id} job={job} />
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="nichos" className="space-y-2">
          <SectionLabel>
            <span id="nichos">Nichos</span>
          </SectionLabel>
          {overview.isLoading ? (
            <LoadingState lines={3} />
          ) : overview.isError ? (
            <ErrorState error={overview.error} onRetry={() => overview.refetch()} />
          ) : overview.niches.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="Nenhum nicho ainda"
              description="Envie a primeira entrevista para começar. O nicho é criado junto com ela."
              action={
                <Link href="/upload" className={buttonVariants()}>
                  Nova entrevista
                </Link>
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {overview.niches.map((n) => (
                <NicheCard key={n.name} niche={n} />
              ))}
            </div>
          )}
        </section>

        {jobsQuery.isError ? (
          <ErrorState title="Não foi possível carregar os jobs" error={jobsQuery.error} onRetry={() => jobsQuery.refetch()} />
        ) : (
          recent.length > 0 && (
            <section aria-labelledby="recentes" className="space-y-2">
              <SectionLabel>
                <span id="recentes">Atividade recente ({recent.length})</span>
              </SectionLabel>
              <div className="grid gap-3 lg:grid-cols-2">
                {recent.map((job) => (
                  <JobCard key={job.job_id} job={job} />
                ))}
              </div>
            </section>
          )
        )}

        <SystemInfo />
      </div>
    </PageContainer>
  );
}
