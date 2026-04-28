"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { LogOut, Mic2 } from "lucide-react";
import { toast } from "sonner";

export function Header() {
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    toast.success("Até logo!");
    router.push("/login");
  }

  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-2">
        <Mic2 className="h-5 w-5 text-primary" />
        <span className="font-semibold text-sm">Crivo Insights</span>
      </div>
      <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2 text-muted-foreground">
        <LogOut className="h-4 w-4" />
        Sair
      </Button>
    </header>
  );
}
