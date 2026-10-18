"use client";

import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { useMounted } from "@/hooks/useMounted";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light",  label: "Claro",   icon: Sun },
  { value: "dark",   label: "Escuro",  icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
] as const;

/**
 * Seletor de tema (claro / escuro / sistema), controlado pelo next-themes.
 * `labeled` mostra o texto (Configurações); sem ele, só os ícones (sidebar).
 */
export function ThemeSwitch({ labeled = false, className }: { labeled?: boolean; className?: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const current = mounted ? theme ?? "light" : null;

  return (
    <div
      role="radiogroup"
      aria-label="Tema da interface"
      className={cn("inline-flex rounded-lg bg-muted p-0.5", className)}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = current === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              "inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
              active && "bg-background text-foreground shadow-sm",
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {labeled && <span>{label}</span>}
          </button>
        );
      })}
    </div>
  );
}
