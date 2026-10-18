"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { LayoutDashboard, LogOut, Menu, Plus, Settings, type LucideIcon } from "lucide-react";
import { getInterviews, getNiches } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useSystemStatus } from "@/hooks/useSystemStatus";
import { Logo } from "@/components/common/Logo";
import { SectionLabel } from "@/components/common/PageHeader";
import { ThemeSwitch } from "@/components/theme/ThemeSwitch";
import { Button, buttonVariants } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

function NavLink({
  href,
  icon: Icon,
  active,
  onNavigate,
  children,
  trailing,
}: {
  href: string;
  icon?: LucideIcon;
  active: boolean;
  onNavigate?: () => void;
  children: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-8 items-center gap-2 rounded-md px-2.5 text-sm text-sidebar-foreground/80 transition-colors outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
      )}
    >
      {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing}
    </Link>
  );
}

function ApiStatus({ onNavigate }: { onNavigate?: () => void }) {
  const { data, isLoading } = useSystemStatus();
  const online = !!data;
  const label = isLoading ? "Verificando API…" : online ? "API conectada" : "API offline";
  return (
    <Link
      href="/settings"
      onClick={onNavigate}
      title={online ? "Backend conectado" : "Backend offline — clique para configurar"}
      className="flex items-center gap-2 rounded-md px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      <span
        aria-hidden
        className={cn("size-2 rounded-full", isLoading ? "bg-muted-foreground/40" : online ? "bg-success" : "bg-destructive")}
      />
      {label}
    </Link>
  );
}

/** Conteúdo da navegação lateral — usado na sidebar fixa (desktop) e no Sheet (mobile). */
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: niches = [], isLoading } = useQuery({ queryKey: qk.niches, queryFn: getNiches });
  const counts = useQueries({
    queries: niches.map((niche) => ({
      queryKey: qk.interviews(niche),
      queryFn: () => getInterviews(niche),
      staleTime: 30_000,
    })),
  });

  async function handleLogout() {
    await supabase.auth.signOut();
    toast.success("Até logo!");
    router.replace("/login");
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-14 shrink-0 items-center px-4">
        <Link href="/dashboard" onClick={onNavigate} aria-label="Crivo — início" className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
          <Logo />
        </Link>
      </div>

      <div className="px-3 pb-2">
        <Link href="/upload" onClick={onNavigate} className={cn(buttonVariants({ size: "lg" }), "w-full gap-1.5")}>
          <Plus className="size-4" aria-hidden />
          Nova entrevista
        </Link>
      </div>

      <nav aria-label="Principal" className="space-y-0.5 px-3 py-2">
        <NavLink href="/dashboard" icon={LayoutDashboard} active={pathname === "/dashboard"} onNavigate={onNavigate}>
          Início
        </NavLink>
      </nav>

      <div className="flex min-h-0 flex-1 flex-col px-3 pt-3">
        <SectionLabel className="px-2.5 pb-1.5">Nichos</SectionLabel>
        <ScrollArea className="min-h-0 flex-1">
          <nav aria-label="Nichos" className="space-y-0.5 pb-2">
            {isLoading && (
              <div className="space-y-2 px-2.5 pt-1">
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-3/5" />
              </div>
            )}
            {!isLoading && niches.length === 0 && (
              <p className="px-2.5 py-1 text-xs text-muted-foreground">
                Nenhum nicho ainda. Envie a primeira entrevista.
              </p>
            )}
            {niches.map((niche, i) => {
              const href = `/nicho/${encodeURIComponent(niche)}`;
              const count = counts[i]?.data?.length;
              return (
                <NavLink
                  key={niche}
                  href={href}
                  active={pathname === href || pathname.startsWith(`${href}/`)}
                  onNavigate={onNavigate}
                  trailing={
                    count !== undefined && (
                      <span className="text-2xs tabular-nums text-muted-foreground">{count}</span>
                    )
                  }
                >
                  {niche}
                </NavLink>
              );
            })}
          </nav>
        </ScrollArea>
      </div>

      <div className="shrink-0 space-y-1 border-t border-sidebar-border p-3">
        <NavLink href="/settings" icon={Settings} active={pathname === "/settings"} onNavigate={onNavigate}>
          Configurações
        </NavLink>
        <ApiStatus onNavigate={onNavigate} />
        <div className="flex items-center justify-between gap-2 pt-1">
          <ThemeSwitch />
          <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1.5 text-muted-foreground">
            <LogOut className="size-4" aria-hidden />
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Sidebar fixa — só aparece a partir de `lg`. */
export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:block">
      <SidebarContent />
    </aside>
  );
}

/** Barra superior mobile (< `lg`): marca + botão que abre a navegação em um Sheet. */
export function MobileBar() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background px-3 lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Abrir menu" />}>
          <Menu className="size-5" aria-hidden />
        </SheetTrigger>
        <SheetContent side="left" className="w-72 bg-sidebar p-0 text-sidebar-foreground">
          <SheetTitle className="sr-only">Navegação</SheetTitle>
          <SheetDescription className="sr-only">Nichos e configurações do Crivo Insights</SheetDescription>
          <SidebarContent onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <Link href="/dashboard" aria-label="Crivo — início">
        <Logo />
      </Link>
    </div>
  );
}
