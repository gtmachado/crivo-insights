"""Prompts editáveis (backend/prompts/*.md) com backup e restauração do padrão."""
from datetime import datetime, timezone
from pathlib import Path

from backend.storage.filesystem import write_text_atomic

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"

# nome lógico → (arquivo, rótulo)
PROMPTS: dict[str, tuple[str, str]] = {
    "refine":         ("refine_prompt.md",    "Refinamento"),
    "structure":      ("structure_prompt.md", "Estruturação"),
    "glossary":       ("glossary_prompt.md",  "Glossário"),
    "niche_analysis": ("niche_analysis.md",   "Análise de Nicho"),
}


class UnknownPrompt(KeyError):
    """Nome de prompt fora de PROMPTS."""


class NoDefaultPrompt(RuntimeError):
    """Prompt nunca foi editado — já está no estado padrão."""


def _file(name: str) -> Path:
    if name not in PROMPTS:
        raise UnknownPrompt(name)
    return PROMPTS_DIR / PROMPTS[name][0]


def _default_file(name: str) -> Path:
    return PROMPTS_DIR / "_defaults" / PROMPTS[name][0]


def _backup(name: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S-%f")
    write_text_atomic(PROMPTS_DIR / "_backups" / f"{name}-{ts}.md", load(name))


def load(name: str) -> str:
    """Conteúdo atual do prompt. Relido do disco a cada chamada (edição vale na hora)."""
    return _file(name).read_text(encoding="utf-8")


def has_default(name: str) -> bool:
    _file(name)  # valida o nome
    return _default_file(name).exists()


def listing() -> list[dict]:
    return [
        {"name": name, "label": label, "filename": filename, "has_default": has_default(name)}
        for name, (filename, label) in PROMPTS.items()
    ]


def save(name: str, content: str) -> None:
    """Salva o prompt; captura o padrão na 1ª edição e faz backup do estado atual."""
    path = _file(name)
    default = _default_file(name)
    if not default.exists():
        write_text_atomic(default, load(name))
    _backup(name)
    write_text_atomic(path, content)


def restore(name: str) -> None:
    """Volta ao padrão capturado na primeira edição (guardando backup do atual)."""
    path = _file(name)
    default = _default_file(name)
    if not default.exists():
        raise NoDefaultPrompt(name)
    _backup(name)
    write_text_atomic(path, default.read_text(encoding="utf-8"))
