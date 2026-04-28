@echo off
REM ── Sobe backend + ngrok + frontend Next.js em janelas separadas ─────────────
cd /d "%~dp0"

echo.
echo ============================================================
echo  Crivo Insights - Iniciando ambiente de desenvolvimento
echo ============================================================
echo.
echo  Sera aberta uma janela para cada servico:
echo    1. Backend FastAPI    (http://localhost:8000)
echo    2. Tunel ngrok        (URL publica nova - copie para /settings)
echo    3. Frontend Next.js   (http://localhost:3000)
echo.
echo  IMPORTANTE: a URL do ngrok muda a cada sessao (conta gratuita).
echo  Copie a URL "Forwarding" exibida na janela do ngrok e cole em
echo  /settings dentro do app (tanto local como no Vercel).
echo ============================================================
echo.
pause

start "Crivo Backend"  cmd /k "cd /d %~dp0 && run_backend.bat"
timeout /t 3 /nobreak > nul

start "Crivo ngrok"    cmd /k "ngrok http 8000"
timeout /t 2 /nobreak > nul

start "Crivo Frontend" cmd /k "cd /d %~dp0\frontend-next && npx next dev"

echo.
echo Tudo iniciado. Feche as janelas individuais para parar cada servico.
echo.
