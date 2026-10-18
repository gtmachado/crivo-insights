"""
Fonte única dos nomes de arquivo, tarefas LLM e modelos fixos.

O layout em disco de uma entrevista é:

    {entrevista}/raw/ processed/ parts/          ← mídia
    {entrevista}/outputs/01_…, 02_…, 03_….md      ← transcrições e estruturada
    {entrevista}/glossary/glossario_local.md
    {entrevista}/metadata.json

`core/pipeline.py` (intocável) escreve esses mesmos nomes por literal; os testes
garantem que os dois continuam alinhados.
"""

# doc lógico → (subpasta, nome do arquivo). A ordem é a da UI.
DOCS: dict[str, tuple[str, str]] = {
    "raw":        ("outputs", "01_transcricao_bruta.md"),
    "refined":    ("outputs", "02_transcricao_refinada.md"),
    "structured": ("outputs", "03_entrevista_estruturada.md"),
    "glossary":   ("glossary", "glossario_local.md"),
}

META_FILENAME = "metadata.json"

# Tarefas LLM configuráveis pela UI (a análise de nicho é sempre fixa).
LLM_TASKS: tuple[str, ...] = ("refine", "structure", "glossary")

# Modelo obrigatório da análise de nicho — não é configurável.
NICHE_ANALYSIS_MODEL_OPENROUTER = "anthropic/claude-sonnet-4.6"
NICHE_ANALYSIS_MODEL_ANTHROPIC = "claude-sonnet-4-6"
