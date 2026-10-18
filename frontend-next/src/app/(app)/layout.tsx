"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { MobileBar, Sidebar } from "@/components/layout/Sidebar";
import { LogoMark } from "@/components/common/Logo";
import { LoadingState } from "@/components/common/States";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);

  /**
   * Rotas /.../print/... renderizam SEM Sidebar — é a versão "limpa" para
   * imprimir ou exportar como PDF. A auth continua sendo aplicada.
   */
  const isPrintRoute = !!pathname && /\/print(?:$|\/)/.test(pathname);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/login");
      else setChecking(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/login");
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  if (checking) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6">
        <LogoMark className="size-10 animate-pulse" />
        <LoadingState lines={2} className="w-48" />
      </div>
    );
  }

  if (isPrintRoute) {
    return <div className="min-h-dvh">{children}</div>;
  }

  return (
    <TooltipProvider>
      <div className="flex h-dvh overflow-hidden bg-background">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileBar />
          <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
