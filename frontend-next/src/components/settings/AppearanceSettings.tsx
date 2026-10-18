"use client";

import { ThemeSwitch } from "@/components/theme/ThemeSwitch";

export function AppearanceSettings() {
  return (
    <div className="space-y-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div>
        <p className="font-medium">Tema</p>
        <p className="text-sm text-muted-foreground">
          O Crivo abre no tema claro. O tema escuro usa grafite quente, pensado para leitura prolongada à noite.
          &ldquo;Sistema&rdquo; acompanha a preferência do seu dispositivo.
        </p>
      </div>
      <ThemeSwitch labeled />
    </div>
  );
}
