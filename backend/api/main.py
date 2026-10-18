import logging

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.auth import verify_token
from backend.api.routes import config, interviews, media, niches, system

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s - %(message)s",
    datefmt="%H:%M:%S",
)

app = FastAPI(title="Crivo Insights API", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    # Necessário para que <audio>/<video> consigam ler os headers de range
    # responses cross-origin (Content-Range, Accept-Ranges). Sem isso o
    # browser não sabe o tamanho total do arquivo → duração = 0.
    expose_headers=["Content-Range", "Accept-Ranges", "Content-Length", "Content-Disposition"],
)

# Todas as rotas (exceto /health) exigem token quando API_SECRET_KEY está definida.
_protected = [Depends(verify_token)]

for router in (interviews.router, niches.router, config.router, media.router, system.router):
    app.include_router(router, dependencies=_protected)


@app.get("/health")
def health():
    return {"status": "ok"}
