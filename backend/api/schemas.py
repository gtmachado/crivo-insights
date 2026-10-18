"""Modelos de resposta/entrada da API (contrato consumido por frontend-next/src/lib/api.ts)."""
from typing import Literal

from pydantic import BaseModel, Field

JobStatus = Literal["running", "done", "error"]
StageStatus = Literal["pending", "processing", "done", "error"]


# ── Genéricos ─────────────────────────────────────────────────────────────────

class Ok(BaseModel):
    ok: bool = True


class JobStarted(BaseModel):
    job_id: str
    message: str


class Document(BaseModel):
    content: str


class DocumentUpdate(BaseModel):
    content: str


class DocumentSaved(Ok):
    path: str
    size: int


# ── Entrevistas ───────────────────────────────────────────────────────────────

class StageFlags(BaseModel):
    raw: bool
    refined: bool
    structured: bool
    glossary: bool


class InterviewSummary(BaseModel):
    name: str
    stages: StageFlags
    # Do metadata.json (ausentes em entrevistas anteriores ao GSD-002).
    title: str | None = None
    interviewee_name: str | None = None
    created_at: str | None = None


class FileEntry(BaseModel):
    name: str
    size: int
    modified: float


class InterviewFiles(BaseModel):
    outputs: list[FileEntry]
    glossary: list[FileEntry]
    raw: list[FileEntry]
    processed: list[FileEntry]
    parts: list[FileEntry]


class InterviewDeleted(Ok):
    deleted: bool = True
    interview: str
    niche: str


class InterviewMetaUpdate(BaseModel):
    """
    Body do PUT /interviews/{niche}/{interview}/meta.

    Um PUT parcial preserva os campos não enviados: só os campos presentes no
    body (`exclude_unset`) são aplicados sobre o meta existente.

    FUTURO (BL-007 / Supabase Auth): interviewer_user_id será populado pelo
    backend a partir do JWT, e interviewer_name derivado do perfil do usuário.
    """
    title: str = ""
    interviewee_name: str = ""
    interviewee_phone: str = ""
    interviewee_email: str = ""
    interviewer_name: str = ""
    interviewer_user_id: str = ""  # reservado para Supabase user ID
    notes: str = ""


class JobStage(BaseModel):
    id: str
    label: str
    status: StageStatus
    started_at: float | None = None
    ended_at: float | None = None
    logs: list[str] = []
    model: str | None = None
    error: str | None = None


class InterviewJob(BaseModel):
    status: JobStatus
    log: list[str]
    stages: list[JobStage]
    paths: dict[str, str]
    niche: str
    interview: str
    started_at: float
    ended_at: float | None = None


class InterviewJobListItem(InterviewJob):
    job_id: str


# ── Nichos ────────────────────────────────────────────────────────────────────

class AnalyzeNicheRequest(BaseModel):
    """Body do POST /niches/{niche}/analyze."""
    interviews: list[str] = Field(min_length=1)


class NicheJob(BaseModel):
    status: JobStatus
    kind: str
    niche: str
    interviews: list[str]
    log: list[str]
    path: str | None = None


# ── Configuração ──────────────────────────────────────────────────────────────

class ModelConfigUpdate(BaseModel):
    refine: str = ""
    structure: str = ""
    glossary: str = ""


class ModelConfig(BaseModel):
    saved: dict[str, str]
    effective: dict[str, str]
    allowed_models: list[str]
    fixed: dict[str, str]


class PromptInfo(BaseModel):
    name: str
    label: str
    filename: str
    has_default: bool


class PromptContent(BaseModel):
    name: str
    content: str
    has_default: bool


class PromptUpdate(BaseModel):
    content: str


class PromptRestored(Ok):
    restored: bool = True


# ── Sistema ───────────────────────────────────────────────────────────────────

class SystemStatus(BaseModel):
    llm_provider: str
    api_key_configured: bool
    whisper_model: str
    data_dir: str
    models: dict[str, str]
