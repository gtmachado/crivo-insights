@echo off
REM ── Sobe backend + frontend Next.js localmente (sem ngrok), cada um em sua janela ──
cd /d "%~dp0"

echo.
echo  Crivo Insights (local)
echo    Backend  http://localhost:8000
echo    Frontend http://localhost:3000
echo.

start "Crivo Backend"  cmd /k "cd /d %~dp0 && run_backend.bat"
timeout /t 3 /nobreak > nul
start "Crivo Frontend" cmd /k "cd /d %~dp0frontend-next && npm run dev"

echo Abra http://localhost:3000 (aguarde alguns segundos o frontend compilar).
echo Feche as janelas individuais para parar cada servico.
