import { useQueries, useQuery } from "@tanstack/react-query";
import { getInterviews, getNiches, type Interview } from "@/lib/api";
import { qk } from "@/lib/query-keys";

export type NicheOverview = {
  name: string;
  /** `undefined` enquanto a lista de entrevistas do nicho ainda carrega. */
  interviews: Interview[] | undefined;
};

/**
 * Nichos com suas entrevistas, compartilhando o cache das páginas
 * (`qk.niches`, `qk.interviews`): sidebar e dashboard não pedem em dobro.
 */
export function useNicheOverview() {
  const nichesQuery = useQuery({ queryKey: qk.niches, queryFn: getNiches });
  const niches = nichesQuery.data ?? [];
  const interviewQueries = useQueries({
    queries: niches.map((niche) => ({
      queryKey: qk.interviews(niche),
      queryFn: () => getInterviews(niche),
      staleTime: 30_000,
    })),
  });

  const overview: NicheOverview[] = niches.map((name, i) => ({
    name,
    interviews: interviewQueries[i]?.data,
  }));

  return {
    niches: overview,
    isLoading: nichesQuery.isLoading,
    isError: nichesQuery.isError,
    error: nichesQuery.error,
    refetch: nichesQuery.refetch,
  };
}
