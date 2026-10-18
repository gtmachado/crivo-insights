import { cn } from "@/lib/utils";

/**
 * Marca do Crivo: uma peneira. Os pontos grandes são o que fica retido
 * (o insight); os pequenos, o que passa pela malha.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7 shrink-0", className)}>
      <rect width="32" height="32" rx="8" className="fill-primary" />
      {/* retidos */}
      <circle cx="16" cy="9"  r="2.9" className="fill-primary-foreground" />
      <circle cx="9"  cy="16" r="2.9" className="fill-primary-foreground" />
      <circle cx="23" cy="23" r="2.9" className="fill-primary-foreground" />
      {/* passam */}
      <g className="fill-primary-foreground" opacity="0.5">
        <circle cx="23" cy="9"  r="1.3" />
        <circle cx="9"  cy="9"  r="1.3" />
        <circle cx="16" cy="16" r="1.3" />
        <circle cx="23" cy="16" r="1.3" />
        <circle cx="9"  cy="23" r="1.3" />
        <circle cx="16" cy="23" r="1.3" />
      </g>
    </svg>
  );
}

/** Marca + nome. `compact` mostra só a marca (sidebar recolhida, mobile). */
export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {!compact && (
        <span className="font-heading text-lg font-semibold leading-none tracking-tight">
          Crivo
        </span>
      )}
    </span>
  );
}
