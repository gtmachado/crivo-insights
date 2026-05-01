# Skill: crivo-ui-polish

## Objetivo
Realizar ajustes visuais, de UX e de acessibilidade no frontend do Crivo Insights.

## Quando usar
- GSD-007: Corrigir light mode, contraste, fundo AI/glow, animação, modo simples
- Qualquer ajuste de cores, espaçamento, tipografia
- Responsividade e layout
- Print/PDF visual fix
- Componente de UI com comportamento inesperado (hover, focus, transição)

---

## Regras Obrigatórias

1. **Tailwind v4:** tokens e customizações em `globals.css` dentro de `@theme inline {}`. Nunca `tailwind.config.js`.
2. **Cores sempre em oklch** — nunca hex/rgb hardcoded.
3. **Sem `asChild` em Button.**
4. **`crivo-prose`:** todo markdown renderizado com react-markdown deve ter essa classe.
5. **Print:** usar `.no-print`, `.print-columns`, `@media print {}` — nunca `style={{ display: 'none' }}`.
6. **`npm run build` limpo** antes de concluir.
7. **Não alterar backend** por ajuste visual.

---

## GSD-007 — Checklist Detalhado

### 007a — Light mode com cores estranhas

**Sintomas:** fundo acinzentado/azulado no tema claro, texto com baixo contraste, glass quase invisível ou muito escuro.

**O que verificar em `globals.css`:**
```css
/* `:root` = tema claro */
:root {
  --background: oklch(0.97 0.005 265);   /* quase branco, leve toque azul */
  --foreground: oklch(0.10 0.015 265);   /* quase preto */
  --muted-foreground: oklch(0.45 0.02 265); /* cinza médio — deve ter contraste 4.5:1 */
  --border: oklch(0.85 0.01 265);        /* borda sutil */

  /* Glass no claro — mais transparente e clara */
  --glass-bg: oklch(0.97 0.005 265 / 0.80);
  --glass-border: oklch(0.70 0.05 265 / 0.40);

  /* Blobs menos visíveis no claro */
  --ambient-blob-a: oklch(0.60 0.18 265 / 0.08);
  --ambient-blob-b: oklch(0.58 0.20 295 / 0.06);
  --ambient-blob-c: oklch(0.62 0.16 240 / 0.05);
}
```

**Regra de contraste mínima (WCAG AA):**
- Texto normal: 4.5:1
- Texto grande (>18px bold): 3:1
- Testar com DevTools → "Inspect" → ver warning de contraste

---

### 007b — Contraste insuficiente no dark mode

**Verificar:**
```css
.dark {
  --background: oklch(0.10 0.015 265);
  --foreground: oklch(0.95 0.01 265);     /* quase branco */
  --muted-foreground: oklch(0.65 0.02 265); /* cinza claro */
  --card: oklch(0.14 0.015 265);
  --border: oklch(0.25 0.03 265);

  /* Glass no escuro — mais opaco */
  --glass-bg: oklch(0.14 0.02 265 / 0.70);
  --glass-border: oklch(0.35 0.08 265 / 0.35);

  /* Blobs mais visíveis no escuro */
  --ambient-blob-a: oklch(0.45 0.22 265 / 0.18);
  --ambient-blob-b: oklch(0.42 0.24 295 / 0.15);
  --ambient-blob-c: oklch(0.48 0.20 240 / 0.12);
}
```

---

### 007c — Fundo AI/glow muito concentrado no centro

**Sintoma:** blobs aparecem todos empilhados no centro; borda da tela sem glow.

**Arquivo:** `frontend-next/src/components/effects/AmbientBackground.tsx`

Cada blob deve ter `position` distinta para cobrir a tela:
```tsx
/* Blob A — canto superior esquerdo */
style={{ top: "-20%", left: "-10%", width: "60vw", height: "60vw" }}

/* Blob B — canto inferior direito */
style={{ bottom: "-20%", right: "-10%", width: "55vw", height: "55vw" }}

/* Blob C — centro ligeiramente deslocado */
style={{ top: "30%", left: "35%", width: "40vw", height: "40vw" }}
```

