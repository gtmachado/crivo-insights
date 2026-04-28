import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, BackgroundTasks

from backend.storage.filesystem import list_niches, read_markdown, niche_insights_dir, niche_glossary_dir
from backend.services.consolidator import consolidate_insights, consolidate_glossary

router = APIRouter(prefix="/niches", tags=["niches"])

_jobs: dict[str, dict] = {}


def _run_job(job_id: str, kind: str, niche: str):
    _jobs[job_id] = {"status": "running", "kind": kind, "log": []}
    try:
        if kind == "insights":
            out_path = consolidate_insights(niche)
        else:
            out_path = consolidate_glossary(niche)
        _jobs[job_id]["status"] = "done"
        _jobs[job_id]["path"] = str(out_path)
    except Exception as e:
        _jobs[job_id]["status"] = "error"
        _jobs[job_id]["log"].append(str(e))


@router.get("/")
def get_niches():
    return list_niches()


@router.post("/{niche}/consolidate/insights")
def consolidate_insights_endpoint(niche: str, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())[:8]
    background_tasks.add_task(_run_job, job_id, "insights", niche)
    return {"job_id": job_id, "message": f"Consolidação de insights do nicho '{niche}' iniciada."}


@router.post("/{niche}/consolidate/glossary")
def consolidate_glossary_endpoint(niche: str, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())[:8]
    background_tasks.add_task(_run_job, job_id, "glossary", niche)
    return {"job_id": job_id, "message": f"Consolidação de glossário do nicho '{niche}' iniciada."}


@router.get("/{niche}/consolidate/status/{job_id}")
def consolidation_status(niche: str, job_id: str):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job não encontrado.")
    return job


@router.get("/{niche}/insights")
def get_consolidated_insights(niche: str):
    path = niche_insights_dir(niche) / "01_insights_consolidados.md"
    if not path.exists():
        raise HTTPException(404, "Consolidado de insights ainda não gerado.")
    return {"content": read_markdown(path)}


@router.get("/{niche}/glossary")
def get_consolidated_glossary(niche: str):
    path = niche_glossary_dir(niche) / "glossario_nicho.md"
    if not path.exists():
        raise HTTPException(404, "Glossário do nicho ainda não gerado.")
    return {"content": read_markdown(path)}
