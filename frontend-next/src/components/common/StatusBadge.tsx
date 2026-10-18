import { AlertCircle, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TONE, type Tone } from "@/lib/status";

const ICON: Record<Tone, React.ElementType> = {
  neutral: Circle,
  info:    Loader2,
  success: CheckCircle2,
  warning: AlertCircle,
  danger:  AlertCircle,
};

/** Ícone do tom (o de "info"/em andamento gira). */
export function StatusIcon({ tone, className }: { tone: Tone; className?: string }) {
  const Icon = ICON[tone];
  return <Icon aria-hidden className={cn("size-3.5", tone === "info" && "animate-spin", className)} />;
}

/** Selo de status: ícone + rótulo, cor pelo tom semântico. */
export function StatusBadge({
  tone,
  label,
  className,
}: {
  tone: Tone;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-full px-2 text-2xs font-medium whitespace-nowrap",
        TONE[tone].soft,
        className,
      )}
    >
      <StatusIcon tone={tone} className="size-3" />
      {label}
    </span>
  );
}
