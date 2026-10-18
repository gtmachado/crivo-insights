import re
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile

from backend.api.schemas import (
    Document,
    DocumentSaved,
    DocumentUpdate,
    InterviewDeleted,
    InterviewFiles,
    InterviewJob,
    InterviewMetaUpdate,
    InterviewSummary,
    JobStarted,
    Ok,
)
from backend.core.layout import DOCS
from backend.services import interview_runner
from backend.services.converter import SUPPORTED_INPUT
from backend.storage.filesystem import (
    delete_interview_dir,
    interview_dir,
    interview_path,
    list_interview_files,
    list_interviews,
    read_markdown,
    read_meta,
    save_markdown,
    upload_tmp_root,
    write_meta,
)

router = APIRouter(prefix="/interviews", tags=["interviews"])


def _safe_upload_name(filename: str | None) -> str:
    """Só o nome-base, sem caracteres problemáticos; preserva a extensão."""
    name = Path((filename or "").replace("\\", "/")).name.strip()
    name = re.sub(r"[^\w.\- ]", "_", name)
    return name if name not in ("", ".", "..") else "upload"


# ── Upload / job status ───────────────────────────────────────────────────────

@router.post("/upload", response_model=JobStarted)
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
    # FUTURO (BL-007): populado a partir do JWT do usuário logado.
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
    tmp_dir = upload_tmp_root() / uuid.uuid4().hex
    tmp_dir.mkdir(parents=True, exist_ok=True)
    tmp_file = tmp_dir / safe_name
    with tmp_file.open("wb") as f:
        shutil.copyfileobj(file.file, f)

    # Cria a entrevista e salva o metadata ANTES do pipeline: o metadata.json
    # existe mesmo se o pipeline falhar.
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

    job_id = interview_runner.create_job(niche, interview_name)
    background_tasks.add_task(interview_runner.run_job, job_id, tmp_file, niche, interview_name)
    return JobStarted(job_id=job_id, message="Pipeline iniciado.")


@router.get("/status/{job_id}", response_model=InterviewJob)
def job_status(job_id: str):
    job = interview_runner.jobs.get(job_id)
    if job is None:
        raise HTTPException(404, "Job não encontrado.")
    return job


# ── Listagem por nicho ────────────────────────────────────────────────────────

@router.get("/{niche}", response_model=list[InterviewSummary])
def get_interviews(niche: str):
    return list_interviews(niche)


# ── Listagem de arquivos / metadata ───────────────────────────────────────────
# IMPORTANTE: declarar ANTES de "/{niche}/{interview}/{doc}" para evitar que
# "files" e "meta" sejam interpretados como um {doc}.

@router.get("/{niche}/{interview}/files", response_model=InterviewFiles)
def get_interview_files(niche: str, interview: str):
    """Lista arquivos por subpasta para o explorador da entrevista."""
    try:
        return list_interview_files(niche, interview)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))


@router.get("/{niche}/{interview}/meta")
def get_interview_meta(niche: str, interview: str) -> dict:
    """
    Retorna o metadata.json da entrevista.
    Retorna {} (objeto vazio) se o arquivo não existir — metadata é opcional
    para entrevistas criadas antes do GSD-002.
    """
    return read_meta(niche, interview)


@router.put("/{niche}/{interview}/meta", response_model=Ok)
def update_interview_meta(niche: str, interview: str, body: InterviewMetaUpdate):
    """
    Salva (merge) os campos de metadata enviados no body.
    Campos não enviados são preservados. Adiciona `updated_at` automaticamente.
    """
    if not interview_path(niche, interview).exists():
        raise HTTPException(404, f"Entrevista '{interview}' não encontrada.")
    write_meta(niche, interview, {
        **read_meta(niche, interview),
        **body.model_dump(exclude_unset=True),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })
    return Ok()


# ── Documentos ────────────────────────────────────────────────────────────────

@router.get("/{niche}/{interview}/{doc}", response_model=Document)
def get_document(niche: str, interview: str, doc: str):
    if doc not in DOCS:
        raise HTTPException(400, f"doc deve ser um de: {list(DOCS)}")
    subdir, filename = DOCS[doc]
    path = interview_path(niche, interview) / subdir / filename
    if not path.exists():
        raise HTTPException(404, "Documento ainda não gerado.")
    return Document(content=read_markdown(path))


@router.put("/{niche}/{interview}/{doc}", response_model=DocumentSaved)
def update_document(niche: str, interview: str, doc: str, body: DocumentUpdate):
    """
    Salva o markdown editado direto no filesystem. Todos os docs são editáveis;
    uma nova rodada do pipeline sobrescreve o arquivo.
    """
    if doc not in DOCS:
        raise HTTPException(400, f"doc deve ser um de: {list(DOCS)}")
    base = interview_path(niche, interview)
    if not base.exists():
        raise HTTPException(404, f"Entrevista '{interview}' não encontrada.")
    subdir, filename = DOCS[doc]
    path = base / subdir / filename
    save_markdown(path, body.content)
    return DocumentSaved(path=str(path), size=len(body.content))


@router.delete("/{niche}/{interview}", response_model=InterviewDeleted)
def delete_interview(niche: str, interview: str):
    """Apaga TODA a pasta da entrevista (raw, processed, parts, outputs, glossary)."""
    try:
        delete_interview_dir(niche, interview)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    return InterviewDeleted(interview=interview, niche=niche)
