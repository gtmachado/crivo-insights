"""
Camada unificada de acesso a LLMs.

Suporta:
  - OpenRouter  (padrão) — compatível com OpenAI Chat Completions
  - Gemini      — via google-generativeai SDK
  - Anthropic   — API direta

Uso:
    from backend.services.llm_client import call

    text = call(task="refine", system_prompt="...", user_content="...")
"""
import logging
import time
from typing import Callable, Optional

from backend.core.config import settings
from backend.core.layout import LLM_TASKS
from backend.services import model_config

log = logging.getLogger("llm_client")

# ─── Defaults por provider ─────────────────────────────────────────────────────
# Todas as etapas usam Sonnet 4.6 por padrão (qualidade de transcrição/análise).
# Para reduzir custo, escolha outro modelo em /settings ou via .env (MODEL_*).
_DEFAULT_MODEL: dict[str, str] = {
    "openrouter": "anthropic/claude-sonnet-4.6",
    "gemini":     "gemini-2.0-flash",
    "anthropic":  "claude-sonnet-4-6",
}

_MAX_TOKENS = 8192
_TIMEOUT_S = 300.0
_RATE_LIMIT_DELAYS = (5, 15, 30)  # segundos entre tentativas em caso de 429


def resolve_model(task: str) -> str:
    """
    Retorna o modelo a usar, em ordem de prioridade:
    1. data/config/models.json — salvo via UI (/settings)
    2. .env override           — MODEL_REFINE, MODEL_STRUCTURE, MODEL_GLOSSARY
    3. Default do provider ativo
    """
    if task not in LLM_TASKS:
        raise ValueError(f"Tarefa LLM desconhecida: '{task}'. Use: {', '.join(LLM_TASKS)}")

    saved = model_config.read_saved().get(task)
    if saved:
        return saved
    override = settings.model_for(task)
    if override:
        return override
    return _DEFAULT_MODEL.get(settings.llm_provider, _DEFAULT_MODEL["openrouter"])


# ─── Providers ────────────────────────────────────────────────────────────────

def _call_openrouter(model: str, system_prompt: str, user_content: str) -> str:
    from openai import OpenAI, RateLimitError

    if not settings.openrouter_api_key:
        raise EnvironmentError("OPENROUTER_API_KEY não configurada.")

    client = OpenAI(
        api_key=settings.openrouter_api_key,
        base_url=settings.openrouter_base_url,
        default_headers={
            "HTTP-Referer": "https://crivo-insights.internal",
            "X-Title": "Crivo Insights",
        },
        timeout=_TIMEOUT_S,
        max_retries=0,  # gerenciamos 429 manualmente abaixo
    )
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user",   "content": user_content},
    ]

    attempts = len(_RATE_LIMIT_DELAYS) + 1
    for attempt in range(1, attempts + 1):
        try:
            resp = client.chat.completions.create(
                model=model, max_tokens=_MAX_TOKENS, messages=messages,
            )
        except RateLimitError:
            if attempt == attempts:
                raise
            delay = _RATE_LIMIT_DELAYS[attempt - 1]
            log.warning("Rate limit (429) — aguardando %ds antes da tentativa %d/%d...",
                        delay, attempt + 1, attempts)
            time.sleep(delay)
            continue

        choice = resp.choices[0]
        if choice.finish_reason == "length":
            log.warning("Resposta truncada pelo limite de %d tokens (modelo %s).", _MAX_TOKENS, model)
        return choice.message.content or ""

    raise RuntimeError("unreachable")  # pragma: no cover — o loop sempre retorna ou levanta


def _call_gemini(model: str, system_prompt: str, user_content: str) -> str:
    import google.generativeai as genai

    if not settings.gemini_api_key:
        raise EnvironmentError("GEMINI_API_KEY não configurada.")

    genai.configure(api_key=settings.gemini_api_key)
    gmodel = genai.GenerativeModel(model_name=model, system_instruction=system_prompt)
    resp = gmodel.generate_content(user_content, request_options={"timeout": _TIMEOUT_S})
    return resp.text


def _call_anthropic(model: str, system_prompt: str, user_content: str) -> str:
    import anthropic

    if not settings.anthropic_api_key:
        raise EnvironmentError("ANTHROPIC_API_KEY não configurada.")

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key, timeout=_TIMEOUT_S)
    msg = client.messages.create(
        model=model,
        max_tokens=_MAX_TOKENS,
        system=system_prompt,
        messages=[{"role": "user", "content": user_content}],
    )
    if msg.stop_reason == "max_tokens":
        log.warning("Resposta truncada pelo limite de %d tokens (modelo %s).", _MAX_TOKENS, model)
    return "".join(block.text for block in msg.content if getattr(block, "type", "") == "text")


_PROVIDERS: dict[str, Callable[[str, str, str], str]] = {
    "openrouter": _call_openrouter,
    "gemini":     _call_gemini,
    "anthropic":  _call_anthropic,
}


# ─── Pontos de entrada ────────────────────────────────────────────────────────

def _invoke(
    label: str,
    provider: str,
    model: str,
    system_prompt: str,
    user_content: str,
    metadata: Optional[dict],
) -> str:
    """Executa uma chamada com log de tempo/tamanho e validação de resposta vazia."""
    fn = _PROVIDERS.get(provider)
    if fn is None:
        raise ValueError(f"Provider desconhecido: '{provider}'. Use {' | '.join(_PROVIDERS)}")

    meta_str = f" [{metadata}]" if metadata else ""
    log.info("LLM call | %s provider=%s model=%s%s | input=%d chars",
             label, provider, model, meta_str, len(user_content))
    t0 = time.perf_counter()
    try:
        result = fn(model, system_prompt, user_content).strip()
        if not result:
            raise RuntimeError("o modelo devolveu uma resposta vazia")
    except Exception as exc:
        log.error("LLM ERRO | %s provider=%s model=%s | %.1fs | %s",
                  label, provider, model, time.perf_counter() - t0, exc)
        raise
    log.info("LLM done | %s %.1fs | output=%d chars", label, time.perf_counter() - t0, len(result))
    return result


def call_with_model(
    provider: str,
    model: str,
    system_prompt: str,
    user_content: str,
    metadata: Optional[dict] = None,
) -> str:
    """
    Chama um (provider, model) específico, ignorando settings.llm_provider.

    Para tarefas que exigem um modelo fixo independentemente da config global —
    caso da análise de nicho, que precisa obrigatoriamente de Claude Sonnet 4.6.
    """
    return _invoke("forced", provider, model, system_prompt, user_content, metadata)


def call(
    task: str,
    system_prompt: str,
    user_content: str,
    metadata: Optional[dict] = None,
) -> str:
    """
    Chama o LLM configurado para a tarefa e retorna o texto gerado.

    task: "refine" | "structure" | "glossary".
    Raises RuntimeError com mensagem clara se o provider falhar.
    """
    provider = settings.llm_provider
    model = resolve_model(task)
    try:
        return _invoke(f"task={task}", provider, model, system_prompt, user_content, metadata)
    except Exception as exc:
        raise RuntimeError(
            f"Falha na etapa '{task}' com provider '{provider}' / modelo '{model}'.\n"
            f"Arquivos anteriores foram preservados. Corrija o erro e reprocesse.\n"
            f"Detalhe: {exc}"
        ) from exc
