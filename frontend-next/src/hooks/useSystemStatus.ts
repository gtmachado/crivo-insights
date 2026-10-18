import { useQuery } from "@tanstack/react-query";
import { getSystemStatus } from "@/lib/api";
import { qk } from "@/lib/query-keys";

/**
 * Status do backend (`/status`). Uma chave só (`qk.systemStatus`) para todo o
 * app: sidebar, dashboard e configurações compartilham a mesma requisição.
 */
export function useSystemStatus({ refetchInterval = 15_000 }: { refetchInterval?: number | false } = {}) {
  return useQuery({
    queryKey: qk.systemStatus,
    queryFn: getSystemStatus,
    retry: false,
    staleTime: 10_000,
    refetchInterval,
  });
}
