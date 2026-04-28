@echo off
cd /d "%~dp0"
set PYTHONPATH=.
set PYTHON=C:\Users\geils\AppData\Local\Programs\Python\Python311\python.exe
%PYTHON% -m uvicorn backend.api.main:app --host 0.0.0.0 --port 8000 --reload
