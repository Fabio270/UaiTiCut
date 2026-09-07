@echo off
setlocal
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
    echo Nao encontrei o Python instalado.
    echo Baixe em https://www.python.org/downloads/ e marque a opcao "Add python.exe to PATH".
    pause
    exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
    echo Preparando o UaiTiCut pela primeira vez, aguarde um instante...
    python -m venv .venv
)

echo Verificando dependencias...
".venv\Scripts\python.exe" -m pip install --quiet --disable-pip-version-check -r requirements.txt
if errorlevel 1 (
    echo.
    echo Falha ao instalar as dependencias. Verifique sua conexao com a internet.
    pause
    exit /b 1
)

start "" ".venv\Scripts\pythonw.exe" app.py
