# UaiTiCut ✂️🎵

Cole a URL de um vídeo do YouTube, veja o vídeo, escolha o trecho que quer
(ou baixe inteiro) e salve o áudio em MP3 na pasta que você escolher.

## Como usar

1. Dê dois cliques em **`run.bat`**.
   - Na primeira vez, ele cria um ambiente Python isolado (`.venv`), instala
     as duas dependências (`pywebview`, `yt-dlp`) e baixa automaticamente um
     `ffmpeg` portátil (usado para cortar e converter para MP3). Isso só
     acontece uma vez e precisa de internet.
   - Nas próximas vezes, abre direto.
2. Cole a URL do YouTube e clique em **Carregar vídeo**.
3. Assista o vídeo dentro do próprio app. Use os controles do trecho para
   marcar onde começa e termina o corte (dá pra digitar o tempo `mm:ss`,
   arrastar a barra, ou clicar em **Marcar aqui** enquanto o vídeo toca).
4. Escolha a pasta de destino (a última pasta usada já vem selecionada nas
   próximas vezes).
5. Clique em **Baixar MP3** e acompanhe o progresso.

O arquivo final é um `.mp3` salvo direto na pasta escolhida.

## Requisitos

- Windows 10/11.
- [Python 3.10+](https://www.python.org/downloads/) instalado (marque **Add
  python.exe to PATH** no instalador).
- Internet (para carregar o vídeo e baixar o áudio).

## Onde ficam as coisas

- `run.bat` — inicia o app (cria o ambiente na primeira vez).
- `app.py` — lógica de download/corte/conversão (Python + yt-dlp + ffmpeg).
- `web/` — a interface visual (HTML/CSS/JS), exibida numa janela nativa via
  [pywebview](https://pywebview.flowrl.com/).
- `bin/` — onde o `ffmpeg.exe`/`ffprobe.exe` portáteis ficam depois de
  baixados.
- A última pasta escolhida fica salva em
  `%APPDATA%\UaiTiCut\config.json`.

## Uso responsável

Baixe apenas conteúdo que você tem direito de baixar (vídeos próprios, de
domínio público ou com licença que permita). Respeite os Termos de Serviço
do YouTube e direitos autorais de terceiros.
