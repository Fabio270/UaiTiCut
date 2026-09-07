"""
UaiTiCut - baixa um trecho (ou o video inteiro) de uma URL do YouTube como MP3.

Interface (web/) roda dentro de uma janela nativa via pywebview.
Este arquivo e' o "backend": resolve a URL, baixa com yt-dlp, corta/converte
com ffmpeg (baixado automaticamente na primeira execucao) e lembra a ultima
pasta escolhida pelo usuario.
"""

import json
import os
import sys
import shutil
import tempfile
import threading
import traceback
import urllib.request
import zipfile
from pathlib import Path

import webview
import yt_dlp

APP_DIR = Path(__file__).resolve().parent
BIN_DIR = APP_DIR / "bin"
FFMPEG_EXE = BIN_DIR / "ffmpeg.exe"
FFPROBE_EXE = BIN_DIR / "ffprobe.exe"

# yt-dlp checa disponibilidade do ffmpeg via PATH em alguns pontos internos
# (alem da opcao ffmpeg_location), entao garantimos os dois caminhos.
os.environ["PATH"] = str(BIN_DIR) + os.pathsep + os.environ.get("PATH", "")

CONFIG_DIR = Path(os.environ.get("APPDATA", str(Path.home()))) / "UaiTiCut"
CONFIG_FILE = CONFIG_DIR / "config.json"

FFMPEG_ZIP_URL = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"


# --------------------------------------------------------------------------
# Configuracao (lembrar a ultima pasta usada)
# --------------------------------------------------------------------------

def default_folder() -> str:
    downloads = Path.home() / "Downloads"
    if downloads.is_dir():
        return str(downloads)
    return str(Path.home())


def load_config() -> dict:
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def save_config(data: dict) -> None:
    try:
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception:
        pass


# --------------------------------------------------------------------------
# ffmpeg portatil (baixado uma unica vez, fica em bin/)
# --------------------------------------------------------------------------

def ffmpeg_ready() -> bool:
    return FFMPEG_EXE.exists() and FFPROBE_EXE.exists()


def ensure_ffmpeg(progress_cb=None) -> bool:
    """Garante que bin/ffmpeg.exe e bin/ffprobe.exe existem, baixando um
    build portatil oficial (gyan.dev) se necessario. progress_cb(percent, msg)."""
    if ffmpeg_ready():
        return True

    def report(percent, msg):
        if progress_cb:
            try:
                progress_cb(percent, msg)
            except Exception:
                pass

    BIN_DIR.mkdir(parents=True, exist_ok=True)
    tmp_zip = None
    try:
        report(0, "Baixando ffmpeg (uma vez so)...")
        fd, tmp_zip = tempfile.mkstemp(suffix=".zip")
        os.close(fd)

        req = urllib.request.Request(FFMPEG_ZIP_URL, headers={"User-Agent": "UaiTiCut/1.0"})
        with urllib.request.urlopen(req, timeout=60) as resp, open(tmp_zip, "wb") as out:
            total = resp.headers.get("Content-Length")
            total = int(total) if total else None
            read = 0
            chunk = 1024 * 256
            while True:
                block = resp.read(chunk)
                if not block:
                    break
                out.write(block)
                read += len(block)
                if total:
                    pct = int(read / total * 90)  # deixa 90-100% para extracao
                    report(pct, "Baixando ffmpeg (uma vez so)...")

        report(92, "Extraindo ffmpeg...")
        with zipfile.ZipFile(tmp_zip) as zf:
            names = zf.namelist()
            ffmpeg_entry = next((n for n in names if n.replace("\\", "/").endswith("bin/ffmpeg.exe")), None)
            ffprobe_entry = next((n for n in names if n.replace("\\", "/").endswith("bin/ffprobe.exe")), None)
            if not ffmpeg_entry or not ffprobe_entry:
                raise RuntimeError("Nao encontrei ffmpeg.exe/ffprobe.exe dentro do pacote baixado.")
            with zf.open(ffmpeg_entry) as src, open(FFMPEG_EXE, "wb") as dst:
                shutil.copyfileobj(src, dst)
            with zf.open(ffprobe_entry) as src, open(FFPROBE_EXE, "wb") as dst:
                shutil.copyfileobj(src, dst)

        report(100, "ffmpeg pronto!")
        return True
    except Exception as e:
        report(None, f"Falha ao preparar o ffmpeg: {e}")
        return False
    finally:
        if tmp_zip and os.path.exists(tmp_zip):
            try:
                os.remove(tmp_zip)
            except Exception:
                pass


def fmt_hms(seconds: float) -> str:
    seconds = max(0, int(round(seconds or 0)))
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    return f"{h:02d}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"


# --------------------------------------------------------------------------
# API exposta ao JavaScript (window.pywebview.api.*)
# --------------------------------------------------------------------------

