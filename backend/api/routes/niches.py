from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field

from backend.services.jobs import JobStore
from backend.services.niche_analyzer import analyze_niche
from backend.storage.filesystem import list_niches, niche_analysis_path, read_markdown

router = APIRouter(prefix="/niches", tags=["niches"])

jobs = JobStore()


class AnalyzeNicheRequest(BaseModel):
    """Body do POST /niches/{niche}/analyze."""
    interviews: list[str] = Field(min_length=1)


def _run_analysis(job_id: str, niche: str, interviews: list[str]) -> None:
    def finish_ok(job: dict, path: str) -> None:
        job.update(status="done", path=path)

    def finish_error(job: dict, message: str) -> None:
        job["status"] = "error"
        job["log"].append(message)

    try:
        out_path = analyze_niche(niche, interviews)
    except Exception as e:  # noqa: BLE001 — o erro vai para o job, não derruba a thread
        jobs.mutate(job_id, lambda job: finish_error(job, str(e)))
    else:
        jobs.mutate(job_id, lambda job: finish_ok(job, str(out_path)))


@router.get("/")
def get_niches():
    return list_niches()


@router.post("/{niche}/analyze")
def analyze_niche_endpoint(
    niche: str,
    body: AnalyzeNicheRequest,
    background_tasks: BackgroundTasks,
):
    """
    Inicia a análise manual do nicho usando Claude Sonnet 4.6.

    Body: { "interviews": ["slug1", "slug2", ...] }
    Retorna: { job_id }. Acompanhe via /niches/{niche}/analyze/status/{job_id}.
    O resultado fica em data/niches/{nicho}/_insights/analise_{slug}.md.
    """
    # O job existe antes de a task começar: um GET de status logo após o POST
    # nunca recebe 404.
    job_id = jobs.create(kind="analysis", niche=niche, interviews=body.interviews, log=[])
    background_tasks.add_task(_run_analysis, job_id, niche, body.interviews)
    return {
        "job_id":  job_id,
        "message": f"Análise do nicho '{niche}' iniciada com {len(body.interviews)} entrevista(s).",
    }


@router.get("/{niche}/analyze/status/{job_id}")
def analysis_status(niche: str, job_id: str):
    job = jobs.get(job_id)
    if job is None:
        raise HTTPException(404, "Job não encontrado.")
    return job


@router.get("/{niche}/analysis")
def get_niche_analysis(niche: str):
    """Retorna o conteúdo da análise consolidada manual do nicho."""
    path = niche_analysis_path(niche)
    if not path.exists():
        raise HTTPException(404, "Análise do nicho ainda não gerada.")
    return {"content": read_markdown(path)}
