@echo off
setlocal
cd /d "%~dp0"

echo === UaiTiCut - gerar instalador (.exe) ===
echo.

where python >nul 2>nul
if errorlevel 1 (
    echo Nao encontrei o Python instalado.
    echo Baixe em https://www.python.org/downloads/ e marque a opcao "Add python.exe to PATH".
    pause
    exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
    echo Preparando o ambiente pela primeira vez, aguarde um instante...
    python -m venv .venv
)

echo Instalando dependencias (inclusive PyInstaller)...
".venv\Scripts\python.exe" -m pip install --quiet --disable-pip-version-check -r requirements.txt pyinstaller
if errorlevel 1 (
    echo Falha ao instalar as dependencias. Verifique sua conexao com a internet.
    pause
    exit /b 1
)

if not exist "bin\ffmpeg.exe" (
    echo.
    echo O ffmpeg ainda nao foi baixado neste projeto.
    echo Rode o run.bat uma vez, deixe o app abrir ^(ele baixa o ffmpeg sozinho^),
    echo feche o app e rode este build_exe.bat de novo.
    pause
    exit /b 1
)

echo.
echo Empacotando (isso demora um pouco, o ffmpeg e o Python vao junto no .exe)...
".venv\Scripts\python.exe" -m PyInstaller --noconfirm UaiTiCut.spec
if errorlevel 1 (
    echo Falha ao gerar o executavel. Veja o erro acima.
    pause
    exit /b 1
)

echo.
echo Pronto! O instalador esta em: dist\UaiTiCut.exe
echo Suba esse arquivo como anexo em uma Release do GitHub (nome do arquivo
echo tem que continuar "UaiTiCut.exe") para o botao de download do site funcionar.
pause
