# Skill: crivo-ui-polish

## Objetivo
Ajustes visuais, de UX e de acessibilidade no frontend do Crivo Insights, dentro do sistema "Caderno de Campo".

## Quando usar
- Cores, espaçamento, tipografia, tema claro/escuro
- Responsividade e layout
- Print/PDF
- Componente de UI com comportamento inesperado (hover, foco, transição)
- Novo componente ou tela (para manter o sistema coerente)

---

## O sistema em uma tela

- **Claro por padrão**; escuro (grafite quente) é opção. Tema via `next-themes` (`storageKey: crivo:theme:v2`).
- **Papel + tinta:** `--background` off-white quente, `--foreground` grafite. **Verde-petróleo** (`--primary`) é a cor do
  "insight" e aparece pouco. **Âmbar** (`--highlight`) é o marca-texto: seleção de texto, citações, destaques.
- **Sem** gradiente, vidro (`backdrop-blur`), brilho, blobs animados ou modo "AI Glow". Cartão = `bg-card ring-1 ring-foreground/10`.
- **Tipografia:** Inter (UI), Source Serif 4 (`font-heading`, títulos `h1`/`h2` e citações), JetBrains Mono (código/IDs).
  Fontes vêm de `@fontsource-variable/*` (locais — nunca baixar fonte no build).
- **Raio** `--radius: 0.5rem`. **Texto mínimo** `text-2xs` (11 px).

## Regras obrigatórias

1. **Tokens, nunca valores soltos.** Cor sempre por classe de token (`bg-card`, `text-muted-foreground`, `bg-success-soft text-success-foreground`).
   Sem `emerald-*`/`amber-*`, hex, rgb, `text-[Npx]`. Cores novas entram em `globals.css` (`@theme inline {}` + `:root` + `.dark`), em **oklch**.
2. **Tons semânticos:** `success`, `warning`, `info`, `destructive` — cada um com `-soft` (fundo) e `-foreground` (texto).
   Status → rótulo/tom só em `lib/status.ts`; use `StatusBadge`.
3. **Estados de tela distintos:** `LoadingState` (esqueleto), `EmptyState` (ainda não existe / 404), `ErrorState` (falha real).
4. **Páginas:** `PageContainer` + `PageHeader` (trilha, título, ações). Sem `-m-6`, sem `calc(100vh - …)` acoplado a header.
5. **Sem `asChild` em Button.** Link com aparência de botão: `<Link className={buttonVariants({...})}>`.
6. **Markdown renderizado** usa `<MarkdownPreview>` (classe `.crivo-prose`, 72ch; `wide` remove a medida).
7. **Print:** `.no-print`, `.print-columns`, `@media print {}` — nunca `style={{ display: 'none' }}`. Rotas `/print/` renderizam sem Sidebar.
8. **Acessibilidade:** foco visível (`focus-visible:ring-2 ring-ring`), `aria-label` em botão só de ícone, `aria-current`/`aria-pressed`/
   `aria-expanded` onde cabe, alvo de toque ≥ 28 px, `prefers-reduced-motion` já é respeitado globalmente.
9. **Contraste WCAG AA:** texto normal 4.5:1, grande 3:1. Medido na QA: mínimo 5.83:1 (claro) e 6.51:1 (escuro).
10. **Componentes shadcn:** adicionar com `npx shadcn@4.5.0 add <nome>`, e **conferir imports e `package.json`** (ver CLAUDE.md, regra 9).
11. **Não alterar backend** por ajuste visual.

## Checklist ao mexer em UI

- [ ] Funciona em claro **e** escuro (alternar em Configurações → Aparência)
- [ ] 375 px sem rolagem horizontal; menu mobile (Sheet) intacto
- [ ] Nenhuma cor/tamanho fora dos tokens (`grep -rnE "emerald-|amber-|text-\[[0-9]+px\]" src`)
- [ ] Estados de loading/vazio/erro tratados
- [ ] Teclado: tab chega em tudo, foco visível
- [ ] `npm run lint && npx tsc --noEmit && npm run build`

## Verificação no navegador

Use o preview (`frontend` na porta 3000/3001 e `backend` na 8000) e navegue em dados existentes.
Telas autenticadas exigem sessão do Supabase: no navegador de teste dá para gravar um registro local falso em
`localStorage` (`sb-<ref>-auth-token`, expiração futura) — nunca credenciais reais, nunca código de bypass no produto.
Não dispare upload, transcrição nem análise de nicho só para testar (custa crédito de LLM).
