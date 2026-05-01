import shutil
import time
import uuid
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from pydantic import BaseModel

from backend.core.pipeline import run_pipeline
from backend.services.llm_client import _resolve_model
from backend.storage.filesystem import (
    list_interviews,
    interview_dir,
    interview_path,
    list_interview_files,
    delete_interview_dir,
    read_markdown,
    save_markdown,
)
from backend.core.config import settings

router = APIRouter(prefix="/interviews", tags=["interviews"])

_executor = ThreadPoolExecutor(max_workers=2)
_jobs: dict[str, dict] = {}  # job_id → {status, log, paths}

# Mapa de doc lógico → (subdir, nome do arquivo no disco)
_DOC_MAP = {
    "raw":        ("outputs", "01_transcricao_bruta.md"),
    "refined":    ("outputs", "02_transcricao_refinada.md"),
    "structured": ("outputs", "03_entrevista_estruturada.md"),
    "glossary":   ("glossary", "glossario_local.md"),
}

# Apenas os 3 docs de transcrição/análise são editáveis. O glossário local é
# regenerado pelo pipeline e não deve ser editado à mão (se editar, a próxima
# rodada do pipeline sobrescreve).
_EDITABLE_DOCS = {"raw", "refined", "structured"}


class DocUpdate(BaseModel):
    """Body do PUT /interviews/{niche}/{interview}/{doc}."""
    content: str


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
    task_map = {"refine": "refine", "structure": "structure", "glossary": "glossary"}
    task = task_map.get(stage_id)
    if not task:
        return None
    try:
        return _resolve_model(task)
    except Exception:
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


def _run_job(job_id: str, input_file: Path, niche: str, name: str):
    log: list[str] = []
    stages = _initial_stages()

    _jobs[job_id] = {
        "status":     "running",
        "log":        log,
        "stages":     stages,
        "paths":      {},
        "niche":      niche,
        "interview":  name,
        "started_at": time.time(),
        "ended_at":   None,
    }

    # Estado mutável compartilhado entre on_step e o controle externo.
    # Usar dict ao invés de int permite mutação simples sem nonlocal.
    state = {"current_idx": -1}

    def stage_idx(stage_id: str) -> int:
        for i, s in enumerate(stages):
            if s["id"] == stage_id:
                return i
        return -1

    def on_step(msg: str):
        log.append(msg)
        print(f"[{job_id}] {msg}")

        new_id = _classify_stage(msg)
        now = time.time()

        if new_id:
            new_idx = stage_idx(new_id)
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
        else:
            # Mensagem informativa — anexa à stage corrente.
            cur_idx = state["current_idx"]
            if cur_idx >= 0:
                stages[cur_idx]["logs"].append(msg)

    try:
        paths = run_pipeline(input_file, niche, name, on_step=on_step)

        # Pipeline OK: fecha qualquer stage ainda em processing.
        end = time.time()
        for s in stages:
            if s["status"] == "processing":
                s["status"]   = "done"
                s["ended_at"] = end

        _jobs[job_id]["paths"]  = {k: str(v) for k, v in paths.items()}
        _jobs[job_id]["status"] = "done"

    except Exception as e:
        # Marca a stage atual como error e anexa mensagem.
        cur_idx = state["current_idx"]
        if cur_idx >= 0:
            stages[cur_idx]["status"]   = "error"
            stages[cur_idx]["error"]    = str(e)
            stages[cur_idx]["ended_at"] = time.time()
        _jobs[job_id]["status"] = "error"
        log.append(f"ERRO: {e}")

    finally:
        _jobs[job_id]["ended_at"] = time.time()
        # Remove tmp apenas se não foi copiado para raw/ ainda.
        if input_file.exists() and "_tmp" in str(input_file):
            input_file.unlink(missing_ok=True)


# ── Upload / job status ───────────────────────────────────────────────────────

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


# ── Listagem por nicho ────────────────────────────────────────────────────────

@router.get("/{niche}")
def get_interviews(niche: str):
    return list_interviews(niche)


# ── Listagem de arquivos da entrevista (FileExplorer) ─────────────────────────
# IMPORTANTE: declarar ANTES de "/{niche}/{interview}/{doc}" para evitar que
# "files" seja interpretado como um {doc}.

@router.get("/{niche}/{interview}/files")
def get_interview_files(niche: str, interview: str):
    """Lista arquivos por subpasta para o explorador da entrevista."""
    try:
        return list_interview_files(niche, interview)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))


# ── Leitura de documento ──────────────────────────────────────────────────────

@router.get("/{niche}/{interview}/{doc}")
def get_document(niche: str, interview: str, doc: str):
    if doc not in _DOC_MAP:
        raise HTTPException(400, f"doc deve ser um de: {list(_DOC_MAP)}")
    subdir, filename = _DOC_MAP[doc]
    base = interview_path(niche, interview)
    path = base / subdir / filename
    if not path.exists():
        raise HTTPException(404, "Documento ainda não gerado.")
    return {"content": read_markdown(path)}


# ── Edição de documento ───────────────────────────────────────────────────────

@router.put("/{niche}/{interview}/{doc}")
def update_document(niche: str, interview: str, doc: str, body: DocUpdate):
    """
    Salva o conteúdo do markdown editado direto no filesystem.
    Apenas os 3 docs de transcrição (raw, refined, structured) são editáveis.
    """
    if doc not in _EDITABLE_DOCS:
        raise HTTPException(
            400,
            f"Só é permitido editar: {sorted(_EDITABLE_DOCS)}. "
            f"O glossário é regenerado pelo pipeline.",
        )
    subdir, filename = _DOC_MAP[doc]
    base = interview_path(niche, interview)
    if not base.exists():
        raise HTTPException(404, f"Entrevista '{interview}' não encontrada.")
    target_dir = base / subdir
    target_dir.mkdir(parents=True, exist_ok=True)
    path = target_dir / filename
    save_markdown(path, body.content)
    return {"ok": True, "path": str(path), "size": len(body.content)}


# ── Exclusão de entrevista ────────────────────────────────────────────────────

@router.delete("/{niche}/{interview}")
def delete_interview(niche: str, interview: str):
    """Apaga TODA a pasta da entrevista (raw, processed, parts, outputs, glossary)."""
    try:
        delete_interview_dir(niche, interview)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    return {"ok": True, "deleted": True, "interview": interview, "niche": niche}
