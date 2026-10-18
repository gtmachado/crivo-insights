import logging
import re
import shutil
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from backend.core.config import settings
from backend.core.pipeline import run_pipeline
from backend.services.converter import SUPPORTED_INPUT
from backend.services.jobs import JobDict, JobStore
from backend.services.llm_client import _resolve_model
from backend.storage.filesystem import (
    delete_interview_dir,
    interview_dir,
    interview_path,
    list_interview_files,
    list_interviews,
    read_markdown,
    read_meta,
    save_markdown,
    write_meta,
)

log = logging.getLogger("interviews")

router = APIRouter(prefix="/interviews", tags=["interviews"])

jobs = JobStore()

# Mapa de doc lógico → (subdir, nome do arquivo no disco)
_DOC_MAP = {
    "raw":        ("outputs", "01_transcricao_bruta.md"),
    "refined":    ("outputs", "02_transcricao_refinada.md"),
    "structured": ("outputs", "03_entrevista_estruturada.md"),
    "glossary":   ("glossary", "glossario_local.md"),
}

# Todos os docs são editáveis via PUT. Uma nova rodada do pipeline sobrescreve
# o arquivo — o usuário está ciente disso.
_EDITABLE_DOCS = set(_DOC_MAP)


class DocUpdate(BaseModel):
    """Body do PUT /interviews/{niche}/{interview}/{doc}."""
    content: str


class InterviewMetaUpdate(BaseModel):
    """
    Body do PUT /interviews/{niche}/{interview}/meta.

    Um PUT parcial preserva os campos não enviados: o endpoint só aplica sobre
    o meta existente os campos presentes no body (`exclude_unset`).

    FUTURO (BL-007 / Supabase Auth): quando autenticação for implementada,
    interviewer_user_id será populado pelo backend a partir do JWT, e
    interviewer_name será derivado do perfil do usuário.
    """
    title: str = ""
    interviewee_name: str = ""
    interviewee_phone: str = ""
    interviewee_email: str = ""
    interviewer_name: str = ""
    interviewer_user_id: str = ""  # reservado para Supabase user ID
    notes: str = ""


# ── Pipeline stages — derivados das mensagens do `on_step` em pipeline.py ─────
# Não tocamos pipeline.py: classificamos as mensagens recebidas pelo callback
# pra inferir transições de stage, tempos e modelo associado.

PIPELINE_STAGES = ("upload", "convert", "transcribe", "refine", "structure", "glossary")

_STAGE_LABELS = {
    "upload":     "Upload",
    "convert":    "Conversão",
    "transcribe": "Transcrição",
    "refine":     "Refino",
    "structure":  "Estruturação",
    "glossary":   "Glossário",
}

# (stage_id, prefixo da mensagem que dispara início da stage). Ordem importa.
_STAGE_TRIGGERS: list[tuple[str, str]] = [
    ("upload",     "Preservando arquivo original"),
    ("convert",    "Convertendo para WAV"),
    ("transcribe", "Transcrevendo com Whisper"),
    ("refine",     "Refinando transcrição"),
    ("structure",  "Estruturando entrevista"),
    ("glossary",   "Gerando glossário"),
]


def _classify_stage(msg: str) -> str | None:
    for stage_id, prefix in _STAGE_TRIGGERS:
        if msg.startswith(prefix):
            return stage_id
    return None


def _model_for_stage(stage_id: str) -> str | None:
    """Devolve o modelo configurado pra stage. Stages sem LLM retornam None."""
    if stage_id == "transcribe":
        return f"whisper-{settings.whisper_model}"
    if stage_id not in ("refine", "structure", "glossary"):
        return None
    try:
        return _resolve_model(stage_id)
    except Exception:  # noqa: BLE001 — modelo é informativo, não pode quebrar o job
        return None


def _initial_stages() -> list[dict]:
    """Lista pré-populada de todas as stages como pending — UI já tem a estrutura."""
    return [
        {
            "id":         sid,
            "label":      _STAGE_LABELS[sid],
            "status":     "pending",
            "started_at": None,
            "ended_at":   None,
            "logs":       [],
            "model":      _model_for_stage(sid),
            "error":      None,
        }
        for sid in PIPELINE_STAGES
    ]


