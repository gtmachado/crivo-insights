# Skill: crivo-feature

## Objetivo
Implementar features novas no Crivo Insights de forma incremental e segura.

## Quando usar
- GSD-002: Metadata de entrevista (título, entrevistado, entrevistador, telefone, e-mail)
- GSD-003: Refine com separação de participantes (Entrevistador / Entrevistado / Não identificado)
- GSD-006: Ajuste de glossário (nível de detalhe, edição de markdown, remoção de sidebar)
- GSD-008: Limpeza da análise de nicho (seleção on-demand, substituição de consolidação)
- Qualquer endpoint FastAPI novo ou componente React novo

---

## Regras Obrigatórias

1. **Ler CLAUDE.md antes de começar.**
2. **Listar arquivos relevantes** com Read/Glob antes de qualquer edição.
3. **Propor plano e aguardar aprovação** antes de escrever código.
4. **Um bloco GSD por vez.** Não avançar sem autorização.
5. **Nunca modificar `pipeline.py`.**
6. **Sem `asChild` em Button.**
7. **Tailwind v4:** só `@theme inline {}` em `globals.css`, sem `tailwind.config.js`.
8. **Python:** `C:\Users\geils\AppData\Local\Programs\Python\Python311\python.exe`
9. **Validar ao fim:** `py_compile` + `npm run build`.

---

## Passos Padrão

### A — Leitura e planejamento
1. Ler o GSD do bloco pedido em `docs/gsd/01_correcoes_prioritarias.md`
2. Ler os arquivos listados em "arquivos prováveis" do GSD
3. Montar plano: endpoints novos, tipos TS, componentes, rotas
4. Apresentar o plano com impacto em arquivos existentes
5. **Aguardar "pode começar"**

### B — Backend (se necessário)
```powershell
# Depois de editar:
& "C:\Users\geils\AppData\Local\Programs\Python\Python311\python.exe" -m py_compile <arquivo.py>
```

Checklist:
- [ ] `BaseModel` Pydantic para body de POST/PUT
- [ ] `HTTPException` com código correto (400, 404, 422)
- [ ] Background task para ops longas → retornar `{job_id}`
- [ ] `_is_private_dirname()` se listar diretórios
- [ ] `interview_path()` (sem criar dirs) ou `interview_dir()` (cria dirs)

### C — API client (frontend)
Adicionar em `lib/api.ts`:
```ts
// Tipo
export type MeuTipo = { campo: string };

// Função
export const minhaFuncao = (niche: string) =>
  api.get<MeuTipo>(`/rota/${encodeURIComponent(niche)}`).then(r => r.data);
```

### D — Componentes React
Checklist:
- [ ] `"use client"` apenas onde há interatividade
- [ ] `useQuery` para GET, `useMutation` para POST/PUT/DELETE
- [ ] `toast.success/error` no `onSuccess`/`onError`
- [ ] `invalidateQueries` após mutação
- [ ] Polling: `refetchInterval: (q) => q.state.data?.status === "running" ? 2000 : false`
- [ ] Classe `.glass` em painéis novos
- [ ] `.gradient-bg text-white` em botões primários
- [ ] `.crivo-prose` em containers de markdown

### E — Validação final
```powershell
& "C:\Users\geils\AppData\Local\Programs\Python\Python311\python.exe" -m py_compile `
  backend/api/main.py `
  backend/api/routes/interviews.py `
  backend/api/routes/niches.py `
  backend/storage/filesystem.py

cd frontend-next; npm run build
```

---

## Guia por Bloco GSD

### GSD-002 — Metadata de Entrevista ✅ Concluído (2026-05-01)

**O que foi construído:**
1. Backend: `metadata.json` por entrevista — salvo de forma síncrona no upload
2. Backend: `GET /interviews/{niche}/{interview}/meta` + `PUT /interviews/{niche}/{interview}/meta`
3. Frontend: card "Participantes" no upload + painel `InterviewMeta` na entrevista

**Schema real de `metadata.json`:**
```json
{
  "title": "",
  "niche": "",
  "interview_slug": "",
  "interviewee_name": "",
  "interviewee_phone": "",
  "interviewee_email": "",
  "interviewer_name": "",
  "interviewer_user_id": "",
  "notes": "",
  "created_at": "2026-05-01T00:00:00+00:00",
  "source_filename": "",
  "updated_at": ""
}
```
> `interviewer_user_id` reservado para Supabase Auth (BL-007). Campo no form é texto livre.

