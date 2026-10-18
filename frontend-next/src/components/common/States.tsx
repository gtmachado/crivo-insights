import { AlertCircle, type LucideIcon, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Bloco centralizado base dos três estados abaixo. */
function Centered({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-14 text-center", className)}>
      {children}
    </div>
  );
}

/** "Ainda não existe" — nada a mostrar, com um próximo passo opcional. */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <Centered className={className}>
      <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" aria-hidden />
      </div>
      <p className="font-medium">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </Centered>
  );
}

/**
 * Falha de verdade (backend fora do ar, 500…). Antes, erro e "ainda não gerado"
 * caíam no mesmo `isError || !data` e um backend desligado parecia "vazio".
 */
export function ErrorState({
  title = "Não foi possível carregar",
  error,
  onRetry,
  className,
}: {
  title?: string;
  error?: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const detail = error instanceof Error ? error.message : undefined;
  return (
    <Centered className={className}>
      <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-destructive-soft text-destructive-foreground">
        <AlertCircle className="size-5" aria-hidden />
      </div>
      <p className="font-medium">{title}</p>
      {detail && <p className="max-w-md text-sm text-muted-foreground">{detail}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
          Tentar de novo
        </Button>
      )}
    </Centered>
  );
}

/** Esqueleto de lista/parágrafos enquanto carrega. */
export function LoadingState({ lines = 4, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-3 p-1", className)} role="status" aria-label="Carregando">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-4", i % 3 === 2 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}