def _apply_step(job: JobDict, state: dict, msg: str) -> None:
    """Aplica uma mensagem de `on_step` ao estado do job (stages, logs, tempos)."""
    stages = job["stages"]
    job["log"].append(msg)

    new_id = _classify_stage(msg)
    now = time.time()

    if not new_id:
        # Mensagem informativa — anexa à stage corrente.
        cur_idx = state["current_idx"]
        if cur_idx >= 0:
            stages[cur_idx]["logs"].append(msg)
        return

    new_idx = next((i for i, s in enumerate(stages) if s["id"] == new_id), -1)
    if new_idx == -1:
        return

    # Fecha a stage atual (se diferente) como done.
    cur_idx = state["current_idx"]
    if cur_idx >= 0 and cur_idx != new_idx and stages[cur_idx]["status"] == "processing":
        stages[cur_idx]["status"] = "done"
        stages[cur_idx]["ended_at"] = now

    # Caso pulou stages intermediárias (não esperado, defensivo).
    for i in range(new_idx):
        if stages[i]["status"] == "pending":
            stages[i]["status"]     = "done"
            stages[i]["started_at"] = stages[i]["started_at"] or now
            stages[i]["ended_at"]   = stages[i]["ended_at"]   or now

    stages[new_idx]["status"]     = "processing"
    stages[new_idx]["started_at"] = stages[new_idx]["started_at"] or now
    stages[new_idx]["logs"].append(msg)
    state["current_idx"] = new_idx


def _finish_ok(job: JobDict, paths: dict[str, Path]) -> None:
    end = time.time()
    for s in job["stages"]:
        if s["status"] == "processing":
            s["status"]   = "done"
            s["ended_at"] = end
    job["paths"]  = {k: str(v) for k, v in paths.items()}
    job["status"] = "done"


def _finish_error(job: JobDict, state: dict, error: Exception) -> None:
    cur_idx = state["current_idx"]
    if cur_idx >= 0:
        job["stages"][cur_idx]["status"]   = "error"
        job["stages"][cur_idx]["error"]    = str(error)
        job["stages"][cur_idx]["ended_at"] = time.time()
    job["status"] = "error"
    job["log"].append(f"ERRO: {error}")


def _tmp_root() -> Path:
    return Path(settings.data_dir) / "_tmp"


def _cleanup_tmp(input_file: Path) -> None:
    """Remove a pasta temporária do upload (apenas se estiver sob data/_tmp)."""
    folder = input_file.parent
    if folder != _tmp_root() and folder.is_relative_to(_tmp_root()):
        shutil.rmtree(folder, ignore_errors=True)


def _run_job(job_id: str, input_file: Path, niche: str, name: str) -> None:
    state = {"current_idx": -1}

    def on_step(msg: str) -> None:
        log.info("[%s] %s", job_id, msg)
        jobs.mutate(job_id, lambda job: _apply_step(job, state, msg))

    try:
        paths = run_pipeline(input_file, niche, name, on_step=on_step)
        jobs.mutate(job_id, lambda job: _finish_ok(job, paths))
    except Exception as e:  # noqa: BLE001 — o erro vai para o job
        log.exception("[%s] pipeline falhou", job_id)
        jobs.mutate(job_id, lambda job: _finish_error(job, state, e))
    finally:
        jobs.mutate(job_id, lambda job: job.update(ended_at=time.time()))
        _cleanup_tmp(input_file)


# ── Upload / job status ───────────────────────────────────────────────────────

def _safe_upload_name(filename: str | None) -> str:
    """Só o nome-base, sem caracteres problemáticos; preserva a extensão."""
    name = Path((filename or "").replace("\\", "/")).name.strip()
    name = re.sub(r"[^\w.\- ]", "_", name)
    return name if name not in ("", ".", "..") else "upload"


@router.post("/upload")
def upload_interview(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    niche: str = Form(...),
    interview_name: str = Form(...),
    # ── Metadata — todos opcionais ─────────────────────────────────────────────
    # Salvos em metadata.json ANTES do pipeline iniciar, para garantir que
    # os dados existam mesmo se o pipeline falhar parcialmente.
    meta_title: str = Form(default=""),
    meta_interviewee_name: str = Form(default=""),
    meta_interviewee_phone: str = Form(default=""),
    meta_interviewee_email: str = Form(default=""),
    meta_interviewer_name: str = Form(default=""),
    # FUTURO (BL-007): quando Supabase Auth for implementado, este campo será
    # populado a partir do JWT do usuário logado, não enviado pelo frontend.
    meta_interviewer_user_id: str = Form(default=""),
    meta_notes: str = Form(default=""),
):
    # Endpoint síncrono de propósito: o FastAPI o executa em threadpool, então
    # a cópia do upload (bloqueante) não trava o event loop.
    safe_name = _safe_upload_name(file.filename)
    if Path(safe_name).suffix.lower() not in SUPPORTED_INPUT:
        raise HTTPException(
            400,
            f"Formato não suportado: '{Path(safe_name).suffix}'. "
            f"Suportados: {', '.join(sorted(SUPPORTED_INPUT))}",
        )

    # Pasta única por upload: dois envios com o mesmo nome não colidem.
    tmp_dir = _tmp_root() / uuid.uuid4().hex
    tmp_dir.mkdir(parents=True, exist_ok=True)
    tmp_file = tmp_dir / safe_name
    with tmp_file.open("wb") as f:
        shutil.copyfileobj(file.file, f)

    # Cria o diretório da entrevista com todas as subpastas e salva metadata
    # ANTES de iniciar o pipeline. Assim o metadata.json existe mesmo se o
    # pipeline falhar.
    base = interview_dir(niche, interview_name)

    write_meta(niche, interview_name, {
        "title": meta_title or interview_name,
        "niche": niche,
        "interview_slug": base.name,  # interview_dir já slugifica o nome
        "interviewee_name": meta_interviewee_name,
        "interviewee_phone": meta_interviewee_phone,
        "interviewee_email": meta_interviewee_email,
        "interviewer_name": meta_interviewer_name,
        "interviewer_user_id": meta_interviewer_user_id,
        "notes": meta_notes,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "source_filename": safe_name,
    })

    # O job existe antes de a task começar: um GET de status logo após o POST
    # nunca recebe 404.
    job_id = jobs.create(
        log=[],
        stages=_initial_stages(),
        paths={},
        niche=niche,
        interview=interview_name,
        started_at=time.time(),
        ended_at=None,
    )
    background_tasks.add_task(_run_job, job_id, tmp_file, niche, interview_name)

    return {"job_id": job_id, "message": "Pipeline iniciado."}


