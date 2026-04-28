"""Consolida múltiplas entrevistas de um nicho: insights e glossário."""
from pathlib import Path

from backend.services.llm_client import call
from backend.storage.filesystem import (
    structured_docs_for_niche,
    glossary_docs_for_niche,
    niche_insights_dir,
    niche_glossary_dir,
    save_markdown,
)

_PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def _load_prompt(filename: str) -> str:
    return (_PROMPTS_DIR / filename).read_text(encoding="utf-8")


def consolidate_insights(niche: str) -> Path:
    """
    Lê os 03_entrevista_estruturada.md de todas as entrevistas do nicho,
    consolida com LLM e salva em _insights/01_insights_consolidados.md.
    """
    docs = structured_docs_for_niche(niche)
    if not docs:
        raise ValueError(f"Nenhuma entrevista estruturada encontrada para o nicho '{niche}'.")

    system_prompt = _load_prompt("consolidate_prompt.md")
    sections = [f"## Entrevista: {name}\n\n{content}" for name, content in docs]
    user_content = f"Nicho: {niche}\n\n" + "\n\n---\n\n".join(sections)

    content = call(
        task="consolidate",
        system_prompt=system_prompt,
        user_content=user_content,
        metadata={"niche": niche, "n_interviews": len(docs)},
    )

    out_path = niche_insights_dir(niche) / "01_insights_consolidados.md"
    save_markdown(out_path, content)
    return out_path


def consolidate_glossary(niche: str) -> Path:
    """
    Lê os glossario_local.md de todas as entrevistas do nicho,
    consolida com LLM e salva em _glossary/glossario_nicho.md.
    """
    docs = glossary_docs_for_niche(niche)
    if not docs:
        raise ValueError(f"Nenhum glossário local encontrado para o nicho '{niche}'.")

    system_prompt = _load_prompt("consolidate_glossary_prompt.md")
    sections = [f"## Glossário: {name}\n\n{content}" for name, content in docs]
    user_content = f"Nicho: {niche}\n\n" + "\n\n---\n\n".join(sections)

    content = call(
        task="consolidate_glossary",
        system_prompt=system_prompt,
        user_content=user_content,
        metadata={"niche": niche, "n_glossaries": len(docs)},
    )

    out_path = niche_glossary_dir(niche) / "glossario_nicho.md"
    save_markdown(out_path, content)
    return out_path
