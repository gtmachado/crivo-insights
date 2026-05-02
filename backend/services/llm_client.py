"""
Camada unificada de acesso a LLMs.

Suporta:
  - OpenRouter  (padrão) — compatível com OpenAI Chat Completions
  - Gemini      — via google-generativeai SDK
  - Anthropic   — fallback opcional

Uso:
    from backend.services.llm_client import call

    text = call(
        task="refine",
        system_prompt="...",
        user_content="...",
    )
"""
import time
import logging
from typing import Optional

from backend.core.config import settings

log = logging.getLogger("llm_client")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s — %(message)s",
    datefmt="%H:%M:%S",
)

# ─── Defaults por tarefa ───────────────────────────────────────────────────────
# Modelos gratuitos ou baratos do OpenRouter (abril 2025)
_OPENROUTER_DEFAULTS: dict[str, str] = {
    # Todas as etapas LLM usam Sonnet 4.6 para máxima qualidade de transcrição e análise.
    # Para reduzir custo, sobrescreva via .env: model_refine, model_glossary, etc.
    "refine":               "anthropic/claude-sonnet-4.6",
    "glossary":             "anthropic/claude-sonnet-4.6",
    "consolidate_glossary": "anthropic/claude-sonnet-4.6",
    "structure":            "anthropic/claude-sonnet-4.6",
    "consolidate":          "anthropic/claude-sonnet-4.6",
}

# Modelos que NÃO suportam system prompt separado (ex: Gemma via Google AI Studio)
# O client vai mesclar system+user em uma única mensagem de usuário
_NO_SYSTEM_PROMPT_MODELS = {
    "google/gemma-3-4b-it:free",
    "google/gemma-3-12b-it:free",
    "google/gemma-3-27b-it:free",
    "google/gemma-4-26b-a4b-it:free",
    "google/gemma-4-31b-it:free",
    "google/gemma-3n-e2b-it:free",
    "google/gemma-3n-e4b-it:free",
}

_GEMINI_DEFAULTS: dict[str, str] = {
    "refine":               "gemini-2.0-flash",
    "glossary":             "gemini-2.0-flash",
    "structure":            "gemini-2.0-flash",
    "consolidate":          "gemini-2.0-flash",
    "consolidate_glossary": "gemini-2.0-flash",
}

_ANTHROPIC_DEFAULTS: dict[str, str] = {
    "refine":               "claude-sonnet-4-6",
    "glossary":             "claude-sonnet-4-6",
    "structure":            "claude-sonnet-4-6",
    "consolidate":          "claude-sonnet-4-6",
    "consolidate_glossary": "claude-sonnet-4-6",
}

_MAX_TOKENS = 8192


def _resolve_model(task: str) -> str:
    """Retorna o modelo a usar: .env tem prioridade, senão usa default do provider."""
    override = settings.model_for(task)
    if override:
        return override
    provider = settings.llm_provider
    if provider == "gemini":
        return _GEMINI_DEFAULTS.get(task, "gemini-2.0-flash")
    if provider == "anthropic":
        return _ANTHROPIC_DEFAULTS.get(task, "claude-haiku-4-5")
    return _OPENROUTER_DEFAULTS.get(task, "mistralai/mistral-7b-instruct:free")


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
        max_retries=0,  # gerenciamos manualmente abaixo
    )

    # Alguns modelos (ex: Gemma via Google AI Studio) não aceitam system prompt separado
    if model in _NO_SYSTEM_PROMPT_MODELS:
        messages = [{"role": "user", "content": f"{system_prompt}\n\n---\n\n{user_content}"}]
    else:
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_content},
        ]

    delays = [5, 15, 30]  # segundos entre tentativas em caso de 429
    last_exc = None
    for attempt, delay in enumerate([0] + delays, 1):
        if delay:
            log.warning("Rate limit (429) — aguardando %ds antes da tentativa %d/%d...", delay, attempt, len(delays)+1)
            time.sleep(delay)
        try:
            resp = client.chat.completions.create(
                model=model,
                max_tokens=_MAX_TOKENS,
                messages=messages,
            )
            return resp.choices[0].message.content.strip()
        except RateLimitError as e:
            last_exc = e
            if attempt == len(delays) + 1:
                raise
            continue

    raise last_exc


