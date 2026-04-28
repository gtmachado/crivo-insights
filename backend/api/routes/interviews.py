import shutil
import uuid
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks

from backend.core.pipeline import run_pipeline
from backend.storage.filesystem import list_interviews, interview_dir, read_markdown
from backend.core.config import settings

router = APIRouter(prefix="/interviews", tags=["interviews"])

_executor = ThreadPoolExecutor(max_workers=2)
_jobs: dict[str, dict] = {}  # job_id → {status, log, paths}

_DOC_MAP = {
    "raw":        ("outputs", "01_transcricao_bruta.md"),
    "refined":    ("outputs", "02_transcricao_refinada.md"),
    "structured": ("outputs", "03_entrevista_estruturada.md"),
    "glossary":   ("glossary", "glossario_local.md"),
}


def _run_job(job_id: str, input_file: Path, niche: str, name: str):
    log: list[str] = []
    _jobs[job_id] = {"status": "running", "log": log, "paths": {}, "niche": niche, "interview": name}

    def on_step(msg: str):
        log.append(msg)
        print(f"[{job_id}] {msg}")

    try:
        paths = run_pipeline(input_file, niche, name, on_step=on_step)
        _jobs[job_id]["paths"] = {k: str(v) for k, v in paths.items()}
        _jobs[job_id]["status"] = "done"
    except Exception as e:
        _jobs[job_id]["status"] = "error"
        log.append(f"ERRO: {e}")
    finally:
        # Remove tmp apenas se não foi copiado para raw/ ainda
        if input_file.exists() and "_tmp" in str(input_file):
            input_file.unlink(missing_ok=True)


@router.post("/upload")
async def upload_interview(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    niche: str = Form(...),
    interview_name: str = Form(...),
):
    tmp_dir = Path(settings.data_dir) / "_tmp"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    tmp_file = tmp_dir / file.filename

    with tmp_file.open("wb") as f:
        shutil.copyfileobj(file.file, f)

    job_id = str(uuid.uuid4())[:8]
    background_tasks.add_task(_run_job, job_id, tmp_file, niche, interview_name)

    return {"job_id": job_id, "message": "Pipeline iniciado."}


@router.get("/status/{job_id}")
def job_status(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job não encontrado.")
    return job


@router.get("/{niche}")
def get_interviews(niche: str):
    return list_interviews(niche)


@router.get("/{niche}/{interview}/{doc}")
def get_document(niche: str, interview: str, doc: str):
    if doc not in _DOC_MAP:
        raise HTTPException(400, f"doc deve ser um de: {list(_DOC_MAP)}")
    subdir, filename = _DOC_MAP[doc]
    base = interview_dir(niche, interview)
    path = base / subdir / filename
    if not path.exists():
        raise HTTPException(404, "Documento ainda não gerado.")
    return {"content": read_markdown(path)}
