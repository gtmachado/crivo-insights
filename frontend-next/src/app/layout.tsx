import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/lib/providers";

export const metadata: Metadata = {
  title: "Crivo Insights",
  description: "Discovery e extração de insights de entrevistas de negócio",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning é necessário porque next-themes injeta a classe
    // (.dark / .light) antes do React hidratar — sem isso, o React reclamaria
    // de mismatch SSR vs cliente. A classe vem do <ThemeProvider> via script.
    <html lang="pt-BR" suppressHydrationWarning className="h-full">
      <body className="h-full bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
