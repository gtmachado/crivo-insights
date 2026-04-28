"""Interface Streamlit — Interview Insights MVP."""
import httpx
import streamlit as st

BACKEND = "http://localhost:8000"

st.set_page_config(page_title="Interview Insights", page_icon="🎙️", layout="wide")
st.title("🎙️ Interview Insights")
st.caption("Discovery e extração de insights de entrevistas de negócio")

tab_upload, tab_view, tab_consolidate, tab_status = st.tabs(
    ["📤 Nova Entrevista", "📂 Ver Entrevistas", "📊 Consolidar Nicho", "⚙️ Status do Sistema"]
)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _get_niches() -> list[str]:
    try:
        r = httpx.get(f"{BACKEND}/niches/", timeout=5)
        return r.json() if r.is_success else []
    except Exception:
        return []


def _backend_ok() -> bool:
    try:
        httpx.get(f"{BACKEND}/health", timeout=3)
        return True
    except Exception:
        return False


# ─── TAB 1 — Upload ───────────────────────────────────────────────────────────

with tab_upload:
    if not _backend_ok():
        st.error("Backend indisponível. Certifique-se de que o servidor está rodando em http://localhost:8000")
        st.stop()

    st.subheader("Enviar nova entrevista")

    col_niche, col_name = st.columns(2)

    with col_niche:
        existing = _get_niches()
        options = existing + ["➕ Criar novo nicho"]
        choice = st.selectbox("Nicho", options)
        if choice == "➕ Criar novo nicho":
            niche = st.text_input("Nome do novo nicho", placeholder="ex: Clínicas de Estética")
        else:
            niche = choice

    with col_name:
        interview_name = st.text_input(
            "Nome da entrevista",
            placeholder="ex: João Silva — Dono de Clínica",
        )

    uploaded_file = st.file_uploader(
        "Arquivo de áudio ou vídeo",
        type=["mp4", "mkv", "mov", "avi", "webm", "mp3", "m4a", "ogg", "flac", "wav"],
        help="O arquivo original será preservado. O sistema converte automaticamente para WAV.",
    )

    can_submit = bool(niche and niche != "➕ Criar novo nicho" and interview_name and uploaded_file)

    if st.button("🚀 Iniciar pipeline", type="primary", disabled=not can_submit):
        with st.spinner("Enviando arquivo..."):
            files = {"file": (uploaded_file.name, uploaded_file.getvalue(), uploaded_file.type)}
            data = {"niche": niche, "interview_name": interview_name}
            try:
                r = httpx.post(f"{BACKEND}/interviews/upload", files=files, data=data, timeout=120)
                r.raise_for_status()
                job = r.json()
                st.success(f"Pipeline iniciado! **Job ID:** `{job['job_id']}`")
                st.session_state["active_job"] = job["job_id"]
                st.session_state["active_job_niche"] = niche
                st.session_state["active_job_interview"] = interview_name
            except Exception as e:
                st.error(f"Erro ao enviar: {e}")

    # Painel de status do job ativo
    if "active_job" in st.session_state:
        job_id = st.session_state["active_job"]
        st.divider()
        st.subheader(f"Status do pipeline — job `{job_id}`")

        col_status, col_refresh = st.columns([4, 1])
        with col_refresh:
            refresh = st.button("🔄 Atualizar", key="refresh_job")

        if refresh:
            try:
                r = httpx.get(f"{BACKEND}/interviews/status/{job_id}", timeout=10)
                data = r.json()
                status = data.get("status", "?")

                with col_status:
                    if status == "running":
                        st.info("⏳ Processando...")
                    elif status == "done":
                        st.success("✅ Pipeline concluído com sucesso!")
                        st.balloons()
                    elif status == "error":
                        st.error("❌ Erro durante o pipeline")

                with st.expander("Log de execução", expanded=True):
                    for line in data.get("log", []):
                        icon = "✓" if line.startswith("✓") else "›"
                        st.text(f"{icon} {line}")
            except Exception as e:
                st.error(f"Erro ao consultar status: {e}")

        # Estrutura de pastas gerada
        niche_s = st.session_state.get("active_job_niche", "")
        interview_s = st.session_state.get("active_job_interview", "")
        if niche_s and interview_s:
            with st.expander("📁 Estrutura de pastas gerada"):
                slug_n = niche_s.lower().replace(" ", "-")
                slug_i = interview_s.lower().replace(" ", "-")
                st.code(
                    f"data/niches/{slug_n}/{slug_i}/\n"
                    f"  raw/          ← arquivo original preservado\n"
                    f"  processed/    ← audio.wav convertido\n"
                    f"  parts/        ← partes (se o áudio for grande)\n"
                    f"  outputs/      ← 01_transcricao_bruta.md\n"
                    f"                   02_transcricao_refinada.md\n"
                    f"                   03_entrevista_estruturada.md\n"
                    f"  glossary/     ← glossario_local.md",
                    language="text",
                )


