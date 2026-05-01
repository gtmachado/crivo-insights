import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel

from backend.storage.filesystem import (
    list_niches,
    read_markdown,
    niche_insights_dir,
    niche_glossary_dir,
    niche_analysis_path,
)
from backend.services.consolidator import consolidate_insights, consolidate_glossary
from backend.services.niche_analyzer import analyze_niche

router = APIRouter(prefix="/niches", tags=["niches"])

_jobs: dict[str, dict] = {}


# ── Body models ───────────────────────────────────────────────────────────────

class AnalyzeNicheRequest(BaseModel):
    """Body do POST /niches/{niche}/analyze (Fase 4)."""
    interviews: list[str]


# ── Job runners ───────────────────────────────────────────────────────────────

def _run_consolidation(job_id: str, kind: str, niche: str):
    _jobs[job_id] = {"status": "running", "kind": kind, "niche": niche, "log": []}
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


def _run_analysis(job_id: str, niche: str, interviews: list[str]):
    _jobs[job_id] = {
        "status":     "running",
        "kind":       "analysis",
        "niche":      niche,
        "interviews": interviews,
        "log":        [],
    }
    try:
        out_path = analyze_niche(niche, interviews)
        _jobs[job_id]["status"] = "done"
        _jobs[job_id]["path"]   = str(out_path)
    except Exception as e:
        _jobs[job_id]["status"] = "error"
        _jobs[job_id]["log"].append(str(e))


# ── Listagem ──────────────────────────────────────────────────────────────────

@router.get("/")
def get_niches():
    return list_niches()


# ── Consolidação automática (legado — preservada na Fase 4) ───────────────────

@router.post("/{niche}/consolidate/insights")
def consolidate_insights_endpoint(niche: str, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())[:8]
    background_tasks.add_task(_run_consolidation, job_id, "insights", niche)
    return {"job_id": job_id, "message": f"Consolidação de insights do nicho '{niche}' iniciada."}


@router.post("/{niche}/consolidate/glossary")
def consolidate_glossary_endpoint(niche: str, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())[:8]
    background_tasks.add_task(_run_consolidation, job_id, "glossary", niche)
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


# ── Análise manual (Fase 4) ───────────────────────────────────────────────────

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
    if not body.interviews:
        raise HTTPException(
            400,
            "Campo 'interviews' é obrigatório e não pode ser vazio.",
        )
    job_id = str(uuid.uuid4())[:8]
    background_tasks.add_task(_run_analysis, job_id, niche, body.interviews)
    return {
        "job_id":  job_id,
        "message": f"Análise do nicho '{niche}' iniciada com {len(body.interviews)} entrevista(s).",
    }


@router.get("/{niche}/analyze/status/{job_id}")
def analysis_status(niche: str, job_id: str):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job não encontrado.")
    return job


@router.get("/{niche}/analysis")
def get_niche_analysis(niche: str):
    """Retorna o conteúdo da análise consolidada manual do nicho (Fase 4)."""
    path = niche_analysis_path(niche)
    if not path.exists():
        raise HTTPException(404, "Análise do nicho ainda não gerada.")
    return {"content": read_markdown(path)}
