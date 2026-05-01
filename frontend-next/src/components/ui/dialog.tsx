"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Dialog mínimo, sem dependência adicional.
 * - Portal para document.body
 * - ESC fecha
 * - Click no overlay fecha
 * - Scroll lock no body enquanto aberto
 *
 * Não usa @base-ui/react/dialog para evitar acoplar a forma de uso a uma
 * versão específica da lib. Suficiente p/ confirmações e formulários simples.
 */
export function Dialog({
  open,
  onClose,
  children,
  className,
  hideClose = false,
  closeOnOverlay = true,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  hideClose?: boolean;
  closeOnOverlay?: boolean;
}) {
  const [mounted, setMounted] = useState(false);

  // só monta no cliente — createPortal precisa de document.body
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-md"
        onClick={() => closeOnOverlay && onClose()}
      />

      {/* Conteúdo */}
      <div
        className={cn(
          "relative glass-strong rounded-xl p-6 max-w-md w-full shadow-2xl glow-soft",
          className,
        )}
      >
        {!hideClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="absolute top-3 right-3 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