# ─── TAB 2 — Visualizar ───────────────────────────────────────────────────────

with tab_view:
    st.subheader("Entrevistas por nicho")

    niches = _get_niches()
    if not niches:
        st.info("Nenhum nicho encontrado. Faça o upload de uma entrevista primeiro.")
    else:
        col_niche_v, col_interview_v = st.columns(2)

        with col_niche_v:
            selected_niche = st.selectbox("Nicho", niches, key="view_niche")

        try:
            r = httpx.get(f"{BACKEND}/interviews/{selected_niche}", timeout=5)
            interviews_list = r.json() if r.is_success else []
        except Exception:
            interviews_list = []

        if not interviews_list:
            st.info("Nenhuma entrevista neste nicho.")
        else:
            with col_interview_v:
                interview_names = [i["name"] for i in interviews_list]
                selected_interview = st.selectbox("Entrevista", interview_names, key="view_interview")

            interview_data = next(i for i in interviews_list if i["name"] == selected_interview)
            stages = interview_data["stages"]

            LABELS = {
                "raw":        "📝 Transcrição Bruta",
                "refined":    "✏️ Transcrição Refinada",
                "structured": "📋 Entrevista Estruturada",
                "glossary":   "📖 Glossário Local",
            }
            available = [k for k, v in stages.items() if v]

            if not available:
                st.warning("Nenhum documento gerado ainda.")
            else:
                doc_choice = st.radio(
                    "Documento",
                    available,
                    format_func=lambda k: LABELS[k],
                    horizontal=True,
                )

                try:
                    r = httpx.get(
                        f"{BACKEND}/interviews/{selected_niche}/{selected_interview}/{doc_choice}",
                        timeout=10,
                    )
                    content = r.json().get("content", "")
                    st.markdown(content)
                except Exception as e:
                    st.error(f"Erro ao carregar documento: {e}")

        # Documentos consolidados do nicho
        st.divider()
        st.subheader(f"Documentos consolidados — {selected_niche if niches else ''}")

        col_ins, col_glos = st.columns(2)
        with col_ins:
            if st.button("📊 Ver Insights Consolidados"):
                try:
                    r = httpx.get(f"{BACKEND}/niches/{selected_niche}/insights", timeout=10)
                    if r.is_success:
                        st.session_state["consolidated_view"] = ("insights", r.json()["content"])
                    else:
                        st.warning("Consolidado de insights ainda não gerado.")
                except Exception as e:
                    st.error(str(e))

        with col_glos:
            if st.button("📖 Ver Glossário do Nicho"):
                try:
                    r = httpx.get(f"{BACKEND}/niches/{selected_niche}/glossary", timeout=10)
                    if r.is_success:
                        st.session_state["consolidated_view"] = ("glossary", r.json()["content"])
                    else:
                        st.warning("Glossário do nicho ainda não gerado.")
                except Exception as e:
                    st.error(str(e))

        if "consolidated_view" in st.session_state:
            kind, content = st.session_state["consolidated_view"]
            label = "Insights Consolidados" if kind == "insights" else "Glossário do Nicho"
            st.markdown(f"### {label}")
            st.markdown(content)


# ─── TAB 3 — Consolidar ───────────────────────────────────────────────────────

