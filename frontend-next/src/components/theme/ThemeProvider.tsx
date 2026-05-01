"use client";

import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from "next-themes";

/**
 * Wrapper do `next-themes` com defaults do projeto:
 *  - attribute="class"  → toggle adiciona/remove `.dark` em <html>
 *  - defaultTheme="dark" (combina com a estética AI-powered do produto)
 *  - enableSystem        → respeita preferência do SO se o user não escolheu
 *  - disableTransitionOnChange=false → mantemos transições suaves do CSS
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange={false}
      storageKey="crivo:theme"
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