Ajustar as durações das animações em `globals.css` se imperceptíveis:
```css
@keyframes blob-drift-a { /* 35s ao invés de 22s */ }
@keyframes blob-drift-b { /* 42s ao invés de 26s */ }
@keyframes blob-drift-c { /* 50s ao invés de 30s */ }
```

---

### 007d — Modo simples (sem animações / fundo opaco)

**Objetivo:** toggle "Modo simples" que desativa blobs e usa fundo sólido.

**Persistência:** `localStorage` com chave `crivo:simple-mode` (valor `"1"` ou ausente).

**Implementação:**

1. `AmbientBackground.tsx` — verificar preferência:
```tsx
const [simple, setSimple] = useState(false);
useEffect(() => {
  setSimple(localStorage.getItem("crivo:simple-mode") === "1");
  // Também respeitar sistema operacional:
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (mq.matches) setSimple(true);
}, []);

if (simple) return null;
```

2. Toggle no `ThemeToggle.tsx` ou na tela `/settings`:
```tsx
function toggleSimpleMode() {
  const next = localStorage.getItem("crivo:simple-mode") !== "1";
  if (next) localStorage.setItem("crivo:simple-mode", "1");
  else localStorage.removeItem("crivo:simple-mode");
  window.location.reload(); // recarregar para re-montar AmbientBackground
}
```

---

### 007e — Opção "AI glow" vs "simples/opaco" nas configurações

**Na tela `/settings/page.tsx`** adicionar seção "Visual":

```tsx
<div className="flex flex-col gap-2">
  <label className="text-sm font-medium">Aparência do fundo</label>
  <select value={visual} onChange={e => setVisual(e.target.value)}>
    <option value="glow">AI Glow (padrão)</option>
    <option value="simple">Simples / sem animação</option>
  </select>
</div>
```

Salvar em `localStorage` com chave `crivo:visual-mode`.

---

## Referência de Tokens (completa)

```css
/* globals.css — @theme inline {} */

/* Primário (azul índigo) */
--primary:            oklch(0.55 0.22 265);
--primary-foreground: oklch(0.98 0.01 265);

/* Accent (violeta) */
--accent:             oklch(0.52 0.25 295);
--accent-foreground:  oklch(0.98 0.01 295);

/* Gradiente */
--gradient-from: var(--primary);
--gradient-via:  oklch(0.50 0.24 280);
--gradient-to:   var(--accent);

/* Glow */
--glow-primary: 0 0 24px oklch(0.55 0.22 265 / 0.45);
--glow-soft:    0 0 16px oklch(0.55 0.22 265 / 0.25);
```

## Classes Utilitárias

| Classe | Efeito |
|--------|--------|
| `.gradient-text` | `background-clip: text` com gradiente |
| `.gradient-bg` | Background gradiente (botões primários) |
| `.glass` | `backdrop-blur(14px)` + border sutil |
| `.glass-strong` | Glass opaco (modais, drawers) |
| `.glow-primary` | Box-shadow azul vibrante |
| `.glow-soft` | Box-shadow azul suave |
| `.crivo-prose` | Container react-markdown estilizado |
| `.no-print` | `display:none` em `@media print` |
| `.print-columns` | 2 colunas no print |

---

## Mapa de Arquivos

| Tipo de ajuste | Arquivo |
|----------------|---------|
| Tokens de cor, animação, utilitários | `src/app/globals.css` |
| Blobs de fundo, posição, toggle | `src/components/effects/AmbientBackground.tsx` |
| ThemeToggle, modo simples | `src/components/theme/ThemeToggle.tsx` |
| Layout geral, print routing | `src/app/(app)/layout.tsx` |
| Configurações visuais (settings) | `src/app/(app)/settings/page.tsx` |

---

## Relatório de Fim de Bloco Visual

Entregar:
1. **Tokens alterados** (lista com valor antigo → novo)
2. **Componentes alterados** (lista)
3. **Como verificar** (tema claro + escuro + mobile)
4. **Build limpo** confirmado
