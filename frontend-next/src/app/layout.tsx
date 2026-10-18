import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/source-serif-4";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import { Providers } from "@/lib/providers";

export const metadata: Metadata = {
  title: { default: "Crivo Insights", template: "%s · Crivo Insights" },
  description: "Descoberta de mercado a partir de entrevistas qualitativas",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning é necessário porque next-themes injeta a classe
    // (.dark) antes do React hidratar — sem isso, o React reclamaria de
    // mismatch SSR vs cliente. A classe vem do <ThemeProvider> via script.
    <html lang="pt-BR" suppressHydrationWarning className="h-full">
      <body className="h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
