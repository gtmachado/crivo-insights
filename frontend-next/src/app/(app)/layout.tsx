"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { AmbientBackground } from "@/components/effects/AmbientBackground";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);

  /**
   * Rotas /.../print/... renderizam SEM Sidebar/Header/AmbientBackground —
   * é a versão "limpa" para imprimir ou exportar como PDF (Fase 3).
   * Auth continua sendo aplicada — o user precisa estar logado pra acessar.
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
      <div className="relative min-h-screen flex items-center justify-center">
        {!isPrintRoute && <AmbientBackground />}
        <div className="text-muted-foreground text-sm">Verificando sessão...</div>
      </div>
    );
  }

  // Modo print: sem chrome, sem ambient bg, sem padding (a página assume
  // layout próprio em fundo branco).
  if (isPrintRoute) {
    return <div className="min-h-screen">{children}</div>;
  }

  return (
    <div className="relative flex h-screen overflow-hidden">
      <AmbientBackground />
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
