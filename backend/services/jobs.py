"""Armazenamento em memória de jobs em background (thread-safe)."""
import copy
import threading
import uuid
from typing import Any, Callable

JobDict = dict[str, Any]


class JobStore:
    """
    Guarda o estado dos jobs. Quem executa o job altera o estado SEMPRE via
    `mutate` (sob lock); quem consulta recebe uma cópia (`get`/`items`), então
    nunca serializa uma estrutura sendo modificada por outra thread.

    Mantém no máximo `max_jobs` entradas: ao passar do limite descarta os
    jobs finalizados mais antigos (jobs em execução nunca são descartados).
    """

    def __init__(self, max_jobs: int = 200) -> None:
        self._jobs: dict[str, JobDict] = {}
        self._lock = threading.Lock()
        self._max_jobs = max_jobs

    def create(self, **fields: Any) -> str:
        """Registra um job com status 'running' e devolve o job_id."""
        job_id = uuid.uuid4().hex[:8]
        with self._lock:
            self._jobs[job_id] = {"status": "running", **fields}
            self._prune()
        return job_id

    def mutate(self, job_id: str, fn: Callable[[JobDict], None]) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is not None:
                fn(job)

    def get(self, job_id: str) -> JobDict | None:
        with self._lock:
            job = self._jobs.get(job_id)
            return copy.deepcopy(job) if job is not None else None

    def items(self) -> list[tuple[str, JobDict]]:
        with self._lock:
            return [(jid, copy.deepcopy(job)) for jid, job in self._jobs.items()]

    def clear(self) -> None:
        with self._lock:
            self._jobs.clear()

    def _prune(self) -> None:
        excess = len(self._jobs) - self._max_jobs
        if excess <= 0:
            return
        finished = [jid for jid, job in self._jobs.items() if job.get("status") != "running"]
        for jid in finished[:excess]:
            del self._jobs[jid]
