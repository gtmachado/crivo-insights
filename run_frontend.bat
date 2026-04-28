@echo off
cd /d "%~dp0"
set PYTHONPATH=.
set PYTHON=C:\Users\geils\AppData\Local\Programs\Python\Python311\python.exe
%PYTHON% -m streamlit run frontend/app.py --server.port 8501
