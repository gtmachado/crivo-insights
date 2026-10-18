# Crivo Insights — frontend

Next.js 16 (App Router) + React 19 + Tailwind CSS v4 + shadcn/ui sobre `@base-ui/react`. Todas as páginas são
Client Components que falam com o backend FastAPI via `src/lib/api.ts`.

> Esta versão do Next tem mudanças incompatíveis. Antes de escrever código de framework, leia o guia
> relevante em `node_modules/next/dist/docs/` (ver `AGENTS.md`).

## Rodar

```bash
cp .env.example .env.local   # NEXT_PUBLIC_API_URL, NEXT_PUBLIC_API_SECRET, NEXT_PUBLIC_SUPABASE_*
npm install
npm run dev                  # http://localhost:3000
```

## Validar

```bash
npm run lint && npx tsc --noEmit && npm run build   # tudo com 0 problemas
```

## Estrutura

```
src/
├── app/
│   ├── globals.css            tokens "Caderno de Campo" (@theme inline + :root/.dark), prose, impressão
│   ├── layout.tsx             fontes locais (fontsource), Providers
│   ├── icon.svg               favicon
│   ├── (auth)/login
│   └── (app)/                 layout com Sidebar; /print/ renderiza sem chrome
│       ├── dashboard  upload  settings
│       └── nicho/[nicho]/[entrevista]/{,glossario/print}
├── components/
│   ├── ui/                    shadcn (base-ui) — não usar `asChild`
│   ├── common/                PageHeader, States, StatusBadge, Logo
│   ├── layout/Sidebar         navegação (Sheet no mobile)
│   ├── interview/ niche/ dashboard/ pipeline/ glossary/ settings/ ...
├── hooks/                     useJobs, useNicheOverview, useAnalyzeNiche, useSystemStatus, useMounted
└── lib/
    ├── api.ts                 axios, ApiError, todos os endpoints e tipos
    ├── query-keys.ts          uma chave de cache por recurso
    ├── status.ts              status → rótulo e tom (única fonte)
    └── pipeline.ts files.ts glossary.ts format.ts
```

## Convenções

- **Cores só por token** (`bg-card`, `text-muted-foreground`, `bg-success-soft`…). Nada de `emerald-*`, hex ou rgb.
- **Tamanhos de texto:** escala do Tailwind + `text-2xs`; sem `text-[Npx]`.
- **Dados:** React Query com as chaves de `qk`; erros chegam como `ApiError` (já com a mensagem do backend).
- **Estados de tela:** `LoadingState`, `EmptyState` ("ainda não existe", 404) e `ErrorState` (falha real) — são distintos.
- **Estado na URL** quando faz parte da navegação (ex.: `?doc=` na entrevista).
- **Ao adicionar componente com a CLI do shadcn**, confira os imports e o `package.json` depois (a 4.5.0 já reescreveu
  imports para um pacote `cn` do npm; o correto é `@/lib/utils`).
