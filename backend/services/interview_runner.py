"""
Execução do pipeline de uma entrevista como job em background.

Não tocamos `core/pipeline.py`: classificamos as mensagens recebidas pelo
callback `on_step` para inferir transições de etapa, tempos e modelo.
O texto das mensagens do pipeline é, portanto, um contrato (ver
`_STAGE_TRIGGERS` e `backend/tests/test_interviews.py`).
"""
import logging
import shutil
import time
from pathlib import Path

from backend.core.config import settings
from backend.core.pipeline import run_pipeline
from backend.services.jobs import JobDict, JobStore
from backend.services.llm_client import resolve_model
from backend.storage.filesystem import upload_tmp_root

log = logging.getLogger("interview_runner")

jobs = JobStore()

PIPELINE_STAGES = ("upload", "convert", "transcribe", "refine", "structure", "glossary")

_STAGE_LABELS = {
    "upload":     "Upload",
    "convert":    "Conversão",
    "transcribe": "Transcrição",
    "refine":     "Refino",
    "structure":  "Estruturação",
    "glossary":   "Glossário",
}

# (stage_id, prefixo da mensagem que dispara o início da etapa).
_STAGE_TRIGGERS: list[tuple[str, str]] = [
    ("upload",     "Preservando arquivo original"),
    ("convert",    "Convertendo para WAV"),
    ("transcribe", "Transcrevendo com Whisper"),
    ("refine",     "Refinando transcrição"),
    ("structure",  "Estruturando entrevista"),
    ("glossary",   "Gerando glossário"),
]

_LLM_STAGES = ("refine", "structure", "glossary")


def classify_stage(msg: str) -> str | None:
    for stage_id, prefix in _STAGE_TRIGGERS:
        if msg.startswith(prefix):
            return stage_id
    return None


def _model_for_stage(stage_id: str) -> str | None:
    """Modelo configurado para a etapa. Etapas sem LLM/Whisper retornam None."""
    if stage_id == "transcribe":
        return f"whisper-{settings.whisper_model}"
    if stage_id not in _LLM_STAGES:
        return None
    try:
        return resolve_model(stage_id)
    except Exception:  # noqa: BLE001 — o modelo é informativo, não pode quebrar o job
        return None


def _initial_stages() -> list[dict]:
    """Todas as etapas como pending — a UI já recebe a estrutura completa."""
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


def create_job(niche: str, interview: str) -> str:
    """
    Registra o job (status 'running') e devolve o job_id. Chamar ANTES de
    agendar `run_job`: assim o primeiro poll de status nunca recebe 404.
    """
    return jobs.create(
        log=[],
        stages=_initial_stages(),
        paths={},
        niche=niche,
        interview=interview,
        started_at=time.time(),
        ended_at=None,
    )


def apply_step(job: JobDict, state: dict, msg: str) -> None:
    """Aplica uma mensagem de `on_step` ao estado do job (etapas, logs, tempos)."""
    stages = job["stages"]
    job["log"].append(msg)

    new_id = classify_stage(msg)
    now = time.time()

    if not new_id:
        # Mensagem informativa — anexa à etapa corrente.
        cur_idx = state["current_idx"]
        if cur_idx >= 0:
            stages[cur_idx]["logs"].append(msg)
        return

    new_idx = next((i for i, s in enumerate(stages) if s["id"] == new_id), -1)
    if new_idx == -1:
        return

    # Fecha a etapa atual (se diferente) como done.
    cur_idx = state["current_idx"]
    if cur_idx >= 0 and cur_idx != new_idx and stages[cur_idx]["status"] == "processing":
        stages[cur_idx]["status"] = "done"
        stages[cur_idx]["ended_at"] = now

    # Defensivo: se o pipeline pulou etapas intermediárias, fecha como done.
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


def _cleanup_tmp(input_file: Path) -> None:
    """Remove a pasta temporária do upload (apenas se estiver sob data/_tmp)."""
    folder, root = input_file.parent, upload_tmp_root()
    if folder != root and folder.is_relative_to(root):
        shutil.rmtree(folder, ignore_errors=True)


def run_job(job_id: str, input_file: Path, niche: str, interview: str) -> None:
    """Roda o pipeline completo de uma entrevista atualizando o job `job_id`."""
    state = {"current_idx": -1}

    def on_step(msg: str) -> None:
        log.info("[%s] %s", job_id, msg)
        jobs.mutate(job_id, lambda job: apply_step(job, state, msg))

    try:
        paths = run_pipeline(input_file, niche, interview, on_step=on_step)
        jobs.mutate(job_id, lambda job: _finish_ok(job, paths))
    except Exception as e:  # noqa: BLE001 — o erro vai para o job, não derruba a thread
        log.exception("[%s] pipeline falhou", job_id)
        jobs.mutate(job_id, lambda job: _finish_error(job, state, e))
    finally:
        jobs.mutate(job_id, lambda job: job.update(ended_at=time.time()))
        _cleanup_tmp(input_file)
