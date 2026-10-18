"""
Análise manual de nicho: o usuário escolhe explicitamente quais entrevistas
entram, e o modelo é fixo em Claude Sonnet 4.6.

Modelo:
    - Primário: anthropic/claude-sonnet-4.6 via OpenRouter (BYOK)
    - Fallback: claude-sonnet-4-6 via Anthropic direto (se a key existir)

Saída: data/niches/{nicho}/_insights/analise_{slug}.md (sobrescreve).

Não toca o pipeline principal.
"""
from pathlib import Path

from backend.core.config import settings
from backend.core.layout import NICHE_ANALYSIS_MODEL_ANTHROPIC, NICHE_ANALYSIS_MODEL_OPENROUTER
from backend.services import prompt_store
from backend.services.llm_client import call_with_model
from backend.storage.filesystem import (
    niche_analysis_path,
    save_markdown,
    structured_docs_for_selected,
)


def _build_user_content(niche: str, docs: list[tuple[str, str]]) -> str:
    sections = [f"## Entrevista: {name}\n\n{content}" for name, content in docs]
    return (
        f"# Nicho: {niche}\n\n"
        f"Entrevistas incluídas nesta análise: {len(docs)}\n\n"
        + "\n\n---\n\n".join(sections)
    )


def analyze_niche(niche: str, interview_slugs: list[str]) -> Path:
    """
    Roda a análise consolidada do nicho com base nas entrevistas selecionadas.

    Levanta:
        - ValueError se nada foi selecionado ou se nenhuma entrevista
          selecionada tem 03_entrevista_estruturada.md disponível.
        - RuntimeError se ambos provedores (OpenRouter e Anthropic) falharem.
    """
    if not interview_slugs:
        raise ValueError("Selecione ao menos uma entrevista para analisar.")

    docs = structured_docs_for_selected(niche, interview_slugs)
    if not docs:
        raise ValueError(
            "Nenhuma das entrevistas selecionadas tem o documento "
            "03_entrevista_estruturada.md gerado. Rode o pipeline antes."
        )

    system_prompt = prompt_store.load("niche_analysis")
    user_content = _build_user_content(niche, docs)
    metadata = {"niche": niche, "n_interviews": len(docs)}

    # (provider, modelo, chave configurada?) em ordem de preferência.
    attempts = [
        ("openrouter", NICHE_ANALYSIS_MODEL_OPENROUTER, settings.openrouter_api_key),
        ("anthropic", NICHE_ANALYSIS_MODEL_ANTHROPIC, settings.anthropic_api_key),
    ]
    errors: list[str] = []
    for provider, model, api_key in attempts:
        if not api_key:
            continue
        try:
            content = call_with_model(
                provider=provider,
                model=model,
                system_prompt=system_prompt,
                user_content=user_content,
                metadata=metadata,
            )
        except Exception as exc:  # noqa: BLE001 — tentamos o próximo provider
            errors.append(f"{provider} ({model}): {exc}")
            continue
        out = niche_analysis_path(niche)
        save_markdown(out, content)
        return out

    if not errors:
        raise RuntimeError(
            "Análise de nicho exige Claude Sonnet 4.6. Configure "
            "OPENROUTER_API_KEY (preferido) ou ANTHROPIC_API_KEY."
        )
    raise RuntimeError(
        "Falha ao chamar Claude Sonnet 4.6 em todos os provedores configurados.\n"
        + "\n".join(f"  - {e}" for e in errors)
    )
