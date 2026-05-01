"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Toggle visual sun/moon. Controlado por next-themes.
 * Renderização "vazia" antes de mount evita flash de hidratação:
 * useTheme só sabe o tema real depois do efeito client-side.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const current = theme === "system" ? resolvedTheme : theme;
  const isDark = current === "dark";

  function toggle() {
    setTheme(isDark ? "light" : "dark");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
      title={isDark ? "Mudar para claro" : "Mudar para escuro"}
      className={cn(
        "relative inline-flex items-center justify-center h-9 w-9 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors",
        className,
      )}
    >
      {/* Antes do mount mostramos um ícone neutro p/ não vazar tema */}
      {!mounted ? (
        <Sun className="h-4 w-4 opacity-50" />
      ) : isDark ? (
        <Moon className="h-4 w-4" />
      ) : (
        <Sun className="h-4 w-4" />
      )}
    </button>
  );
}
