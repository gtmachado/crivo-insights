# GSD-02 — Backlog de Features Futuras

> Fase 5 do produto. Iniciar somente após GSD-001 a GSD-008 concluídos.
> Itens sem prazo definido. Mencionar o ID (ex: "BL-002") para priorizar.

---

## BL-001 — Histórico de Análises de Nicho

**Descrição:** Manter versões anteriores das análises geradas. Atualmente cada nova análise sobrescreve a anterior.

**Impacto:** Alto — evita perda de trabalho valioso ao re-analisar com seleção diferente.

**Sketchup:**
- Backend: salvar análises com nome `analise_{slug}_{YYYY-MM-DD}.md`
- Backend: `GET /niches/{niche}/analyses` → lista ordenada por data
- Frontend: dropdown na aba "Análise" para selecionar versão
- Frontend: badge com data e entrevistas incluídas

**Dependência:** GSD-008 (limpeza da análise) deve estar concluído primeiro.

---

## BL-002 — Exportação PDF da Análise de Nicho

**Descrição:** Botão "Exportar PDF" na aba de Análise que gera PDF formatado, igual ao print do glossário.

**Impacto:** Médio — permite compartilhar análise com stakeholders sem acesso ao sistema.

**Abordagem:**
- Criar rota `/nicho/[nicho]/analysis/print/page.tsx`
- `(app)/layout.tsx` já detecta `/print/` → renderiza sem sidebar/header
- `window.print()` automático após 600ms (padrão do GlossaryPrintLayout)
- Conteúdo: título do nicho + data + entrevistas incluídas + análise em markdown

---

## BL-003 — Busca Global

**Descrição:** `Cmd/Ctrl+K` para pesquisar entrevistas, termos de glossário e conteúdo de documentos.

**Impacto:** Alto — melhora navegabilidade em nichos com muitas entrevistas.

**Abordagem simples:** busca client-side no nicho atual (sem backend).
**Abordagem completa:** `GET /search?q={query}` no backend, índice em memória.

---

## BL-004 — Analytics por Nicho

**Descrição:** Dashboard de métricas: entrevistas, cobertura de pipeline, termos frequentes, temas recorrentes.

**Impacto:** Médio — visibilidade do estado do nicho.

**Métricas:**
- Total de entrevistas / completas / incompletas
- Tempo médio de entrevista (via `metadata.json` — GSD-002 já implementado)
- Top 10 termos do glossário
- Data da última análise

---

## BL-005 — Geração de Proposta Comercial

**Descrição:** A partir da análise de nicho, gerar proposta comercial personalizada.

**Impacto:** Alto se o produto virar base para consultoria.

**Abordagem:**
- Novo prompt: `backend/prompts/commercial_proposal.md`
- Parâmetros: nome do cliente, produto/serviço, tom (formal/casual)
- Output: Markdown estruturado → visualizar + print/PDF
- Modelo: Sonnet 4.6 (mesma qualidade da análise de nicho)

---

## BL-006 — Multi-idioma

**Descrição:** Suporte a entrevistas em inglês ou espanhol com pipeline adaptado.

**Impacto:** Médio — depende do público-alvo.

**Abordagem:**
- Detectar idioma no upload (campo manual ou detecção automática via LLM)
- Selecionar prompt correto por idioma (`refine_en.md`, `structure_es.md`, etc.)

---

## BL-007 — Autenticação com Múltiplos Usuários

**Descrição:** Substituir `API_SECRET` compartilhado por sistema de usuários com login e permissões por nicho.

**Impacto:** Necessário para uso em equipes maiores.

**Abordagem:**
- Backend: SQLite via SQLAlchemy + JWT
- Frontend: tela de login, refresh token, contexto de usuário
- Permissões: admin / analyst / viewer
- **Dependência:** GSD-004 (configuração via UI) deve existir primeiro para não precisar de SSH para onboarding.

---

## BL-008 — Logo e Identidade Visual

**Descrição:** Criar logo oficial do Crivo Insights com variações para uso na plataforma e materiais externos.

**Impacto:** Baixo no produto, médio para percepção de marca.

**Nota:** O favicon está listado como "Extra" no GSD-01. Este BL trata da identidade visual completa (logo, paleta oficial, tipografia).