@router.get("/status/{job_id}")
def job_status(job_id: str):
    job = jobs.get(job_id)
    if job is None:
        raise HTTPException(404, "Job não encontrado.")
    return job


def jobs_snapshot() -> list[tuple[str, JobDict]]:
    """Cópia de todos os jobs de entrevista (usado pelo dashboard)."""
    return jobs.items()


# ── Listagem por nicho ────────────────────────────────────────────────────────

@router.get("/{niche}")
def get_interviews(niche: str):
    return list_interviews(niche)


# ── Listagem de arquivos / metadata ───────────────────────────────────────────
# IMPORTANTE: declarar ANTES de "/{niche}/{interview}/{doc}" para evitar que
# "files" e "meta" sejam interpretados como um {doc}.

@router.get("/{niche}/{interview}/files")
def get_interview_files(niche: str, interview: str):
    """Lista arquivos por subpasta para o explorador da entrevista."""
    try:
        return list_interview_files(niche, interview)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))


@router.get("/{niche}/{interview}/meta")
def get_interview_meta(niche: str, interview: str):
    """
    Retorna o metadata.json da entrevista.
    Retorna {} (objeto vazio) se o arquivo não existir — metadata é opcional
    para entrevistas criadas antes do GSD-002.
    """
    return read_meta(niche, interview)


@router.put("/{niche}/{interview}/meta")
def update_interview_meta(niche: str, interview: str, body: InterviewMetaUpdate):
    """
    Salva (merge) os campos de metadata enviados no body.
    Campos não enviados são preservados. Adiciona `updated_at` automaticamente.
    """
    if not interview_path(niche, interview).exists():
        raise HTTPException(404, f"Entrevista '{interview}' não encontrada.")
    updated = {
        **read_meta(niche, interview),
        **body.model_dump(exclude_unset=True),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    write_meta(niche, interview, updated)
    return {"ok": True}


# ── Documentos ────────────────────────────────────────────────────────────────

@router.get("/{niche}/{interview}/{doc}")
def get_document(niche: str, interview: str, doc: str):
    if doc not in _DOC_MAP:
        raise HTTPException(400, f"doc deve ser um de: {list(_DOC_MAP)}")
    subdir, filename = _DOC_MAP[doc]
    path = interview_path(niche, interview) / subdir / filename
    if not path.exists():
        raise HTTPException(404, "Documento ainda não gerado.")
    return {"content": read_markdown(path)}


@router.put("/{niche}/{interview}/{doc}")
def update_document(niche: str, interview: str, doc: str, body: DocUpdate):
    """Salva o conteúdo do markdown editado direto no filesystem."""
    if doc not in _EDITABLE_DOCS:
        raise HTTPException(400, f"Só é permitido editar: {sorted(_EDITABLE_DOCS)}.")
    base = interview_path(niche, interview)
    if not base.exists():
        raise HTTPException(404, f"Entrevista '{interview}' não encontrada.")
    subdir, filename = _DOC_MAP[doc]
    path = base / subdir / filename
    save_markdown(path, body.content)
    return {"ok": True, "path": str(path), "size": len(body.content)}


@router.delete("/{niche}/{interview}")
def delete_interview(niche: str, interview: str):
    """Apaga TODA a pasta da entrevista (raw, processed, parts, outputs, glossary)."""
    try:
        delete_interview_dir(niche, interview)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    return {"ok": True, "deleted": True, "interview": interview, "niche": niche}