with tab_consolidate:
    st.subheader("Gerar documentos consolidados do nicho")
    st.caption(
        "Lê todas as entrevistas do nicho e gera insights cruzados e glossário unificado. "
        "Execute após ter pelo menos 2 entrevistas estruturadas."
    )

    niches_c = _get_niches()
    if not niches_c:
        st.info("Nenhum nicho disponível.")
    else:
        selected_niche_c = st.selectbox("Nicho", niches_c, key="consolidate_niche")

        col_a, col_b = st.columns(2)

        with col_a:
            st.markdown("#### 📊 Insights Consolidados")
            st.caption("Analisa os docs estruturados e gera dores recorrentes, padrões, oportunidades e recomendações de Serviço vs SaaS.")
            if st.button("Gerar insights consolidados", type="primary"):
                try:
                    r = httpx.post(
                        f"{BACKEND}/niches/{selected_niche_c}/consolidate/insights", timeout=10
                    )
                    job = r.json()
                    st.success(f"Iniciado! Job ID: `{job['job_id']}`")
                    st.session_state["cons_job"] = ("insights", selected_niche_c, job["job_id"])
                except Exception as e:
                    st.error(str(e))

        with col_b:
            st.markdown("#### 📖 Glossário do Nicho")
            st.caption("Unifica os glossários locais de todas as entrevistas, resolve duplicatas e enriquece definições.")
            if st.button("Gerar glossário do nicho", type="primary"):
                try:
                    r = httpx.post(
                        f"{BACKEND}/niches/{selected_niche_c}/consolidate/glossary", timeout=10
                    )
                    job = r.json()
                    st.success(f"Iniciado! Job ID: `{job['job_id']}`")
                    st.session_state["cons_job"] = ("glossary", selected_niche_c, job["job_id"])
                except Exception as e:
                    st.error(str(e))

        if "cons_job" in st.session_state:
            kind_c, niche_c, job_id_c = st.session_state["cons_job"]
            label_c = "insights" if kind_c == "insights" else "glossário"
            st.divider()
            if st.button(f"🔄 Verificar status da consolidação de {label_c}"):
                try:
                    r = httpx.get(
                        f"{BACKEND}/niches/{niche_c}/consolidate/status/{job_id_c}", timeout=10
                    )
                    data = r.json()
                    status = data.get("status")
                    if status == "done":
                        st.success(f"✅ Consolidado de {label_c} gerado!")
                        st.info(f"Arquivo salvo em: `{data.get('path')}`")
                        st.caption("Acesse na aba **Ver Entrevistas** para visualizar.")
                    elif status == "error":
                        st.error(f"Erro: {data.get('log')}")
                    else:
                        st.info("⏳ Processando...")
                except Exception as e:
                    st.error(str(e))


# ─── TAB 4 — Status do Sistema ────────────────────────────────────────────────

with tab_status:
    st.subheader("⚙️ Status do Sistema")

    def _check(label, fn):
        try:
            result = fn()
            st.success(f"✅ {label}: {result}")
        except Exception as e:
            st.error(f"❌ {label}: {e}")

    # Backend
    st.markdown("#### Backend")
    try:
        r = httpx.get(f"{BACKEND}/health", timeout=3)
        st.success(f"✅ Backend rodando em {BACKEND}")
    except Exception:
        st.error(f"❌ Backend indisponível em {BACKEND}")

    # Configurações LLM (via endpoint de status)
    st.markdown("#### Configuração LLM")
    try:
        r = httpx.get(f"{BACKEND}/status", timeout=5)
        if r.is_success:
            data = r.json()
            provider = data.get("llm_provider", "?")
            st.info(f"🔌 Provider: **{provider}**")
            api_ok = data.get("api_key_configured", False)
            if api_ok:
                st.success("✅ API Key configurada")
            else:
                st.error("❌ API Key NÃO configurada")
            st.markdown("**Modelos por tarefa:**")
            models = data.get("models", {})
            rows = [(k, v) for k, v in models.items()]
            if rows:
                st.table({"Tarefa": [r[0] for r in rows], "Modelo": [r[1] for r in rows]})
        else:
            st.warning("Endpoint /status não disponível.")
    except Exception as e:
        st.warning(f"Não foi possível obter status LLM: {e}")

    # FFmpeg
    st.markdown("#### FFmpeg")
    try:
        import subprocess
        r2 = subprocess.run(["ffmpeg", "-version"], capture_output=True, text=True, timeout=5)
        first_line = r2.stdout.split("\n")[0]
        st.success(f"✅ {first_line}")
    except FileNotFoundError:
        st.error("❌ FFmpeg não encontrado no PATH. Instale em https://ffmpeg.org/download.html")
    except Exception as e:
        st.error(f"❌ FFmpeg: {e}")

    # Whisper
    st.markdown("#### Whisper")
    try:
        import whisper  # type: ignore
        st.success("✅ openai-whisper instalado")
        try:
            r3 = httpx.get(f"{BACKEND}/status", timeout=3)
            wm = r3.json().get("whisper_model", "?") if r3.is_success else "?"
            st.caption(f"Modelo configurado: `{wm}`")
        except Exception:
            pass
    except ImportError:
        st.error("❌ openai-whisper não instalado. Execute: pip install openai-whisper")
