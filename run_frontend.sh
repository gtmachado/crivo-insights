#!/bin/bash
# Inicia o frontend Streamlit
cd "$(dirname "$0")"
export PYTHONPATH=.
streamlit run frontend/app.py --server.port 8501