def _call_gemini(model: str, system_prompt: str, user_content: str) -> str:
    import google.generativeai as genai

    if not settings.gemini_api_key:
        raise EnvironmentError("GEMINI_API_KEY não configurada.")

    genai.configure(api_key=settings.gemini_api_key)
    gmodel = genai.GenerativeModel(
        model_name=model,
        system_instruction=system_prompt,
    )
    resp = gmodel.generate_content(user_content)
    return resp.text.strip()


def _call_anthropic(model: str, system_prompt: str, user_content: str) -> str:
    import anthropic

    if not settings.anthropic_api_key:
        raise EnvironmentError("ANTHROPIC_API_KEY não configurada.")

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    msg = client.messages.create(
        model=model,
        max_tokens=_MAX_TOKENS,
        system=system_prompt,
        messages=[{"role": "user", "content": user_content}],
    )
    return msg.content[0].text.strip()


# ─── Ponto de entrada ─────────────────────────────────────────────────────────

def call_with_model(
    provider: str,
    model: str,
    system_prompt: str,
    user_content: str,
    metadata: Optional[dict] = None,
) -> str:
    """
    Chama um (provider, model) específico, ignorando settings.llm_provider.

    Útil quando uma tarefa exige um modelo fixo independentemente da config
    global do projeto — caso típico: análise de nicho que precisa
    obrigatoriamente de Claude Sonnet 4.6.
    """
    meta_str = f" [{metadata}]" if metadata else ""
    log.info(
        "LLM call_with_model | provider=%-12s model=%s%s | input=%d chars",
        provider, model, meta_str, len(user_content),
    )
    t0 = time.perf_counter()
    try:
        if provider == "openrouter":
            result = _call_openrouter(model, system_prompt, user_content)
        elif provider == "anthropic":
            result = _call_anthropic(model, system_prompt, user_content)
        elif provider == "gemini":
            result = _call_gemini(model, system_prompt, user_content)
        else:
            raise ValueError(f"Provider desconhecido: '{provider}'.")

        elapsed = time.perf_counter() - t0
        log.info(
            "LLM done (forced) | provider=%-12s model=%s | %.1fs | output=%d chars",
            provider, model, elapsed, len(result),
        )
        return result
    except Exception as exc:
        elapsed = time.perf_counter() - t0
        log.error(
            "LLM ERRO (forced) | provider=%s model=%s | %.1fs | %s",
            provider, model, elapsed, exc,
        )
        raise


def call(
    task: str,
    system_prompt: str,
    user_content: str,
    metadata: Optional[dict] = None,
) -> str:
    """
    Chama o LLM configurado para a tarefa e retorna o texto gerado.

    Parâmetros:
        task          — "refine" | "structure" | "glossary" | "consolidate" | "consolidate_glossary"
        system_prompt — prompt de sistema (carregado do arquivo .md pelo service)
        user_content  — conteúdo do usuário (transcrição, docs etc.)
        metadata      — dict opcional para logging (ex: {"interview": "João Silva"})

    Raises:
        RuntimeError  — com mensagem clara se o provider falhar
    """
    provider = settings.llm_provider
    model = _resolve_model(task)
    meta_str = f" [{metadata}]" if metadata else ""

    log.info(
        "LLM call | task=%-22s provider=%-12s model=%s%s | input=%d chars",
        task, provider, model, meta_str, len(user_content),
    )
    t0 = time.perf_counter()

    try:
        if provider == "openrouter":
            result = _call_openrouter(model, system_prompt, user_content)
        elif provider == "gemini":
            result = _call_gemini(model, system_prompt, user_content)
        elif provider == "anthropic":
            result = _call_anthropic(model, system_prompt, user_content)
        else:
            raise ValueError(f"Provider desconhecido: '{provider}'. Use openrouter | gemini | anthropic")

        elapsed = time.perf_counter() - t0
        log.info(
            "LLM done  | task=%-22s %.1fs | output=%d chars",
            task, elapsed, len(result),
        )
        return result

    except Exception as exc:
        elapsed = time.perf_counter() - t0
        log.error(
            "LLM ERRO  | task=%-22s provider=%s model=%s | %.1fs | %s",
            task, provider, model, elapsed, exc,
        )
        raise RuntimeError(
            f"Falha na etapa '{task}' com provider '{provider}' / modelo '{model}'.\n"
            f"Arquivos anteriores foram preservados. Corrija o erro e reprocesse.\n"
            f"Detalhe: {exc}"
        ) from exc