**Arquivos implementados:**
- `backend/storage/filesystem.py` — `read_meta()`, `write_meta()`, `META_FILENAME`
- `backend/api/routes/interviews.py` — `InterviewMetaUpdate` + endpoints + upload
- `frontend-next/src/lib/api.ts` — `InterviewMeta`, `UploadMetadata`, funções
- `frontend-next/src/components/interview/InterviewMeta.tsx` — form novo

---

### GSD-003 — Refine com Separação de Participantes

**O que construir:**
1. Atualizar o prompt de refine para formatar como diálogo com 3 roles:
   ```
   **Entrevistador:** [fala]
   **Entrevistado:** [fala]
   **Falante não identificado:** [fala]
   ```
2. O prompt DEVE injetar os nomes reais do `metadata.json` quando disponíveis
3. Nunca inventar falas — se não souber o falante, usar "Falante não identificado"

**Atenção — investigar antes de prescrever:**
O prompt de refine está em `pipeline.py`. **Ler o arquivo primeiro** para entender
onde está e como é chamado. Preferir a solução com menor número de arquivos novos.
Só criar `refine_service.py` se não houver alternativa menos invasiva.

**Arquivos a investigar (ler antes de editar):**
- `backend/core/pipeline.py` — **ler apenas**: onde está o prompt de refine?
- `backend/prompts/refine.md` — criar com prompt novo
- `backend/storage/filesystem.py` — `read_meta()` já disponível (lê `metadata.json`)
- `backend/api/routes/interviews.py` — interceptar se necessário
- `backend/services/refine_service.py` — criar **somente se necessário**

---

### GSD-006 — Ajuste de Glossário

**O que construir:**
1. Glossário do nicho com mesmo nível de detalhe do glossário da entrevista: definição + exemplo + relacionados
2. Permitir edição do markdown do glossário (adicionar `"glossary"` ao `_EDITABLE_DOCS`)
3. Remover `GlossaryPanel` da sidebar da página de entrevista (simplificar UI)

**Arquivos prováveis:**
- `backend/api/routes/interviews.py` — `_EDITABLE_DOCS`
- `frontend-next/src/lib/api.ts` — `EditableDocType`
- `frontend-next/src/lib/files.ts` — `FILENAME_TO_DOC`
- `frontend-next/src/app/(app)/nicho/[nicho]/[entrevista]/page.tsx` — remover GlossaryPanel
- `backend/services/consolidator.py` — melhorar consolidação de glossário de nicho

---

### GSD-008 — Limpeza da Análise de Nicho

**O que construir:**
1. Seleção de entrevistas aparece SOMENTE ao clicar "Analisar nicho" (não visível por padrão)
2. Renomear "Consolidação de insights" → remover ou rebaixar para ação secundária
3. Manter apenas dois fluxos: "Extrair insights" (por entrevista) e "Analisar nicho" (múltiplas)
4. Limpar ambiguidade de nomenclatura na UI

**Arquivos prováveis:**
- `frontend-next/src/app/(app)/nicho/[nicho]/page.tsx` — principal
- `frontend-next/src/components/niche/AnalyzeNicheButton.tsx`
- `frontend-next/src/components/niche/NicheAnalysisTab.tsx`

---

## Padrões de Código

### Endpoint FastAPI novo
```python
@router.get("/{niche}/{interview}/meta")
def get_interview_meta(niche: str, interview: str):
    try:
        return read_meta(niche, interview)
    except FileNotFoundError:
        return {}  # meta não criado ainda — retornar vazio, não 404

@router.put("/{niche}/{interview}/meta")
def update_interview_meta(niche: str, interview: str, body: MetaUpdate):
    write_meta(niche, interview, body.model_dump())
    return {"ok": True}
```

### Componente com polling
```tsx
const { data, isLoading } = useQuery({
  queryKey: ["minha-feature", niche],
  queryFn: () => minhaFuncaoApi(niche),
  refetchInterval: (query) =>
    query.state.data?.status === "running" ? 2000 : false,
});
```

### Botão primário (sem asChild)
```tsx
<Button
  className="gradient-bg text-white border-0 hover:opacity-90 glow-soft"
  onClick={handleClick}
>
  Ação
</Button>
```

---

## Relatório de Fim de Bloco

Entregar sempre:
1. **GSD implementado** (ID + nome)
2. **Arquivos alterados** (lista exata)
3. **Como testar** (passos concretos)
4. **Pendências / próximo GSD sugerido**
