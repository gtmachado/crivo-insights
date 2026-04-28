from pathlib import Path
import re

from backend.core.config import settings

# Dirs reservados no nível do nicho — não são entrevistas
_NICHE_RESERVED = {"_insights", "_glossary"}


def _slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text


def interview_dir(niche: str, interview_name: str) -> Path:
    """Cria e retorna a raiz da entrevista com todas as subpastas."""
    base = settings.data_dir / _slugify(niche) / _slugify(interview_name)
    for sub in ("raw", "processed", "parts", "outputs", "glossary"):
        (base / sub).mkdir(parents=True, exist_ok=True)
    return base


def niche_insights_dir(niche: str) -> Path:
    path = settings.data_dir / _slugify(niche) / "_insights"
    path.mkdir(parents=True, exist_ok=True)
    return path


def niche_glossary_dir(niche: str) -> Path:
    path = settings.data_dir / _slugify(niche) / "_glossary"
    path.mkdir(parents=True, exist_ok=True)
    return path


def list_niches() -> list[str]:
    base = settings.data_dir
    base.mkdir(parents=True, exist_ok=True)
    return [d.name for d in sorted(base.iterdir()) if d.is_dir()]


def list_interviews(niche: str) -> list[dict]:
    niche_dir = settings.data_dir / _slugify(niche)
    if not niche_dir.exists():
        return []
    result = []
    for d in sorted(niche_dir.iterdir()):
        if not d.is_dir() or d.name in _NICHE_RESERVED:
            continue
        stages = {
            "raw":        (d / "outputs" / "01_transcricao_bruta.md").exists(),
            "refined":    (d / "outputs" / "02_transcricao_refinada.md").exists(),
            "structured": (d / "outputs" / "03_entrevista_estruturada.md").exists(),
            "glossary":   (d / "glossary" / "glossario_local.md").exists(),
        }
        result.append({"name": d.name, "stages": stages})
    return result


def save_markdown(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def read_markdown(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def structured_docs_for_niche(niche: str) -> list[tuple[str, str]]:
    """(nome_entrevista, conteúdo) de todos os 03_entrevista_estruturada.md do nicho."""
    niche_dir = settings.data_dir / _slugify(niche)
    result = []
    for d in sorted(niche_dir.iterdir()):
        if not d.is_dir() or d.name in _NICHE_RESERVED:
            continue
        path = d / "outputs" / "03_entrevista_estruturada.md"
        if path.exists():
            result.append((d.name, read_markdown(path)))
    return result


def glossary_docs_for_niche(niche: str) -> list[tuple[str, str]]:
    """(nome_entrevista, conteúdo) de todos os glossario_local.md do nicho."""
    niche_dir = settings.data_dir / _slugify(niche)
    result = []
    for d in sorted(niche_dir.iterdir()):
        if not d.is_dir() or d.name in _NICHE_RESERVED:
            continue
        path = d / "glossary" / "glossario_local.md"
        if path.exists():
            result.append((d.name, read_markdown(path)))
    return result
