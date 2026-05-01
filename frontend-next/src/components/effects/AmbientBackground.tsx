/**
 * Fundo ambiente com 3 "blobs" gaussianos que flutuam lentamente.
 * - 100% CSS, sem JS de animação (usa keyframes definidos em globals.css)
 * - z-index: 0 com pointer-events:none → não interfere em cliques
 * - Respeita prefers-reduced-motion (regra global em globals.css pausa as anims)
 *
 * Use UMA única instância no nível do (app) layout, atrás do conteúdo.
 */
export function AmbientBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* Blob 1 — primary, topo-esquerdo */}
      <div
        className="ambient-blob ambient-blob-a"
        style={{ top: "-12%", left: "-8%", width: "55vw", height: "55vw" }}
      />
      {/* Blob 2 — accent (roxo), centro-direita */}
      <div
        className="ambient-blob ambient-blob-b"
        style={{ top: "20%", right: "-12%", width: "60vw", height: "60vw" }}
      />
      {/* Blob 3 — azul claro, base */}
      <div
        className="ambient-blob ambient-blob-c"
        style={{ bottom: "-20%", left: "20%", width: "50vw", height: "50vw" }}
      />

      {/* Camada de "vinheta" sutil pra não saturar nas bordas */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 30%, var(--background) 100%)",
        }}
      />
    </div>
  );
}
