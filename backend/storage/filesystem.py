from pathlib import Path
import json
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


def niche_dir(niche: str) -> Path:
    """Path da pasta do nicho (read-only: não cria nada)."""
    return settings.data_dir / _slugify(niche)


def _is_interview_dir(path: Path) -> bool:
    """Subpasta de nicho que é uma entrevista (e não consolidado/privada)."""
    return (
        path.is_dir()
        and path.name not in _NICHE_RESERVED
        and not _is_private_dirname(path.name)
    )


def interview_dir(niche: str, interview_name: str) -> Path:
    """Cria e retorna a raiz da entrevista com todas as subpastas."""
    base = niche_dir(niche) / _slugify(interview_name)
    for sub in ("raw", "processed", "parts", "outputs", "glossary"):
        (base / sub).mkdir(parents=True, exist_ok=True)
    return base


def interview_path(niche: str, interview_name: str) -> Path:
    """Retorna o path da entrevista SEM criar nada (read-only). Use p/ leitura/check."""
    return niche_dir(niche) / _slugify(interview_name)


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


def niche_analysis_path(niche: str) -> Path:
    """Caminho do arquivo de análise manual do nicho (read-only: não cria pastas)."""
    return niche_dir(niche) / "_insights" / f"analise_{_slugify(niche)}.md"


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
    base = niche_dir(niche)
    if not base.exists():
        return []
    result = []
    for d in sorted(base.iterdir()):
        if not _is_interview_dir(d):
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


def structured_docs_for_selected(
    niche: str, interview_slugs: list[str]
) -> list[tuple[str, str]]:
    """
    (slug, conteúdo) do 03_entrevista_estruturada.md das entrevistas (slugs)
    selecionadas pelo usuário. Retorna na mesma ordem fornecida; pula
    silenciosamente as que não tiverem o documento.
    """
    base = niche_dir(niche)
    if not base.exists():
        return []
    result: list[tuple[str, str]] = []
    seen: set[str] = set()
    for raw_name in interview_slugs:
        slug = _slugify(raw_name)
        if slug in seen:
            continue
        seen.add(slug)
        d = base / slug
        path = d / "outputs" / "03_entrevista_estruturada.md"
        if _is_interview_dir(d) and path.exists():
            result.append((slug, read_markdown(path)))
    return result


# ── Metadata da entrevista ────────────────────────────────────────────────────

META_FILENAME = "metadata.json"


def read_meta(niche: str, interview_name: str) -> dict:
    """
    Lê o metadata.json da entrevista.
    Retorna {} se o arquivo não existir — metadata é opcional para entrevistas
    antigas que não passaram pelo upload com GSD-002.
    """
    path = interview_path(niche, interview_name) / META_FILENAME
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def write_meta(niche: str, interview_name: str, data: dict) -> None:
    """
    Salva (ou sobrescreve) o metadata.json da entrevista.
    Cria o diretório da entrevista se necessário, mas NÃO cria as subpastas
    (use interview_dir para isso).
    """
    base = interview_path(niche, interview_name)
    base.mkdir(parents=True, exist_ok=True)
    path = base / META_FILENAME
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


# ── Configuração de modelos ───────────────────────────────────────────────────

def _model_config_path() -> Path:
    """data/config/models.json — runtime local, não versionado."""
    return settings.data_dir.parent / "config" / "models.json"


def read_model_config() -> dict[str, str]:
    """
    Lê modelos salvos via UI em data/config/models.json.
    Retorna {} se o arquivo não existir — usa os defaults do código.
    """
    path = _model_config_path()
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def write_model_config(data: dict[str, str]) -> None:
    """Salva configuração de modelos em data/config/models.json."""
    path = _model_config_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
