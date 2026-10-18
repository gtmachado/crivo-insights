import { useQuery } from "@tanstack/react-query";
import { getAllJobs, type Job } from "@/lib/api";
import { qk } from "@/lib/query-keys";

const ACTIVE_MS = 3_000;
const IDLE_MS = 30_000;

/**
 * Jobs de entrevista em memória no backend. Polling adaptativo: 3 s enquanto
 * algum job roda, 30 s quando tudo está parado. Antes essa lógica estava
 * duplicada no dashboard e na página da entrevista.
 */
export function useJobs() {
  return useQuery({
    queryKey: qk.jobs,
    queryFn: getAllJobs,
    refetchInterval: (q) => (q.state.data?.some((j) => j.status === "running") ? ACTIVE_MS : IDLE_MS),
  });
}

/** Running primeiro; depois do mais recente para o mais antigo. */
export function sortJobs(jobs: Job[]): Job[] {
  return [...jobs].sort((a, b) => {
    if (a.status === "running" && b.status !== "running") return -1;
    if (b.status === "running" && a.status !== "running") return 1;
    return b.started_at - a.started_at;
  });
}