class Api:
    def __init__(self):
        self.window = None

    # ---- ciclo de vida / setup -------------------------------------------------
    def get_config(self):
        cfg = load_config()
        return {
            "last_folder": cfg.get("last_folder") or default_folder(),
            "ffmpeg_ready": ffmpeg_ready(),
        }

    def prepare_ffmpeg(self):
        """Chamado uma vez, apos a janela carregar. Baixa o ffmpeg se preciso,
        empurrando progresso via onSetupStatus(...) no JS."""
        def cb(percent, msg):
            self._push("onSetupStatus", {"done": False, "percent": percent, "message": msg})

        if ffmpeg_ready():
            self._push("onSetupStatus", {"done": True, "cached": True})
            return

        ok = ensure_ffmpeg(cb)
        self._push("onSetupStatus", {"done": ok, "error": None if ok else "Nao foi possivel preparar o ffmpeg automaticamente."})

    # ---- video -------------------------------------------------------------
    def load_video(self, url):
        url = (url or "").strip()
        if not url:
            return {"error": "Cole uma URL do YouTube."}
        try:
            opts = {
                "quiet": True,
                "no_warnings": True,
                "noplaylist": True,
                "skip_download": True,
            }
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=False)
            if not info or not info.get("id"):
                return {"error": "Nao consegui reconhecer esse video."}
            return {
                "id": info.get("id"),
                "title": info.get("title") or "Video sem titulo",
                "duration": info.get("duration"),  # segundos, pode ser None
                "duration_str": fmt_hms(info.get("duration")) if info.get("duration") else None,
            }
        except Exception as e:
            return {"error": f"Nao foi possivel carregar esse video ({e})."}

    # ---- pasta ---------------------------------------------------------------
    def choose_folder(self):
        cfg = load_config()
        start_dir = cfg.get("last_folder") or default_folder()
        try:
            result = self.window.create_file_dialog(webview.FOLDER_DIALOG, directory=start_dir)
        except Exception:
            result = None
        if not result:
            return None
        folder = result[0] if isinstance(result, (list, tuple)) else result
        cfg["last_folder"] = folder
        save_config(cfg)
        return folder

    def open_folder(self, folder):
        try:
            os.startfile(folder)  # noqa
        except Exception:
            pass
        return True

    # ---- download / corte / conversao ----------------------------------------
    def start_download(self, url, start, end, folder):
        threading.Thread(
            target=self._download_worker,
            args=(url, start, end, folder),
            daemon=True,
        ).start()
        return {"started": True}

    def _download_worker(self, url, start, end, folder):
        try:
            if not ffmpeg_ready():
                ok = ensure_ffmpeg(lambda p, m: self._push("onSetupStatus", {"done": False, "percent": p, "message": m}))
                if not ok:
                    self._push("onDownloadError", "O ffmpeg nao esta disponivel. Tente novamente (verifique sua internet).")
                    return
                self._push("onSetupStatus", {"done": True})

            os.makedirs(folder, exist_ok=True)

            start = float(start or 0)
            end = float(end) if end not in (None, "", "null") else None
            full_range = start <= 0.05 and (end is None or end <= 0)

            def progress_hook(d):
                status = d.get("status")
                if status == "downloading":
                    total = d.get("total_bytes") or d.get("total_bytes_estimate")
                    downloaded = d.get("downloaded_bytes", 0)
                    percent = round(downloaded / total * 100, 1) if total else None
                    self._push("onProgress", {
                        "status": "downloading",
                        "percent": percent,
                        "speed": d.get("speed"),
                        "eta": d.get("eta"),
                    })
                elif status == "finished":
                    self._push("onProgress", {"status": "converting", "percent": 100})

            ydl_opts = {
                "format": "bestaudio/best",
                "outtmpl": os.path.join(folder, "%(title).150s.%(ext)s"),
                "ffmpeg_location": str(FFMPEG_EXE),
                "noplaylist": True,
                "quiet": True,
                "no_warnings": True,
                "progress_hooks": [progress_hook],
                "postprocessors": [{
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                    "preferredquality": "192",
                }],
            }

            if not full_range:
                rng = {"start_time": max(0.0, start), "end_time": end}
                ydl_opts["download_ranges"] = lambda info, ydl, _r=rng: [_r]
                ydl_opts["force_keyframes_at_cuts"] = True

            self._push("onProgress", {"status": "downloading", "percent": 0})

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                base, _ext = os.path.splitext(ydl.prepare_filename(info))
                final_path = base + ".mp3"

            if not os.path.exists(final_path):
                # fallback: pega o mp3 mais recente na pasta, caso o nome tenha variado
                candidates = sorted(
                    Path(folder).glob("*.mp3"), key=lambda p: p.stat().st_mtime, reverse=True
                )
                final_path = str(candidates[0]) if candidates else final_path

            cfg = load_config()
            cfg["last_folder"] = folder
            save_config(cfg)

            self._push("onDownloadComplete", {"path": final_path, "folder": folder})
        except Exception as e:
            traceback.print_exc()
            self._push("onDownloadError", str(e))

    # ---- util -----------------------------------------------------------------
    def _push(self, event, payload):
        if not self.window:
            return
        try:
            self.window.evaluate_js(f"window.{event} && window.{event}({json.dumps(payload)})")
        except Exception as e:
            print(f"[UaiTiCut] falha ao notificar a interface ({event}): {e}")


def main():
    api = Api()
    window = webview.create_window(
        "UaiTiCut",
        str(APP_DIR / "web" / "index.html"),
        js_api=api,
        width=1000,
        height=820,
        min_size=(760, 650),
        background_color="#f2f2fa",
    )
    api.window = window

    def on_loaded():
        threading.Thread(target=api.prepare_ffmpeg, daemon=True).start()

    window.events.loaded += on_loaded
    debug = "--debug" in sys.argv
    webview.start(debug=debug)


if __name__ == "__main__":
    main()
