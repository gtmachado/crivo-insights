from pathlib import Path
import re
import shutil

from backend.core.config import settings

# Dirs reservados DENTRO do nicho — não são entrevistas, são consolidados.
_NICHE_RESERVED = {"_insights", "_glossary"}

# Dirs no nível raiz (data/niches/) que NÃO devem aparecer como nichos.
# Inclui qualquer nome iniciado por "_" (privado) e sentinelas conhecidos.
_PRIVATE_ROOT_DIRS = {"_tmp"}


def _is_private_dirname(name: str) -> bool:
    """Pasta começa com '_' ou '.' → considerada privada / não-nicho."""
    return name.startswith("_") or name.startswith(".") or name in _PRIVATE_ROOT_DIRS


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


def interview_path(niche: str, interview_name: str) -> Path:
    """Retorna o path da entrevista SEM criar nada (read-only). Use p/ leitura/check."""
    return settings.data_dir / _slugify(niche) / _slugify(interview_name)


# Subpastas exibíveis pelo FileExplorer (ordem importa pra UI).
INTERVIEW_SUBDIRS = ("outputs", "glossary", "raw", "processed", "parts")


def list_interview_files(niche: str, interview_name: str) -> dict[str, list[dict]]:
    """
    Lista os arquivos de cada subpasta da entrevista para o FileExplorer.
    Retorna { subdir: [{name, size, modified}, ...] } só com arquivos (não recursivo).
    Subpastas inexistentes vêm como lista vazia. Pasta de entrevista inexistente
    levanta FileNotFoundError.
    """
    base = interview_path(niche, interview_name)
    if not base.exists():
        raise FileNotFoundError(
            f"Entrevista '{interview_name}' não encontrada no nicho '{niche}'."
        )

    out: dict[str, list[dict]] = {}
    for sub in INTERVIEW_SUBDIRS:
        d = base / sub
        if not d.exists():
            out[sub] = []
            continue
        items: list[dict] = []
        for f in sorted(d.iterdir(), key=lambda p: p.name.lower()):
            if not f.is_file() or f.name.startswith("."):
                continue
            try:
                stat = f.stat()
                items.append({
                    "name":     f.name,
                    "size":     stat.st_size,
                    "modified": stat.st_mtime,  # epoch float
                })
            except OSError:
                continue
        out[sub] = items
    return out


def delete_interview_dir(niche: str, interview_name: str) -> None:
    """
    Apaga toda a pasta da entrevista (raw/, processed/, parts/, outputs/, glossary/).
    Levanta FileNotFoundError se a pasta não existir.
    Operação destrutiva — chame só após confirmação do usuário.
    """
    base = interview_path(niche, interview_name)
    if not base.exists():
        raise FileNotFoundError(
            f"Entrevista '{interview_name}' não encontrada no nicho '{niche}'."
        )
    shutil.rmtree(base)


def niche_insights_dir(niche: str) -> Path:
    path = settings.data_dir / _slugify(niche) / "_insights"
    path.mkdir(parents=True, exist_ok=True)
    return path


def niche_analysis_path(niche: str) -> Path:
    """Caminho do arquivo de análise manual do nicho (Fase 4)."""
    return niche_insights_dir(niche) / f"analise_{_slugify(niche)}.md"


def niche_glossary_dir(niche: str) -> Path:
    path = settings.data_dir / _slugify(niche) / "_glossary"
    path.mkdir(parents=True, exist_ok=True)
    return path


def list_niches() -> list[str]:
    """
    Lista todos os nichos válidos em data/niches/.
    Pastas privadas (`_tmp`, qualquer prefixo `_` ou `.`) são ignoradas —
    não são nichos reais, e sim diretórios de runtime/sentinelas.
    """
    base = settings.data_dir
    base.mkdir(parents=True, exist_ok=True)
    return [
        d.name
        for d in sorted(base.iterdir())
        if d.is_dir() and not _is_private_dirname(d.name)
    ]


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


def structured_docs_for_selected(
    niche: str, interview_slugs: list[str]
) -> list[tuple[str, str]]:
    """
    Variante de `structured_docs_for_niche` que filtra por uma lista de
    entrevistas (slugs) selecionadas pelo usuário. Retorna na mesma ordem
    fornecida; pula silenciosamente as que não tiverem 03_estruturada.md.
    """
    base = settings.data_dir / _slugify(niche)
    if not base.exists():
        return []
    result: list[tuple[str, str]] = []
    seen: set[str] = set()
    for raw_name in interview_slugs:
        slug = _slugify(raw_name)
        if slug in seen or slug in _NICHE_RESERVED:
            continue
        seen.add(slug)
        d = base / slug
        path = d / "outputs" / "03_entrevista_estruturada.md"
        if d.is_dir() and path.exists():
            result.append((slug, read_markdown(path)))
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
