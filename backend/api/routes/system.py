"""Status do sistema e jobs em andamento (dashboard)."""
from fastapi import APIRouter

from backend.api.schemas import InterviewJobListItem, SystemStatus
from backend.core.config import settings
from backend.core.layout import LLM_TASKS
from backend.services import interview_runner
from backend.services.llm_client import resolve_model

router = APIRouter(tags=["system"])


@router.get("/status", response_model=SystemStatus)
def system_status():
    return SystemStatus(
        llm_provider=settings.llm_provider,
        api_key_configured=bool(settings.active_api_key()),
        whisper_model=settings.whisper_model,
        data_dir=str(settings.data_dir),
        models={task: resolve_model(task) for task in LLM_TASKS},
    )


@router.get("/pipeline/jobs", response_model=list[InterviewJobListItem])
def list_all_jobs():
    """Todos os jobs de entrevista em memória (dashboard)."""
    return [{"job_id": job_id, **job} for job_id, job in interview_runner.jobs.items()]
