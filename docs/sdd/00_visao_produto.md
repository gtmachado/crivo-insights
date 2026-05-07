# SDD-00 — Visão e Propósito do Produto

> Software Design Document — Crivo Insights
> Última atualização: 2026-05-03

---

## O que é

**Crivo Insights** é uma plataforma interna para descoberta de mercado via entrevistas qualitativas.

Ela permite que um pesquisador:
1. Faça upload de gravações de entrevistas (áudio ou vídeo)
2. Obtenha automaticamente transcrição, refinamento e estruturação da conversa
3. Extraia glossário técnico de termos relevantes ao nicho
4. Gere análises comparativas entre múltiplas entrevistas de um mesmo nicho

---

## Público-alvo

Uso interno. Pesquisador único (ou pequena equipe) que conduz entrevistas qualitativas com potenciais clientes, usuários ou especialistas de mercado.

---

## Proposta de valor

| Problema | Solução no produto |
|---|---|
| Transcrição manual é lenta e cara | Whisper local: sem custo por minuto, roda offline |
| Transcrição bruta é difícil de ler | Refine com LLM: separa falas, corrige erros contextuais |
| Estruturar entrevista é repetitivo | Structure com LLM: extrai temas, dores, citações |
| Glossário manual é esquecido | Glossary com LLM: extrai termos automaticamente |
| Comparar entrevistas é lento | Análise de nicho: LLM lê todas as estruturadas de uma vez |

---

## O que o produto não é

- Não é uma plataforma de pesquisa quantitativa
- Não é um CRM ou ferramenta de vendas
- Não tem usuários múltiplos (sem autenticação por conta)
- Não armazena dados na nuvem (tudo local em `data/niches/`)
- Não usa banco de dados (filesystem como storage)

---

## Status atual

Fases 0–4 concluídas. GSD-001 a GSD-006 concluídos. GSD-007 e GSD-008 pendentes.
Fase 5 (features novas) pausada até encerrar GSD-001–008.

Ver estado detalhado em `docs/gsd/00_estado_atual.md`.
