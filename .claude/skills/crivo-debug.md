# Skill: crivo-debug

## Objetivo
Diagnosticar e corrigir bugs específicos no Crivo Insights (backend ou frontend).

## Quando usar
- Player de áudio/vídeo não toca ou mostra duração 0 (GSD-001)
- Erro de build TypeScript ou Python
- Exceção FastAPI (500, 404 inesperado)
- Componente React não renderiza ou exibe dados errados
- Job de pipeline travado em "running"
- Qualquer comportamento incorreto em produção/dev

---

## Regras Obrigatórias

1. **Diagnóstico antes do patch** — entender a causa antes de alterar qualquer arquivo.
2. **Listar arquivos relevantes** com Read/Glob antes de editar.
3. **Menor patch possível** — não refatorar o que não está quebrado.
4. **Nunca modificar `pipeline.py`** — bugs de pipeline vão em `interviews.py`.
5. **`py_compile` em todo `.py` tocado** antes de entregar.
6. **`npm run build` no frontend** se qualquer `.tsx/.ts` foi alterado.
7. **Não implementar features** durante bug fix — registrar no GSD se descobrir algo.

---

## Caso Principal: GSD-001 — Player de Mídia

### Sintoma
Player aparece (controles visíveis), mas ao clicar em play:
- Duração exibe 0:00
- Barra de progresso vazia
- Áudio/vídeo não toca

### Causas identificadas e status

| Causa | Arquivo | Status |
|-------|---------|--------|
| CORS sem `expose_headers` → browser não lê `Content-Range` cross-origin → duração = 0 | `backend/api/main.py` | ✅ Corrigido |
| `FileResponse(filename=...)` → `Content-Disposition: attachment` → browser tenta baixar em vez de stream | `backend/api/main.py` | ✅ Corrigido |

### Fix aplicado (2026-05-01)

```python
# main.py — CORSMiddleware
expose_headers=["Content-Range", "Accept-Ranges", "Content-Length", "Content-Disposition"],

# main.py — FileResponse
content_disposition_type="inline",  # removido filename=filename
```

### Se ainda não funcionar após o fix

Verificar na ordem:

1. **Backend reiniciado?** CORS middleware só carrega no boot.

2. **Arquivo existe no disco?**
   ```
   data/niches/{nicho}/{entrevista}/raw/     ← original
   data/niches/{nicho}/{entrevista}/processed/ ← WAV
   ```
   Se processed/ vazio → pipeline não rodou a etapa `convert`.

3. **URL gerada corretamente?**
   Abrir DevTools → Network → copiar a URL do request `/media/...`.
   - Deve ter `?token=...` se `API_SECRET` estiver configurado
   - Deve ter `?ngrok-skip-browser-warning=true`
   - Deve retornar 206 (Partial Content), não 200 nem 401 nem 404

4. **MIME type correto?**
   Verificar `Content-Type` no response. Deve ser `audio/wav`, `audio/mpeg`, `video/mp4`, etc.
   Formatos suportados no `_MIME_MAP` em `main.py`:
   - Áudio: `.wav`, `.mp3`, `.m4a`, `.aac`, `.ogg`, `.oga`, `.flac`, `.opus`
   - Vídeo: `.mp4`, `.m4v`, `.mkv`, `.mov`, `.avi`, `.webm`

5. **Formato suportado pelo browser?**
   `.mkv` e `.avi` não funcionam no Safari. `.webm` não funciona no iOS.
   Solução: servir o `.wav` do processed/ (sempre disponível após pipeline).

6. **Token vazio causando 401?**
   `mediaUrl()` só adiciona `?token=` se `getApiSecret()` retornar string não-vazia.
   Se backend sem `API_SECRET`, `verify_token()` passa sem token. OK.
   Se backend com `API_SECRET` mas settings vazias no frontend → 401.

---

## Tabela Geral de Erros Comuns

| Sintoma | Causa provável | Arquivo | Solução |
|---------|---------------|---------|---------|
| `Button` não aceita prop | `asChild` não existe no shadcn 4.5 | componente | Remover `asChild`, usar `<Link className>` puro |
| `_tmp` aparece como nicho | `list_niches()` sem filtro | `filesystem.py` | `_is_private_dirname()` já está implementado — checar se está sendo chamado |
| Áudio/vídeo 401 | Tag não envia `Authorization` | `api.ts` / `main.py` | `mediaUrl()` deve incluir `?token=...` |
| Job nunca sai de "running" | Exceção silenciosa em background task | `routes/niches.py` | Checar `_jobs[job_id]["log"]` no endpoint de status |
| Stage sempre "pending" | Prefixo de mensagem não casa com `_STAGE_TRIGGERS` | `interviews.py` | Adicionar `print(msg)` temporário em `_classify_stage()` |
| Hydration mismatch de tema | `<html>` sem `suppressHydrationWarning` | `layout.tsx` raiz | Adicionar a prop |
| Componente some no print | Layout pai renderiza Sidebar | `(app)/layout.tsx` | Detecta `/print/` via regex — verificar se path bate |
| Build falha `Module not found` | Import relativo errado ou arquivo não criado | TS error | Ler a linha exata do erro, ajustar path |
| `getNicheAnalysis` retorna 404 | Arquivo `analise_{slug}.md` não existe | `niches.py` / disco | Verificar se o job de análise concluiu com sucesso |

---

## Passos de Debug (roteiro padrão)

### 1. Reproduzir e coletar contexto
- Qual erro exato? (mensagem, HTTP status, console do browser)
- Qual ação disparou? (upload, play, clique em botão...)
- Ocorre sempre ou intermitente?

### 2. Localizar o arquivo suspeito
```powershell
# Grep para encontrar onde algo é definido
# (usar ferramenta Grep, não comando direto)
```

### 3. Ler o arquivo antes de editar
Sempre usar Read tool antes de Edit. Nunca editar às cegas.

### 4. Aplicar o menor patch possível

### 5. Validar
```powershell
# Python
& "C:\Users\geils\AppData\Local\Programs\Python\Python311\python.exe" -m py_compile <arquivo.py>

# Frontend (se tocou .tsx/.ts)
cd frontend-next; npm run build
```

---

## Relatório de Fim de Debug

Entregar sempre:
1. **Causa encontrada** (arquivo + linha + por quê)
2. **Arquivos alterados** (lista exata)
3. **Como testar** (passos concretos)
4. **Pendências** (o que ficou fora do escopo)
