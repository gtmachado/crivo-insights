"use client";

import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from "next-themes";

/**
 * Wrapper do `next-themes` com os defaults do projeto:
 *  - attribute="class" → o toggle adiciona/remove `.dark` em <html>
 *  - defaultTheme="light" → o produto abre claro; escuro é opção em Configurações
 *  - enableSystem → "Sistema" segue a preferência do SO quando escolhido
 *  - storageKey versionada: quem já tinha o antigo padrão escuro volta ao claro
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
      storageKey="crivo:theme:v2"
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
