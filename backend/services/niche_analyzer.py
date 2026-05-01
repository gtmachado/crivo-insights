"""
Análise manual de nicho (Fase 4) — diferente da consolidação automática
existente em `consolidator.py`. Aqui o usuário escolhe explicitamente
quais entrevistas entram, e o modelo é fixo em Claude Sonnet 4.6.

Modelo:
    - Primário: anthropic/claude-sonnet-4.6 via OpenRouter (BYOK)
    - Fallback: claude-sonnet-4-6 via Anthropic direto (se a key existir)

Saída: data/niches/{nicho}/_insights/analise_{slug}.md (sobrescreve).

Não toca o pipeline principal nem a consolidação antiga.
"""
from pathlib import Path

from backend.core.config import settings
from backend.services.llm_client import call_with_model
from backend.storage.filesystem import (
    structured_docs_for_selected,
    niche_analysis_path,
    save_markdown,
)

_PROMPTS_DIR = Path(__file__).parent.parent / "prompts"

# Modelo obrigatório, conforme requisito da Fase 4. Não é configurável.
SONNET_OPENROUTER = "anthropic/claude-sonnet-4.6"
SONNET_ANTHROPIC  = "claude-sonnet-4-6"


def _load_prompt() -> str:
    return (_PROMPTS_DIR / "niche_analysis.md").read_text(encoding="utf-8")


def _build_user_content(niche: str, docs: list[tuple[str, str]]) -> str:
    sections = [
        f"## Entrevista: {name}\n\n{content}"
        for name, content in docs
    ]
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
          selecionada tem 03_estruturada.md disponível.
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

    system_prompt = _load_prompt()
    user_content  = _build_user_content(niche, docs)
    metadata      = {"niche": niche, "n_interviews": len(docs)}

    errors: list[str] = []

    # 1) OpenRouter (primário)
    if settings.openrouter_api_key:
        try:
            content = call_with_model(
                provider="openrouter",
                model=SONNET_OPENROUTER,
                system_prompt=system_prompt,
                user_content=user_content,
                metadata=metadata,
            )
            return _save(niche, content)
        except Exception as exc:  # noqa: BLE001 — relançamos depois se 2 falharem
            errors.append(f"OpenRouter ({SONNET_OPENROUTER}): {exc}")

    # 2) Anthropic direto (fallback opcional)
    if settings.anthropic_api_key:
        try:
            content = call_with_model(
                provider="anthropic",
                model=SONNET_ANTHROPIC,
                system_prompt=system_prompt,
                user_content=user_content,
                metadata=metadata,
            )
            return _save(niche, content)
        except Exception as exc:  # noqa: BLE001
            errors.append(f"Anthropic ({SONNET_ANTHROPIC}): {exc}")

    # 3) Ambos indisponíveis
    if not errors:
        raise RuntimeError(
            "Análise de nicho exige Claude Sonnet 4.6. Configure "
            "OPENROUTER_API_KEY (preferido) ou ANTHROPIC_API_KEY."
        )
    raise RuntimeError(
        "Falha ao chamar Claude Sonnet 4.6 em todos os provedores configurados.\n"
        + "\n".join(f"  - {e}" for e in errors)
    )


def _save(niche: str, content: str) -> Path:
    out = niche_analysis_path(niche)
    save_markdown(out, content)
    return out
