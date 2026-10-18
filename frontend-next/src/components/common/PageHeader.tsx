import { Fragment } from "react";
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

export type Crumb = { label: string; href?: string };

const WIDTH = {
  narrow: "max-w-2xl",
  default: "max-w-5xl",
  wide: "max-w-7xl",
  full: "max-w-none",
} as const;

/**
 * Container padrão de página: largura máxima, centralizado, gutter responsivo.
 * Substitui os `max-w-*` soltos (e sem `mx-auto`) de cada página.
 */
export function PageContainer({
  size = "default",
  className,
  children,
}: {
  size?: keyof typeof WIDTH;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full px-4 py-6 sm:px-6 lg:px-8", WIDTH[size], className)}>
      {children}
    </div>
  );
}

/**
 * Cabeçalho de página: trilha de navegação, título (serifa), descrição e ações.
 * Cada página usa o seu — não há Header global.
 */
export function PageHeader({
  title,
  description,
  crumbs,
  actions,
  children,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  crumbs?: Crumb[];
  actions?: React.ReactNode;
  /** Linha extra abaixo do título (estatísticas, selos). */
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6 space-y-3", className)}>
      {crumbs && crumbs.length > 0 && (
        <Breadcrumb>
          <BreadcrumbList>
            {crumbs.map((c, i) => {
              const last = i === crumbs.length - 1;
              return (
                <Fragment key={`${c.label}-${i}`}>
                  <BreadcrumbItem>
                    {last || !c.href ? (
                      <BreadcrumbPage>{c.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink render={<Link href={c.href} />}>{c.label}</BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {!last && <BreadcrumbSeparator />}
                </Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      )}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 space-y-1">
          <h1 className="text-balance text-2xl font-semibold leading-tight sm:text-3xl">{title}</h1>
          {description && (
            <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

/** Rótulo de seção (caixa-alta pequena). Um só estilo no lugar das 6 variações de opacidade. */
export function SectionLabel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <h2
      className={cn(
        "font-sans text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </h2>
  );
}
