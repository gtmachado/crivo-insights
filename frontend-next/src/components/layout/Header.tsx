"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getSystemStatus } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { LogOut, Mic2, Settings, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";

function ApiStatusPill() {
  const { isError, isLoading, data } = useQuery({
    queryKey: ["system-status-pill"],
    queryFn: getSystemStatus,
    retry: false,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const ok = !!data && !isError;
  return (
    <Link
      href="/settings"
      className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${
        isLoading
          ? "border-border text-muted-foreground"
          : ok
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
            : "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
      }`}
      title={ok ? "Backend conectado" : "Backend offline — clique para configurar"}
    >
      {ok ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
      {isLoading ? "checando…" : ok ? "online" : "offline"}
    </Link>
  );
}

export function Header() {
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    toast.success("Até logo!");
    router.push("/login");
  }

  return (
    <header className="h-14 glass flex items-center justify-between px-6 shrink-0 z-10">
      <Link href="/dashboard" className="flex items-center gap-2 group">
        <span className="relative inline-flex h-7 w-7 items-center justify-center rounded-md gradient-bg text-white glow-soft">
          <Mic2 className="h-4 w-4" />
        </span>
        <span className="font-semibold text-sm gradient-text">Crivo Insights</span>
      </Link>

      <div className="flex items-center gap-1.5">
        <ApiStatusPill />
        <ThemeToggle />
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 h-9 px-3 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">Config</span>
        </Link>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2 text-muted-foreground">
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </header>
  );
}
