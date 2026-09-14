# UaiTiCut ✂️🎵

Cole a URL de um vídeo do YouTube, veja o vídeo, escolha o trecho que quer
(ou baixe inteiro) e salve o áudio em MP3 na pasta que você escolher.

## Como usar

### Opção 1 — Instalador pronto (recomendado para quem só quer usar)

Baixe o `UaiTiCut.exe` na [página de Releases](https://github.com/Fabio270/UaiTiCut/releases/latest)
(ou pelo botão de download no [site](https://fabio270.github.io/UaiTiCut/)) e dê
dois cliques. Não precisa instalar Python — o executável já vem com tudo
embutido (Python, dependências e o próprio ffmpeg).

Como o instalador ainda não tem certificado de assinatura digital, o Windows
pode mostrar o aviso **"O Windows protegeu o computador"** na primeira vez.
Isso é esperado para apps novos e independentes — clique em **Mais
informações → Executar assim mesmo**.

### Opção 2 — Rodando a partir do código-fonte (modo desenvolvedor)

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

## Gerando o instalador (.exe) de novo

Depois de alterar o código, gere um novo `UaiTiCut.exe` com:

```
build_exe.bat
```

Ele empacota tudo (Python, dependências e o ffmpeg que já estiver em `bin/`)
num único executável em `dist\UaiTiCut.exe`, usando o `UaiTiCut.spec`. Suba
esse arquivo como anexo de uma nova Release no GitHub — mantendo o nome
exatamente `UaiTiCut.exe` — para o botão de download do site continuar
funcionando sem precisar editar nada.

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
