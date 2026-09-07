(function () {
  "use strict";

  // ---------------- elementos ----------------
  const urlInput = document.getElementById("url-input");
  const loadBtn = document.getElementById("load-btn");
  const urlError = document.getElementById("url-error");

  const previewCard = document.getElementById("preview-card");
  const videoTitleEl = document.getElementById("video-title");

  const trimCard = document.getElementById("trim-card");
  const sliderRange = document.getElementById("slider-range");
  const rangeStart = document.getElementById("range-start");
  const rangeEnd = document.getElementById("range-end");
  const startTimeInput = document.getElementById("start-time");
  const endTimeInput = document.getElementById("end-time");
  const markStartBtn = document.getElementById("mark-start-btn");
  const markEndBtn = document.getElementById("mark-end-btn");
  const selectionLength = document.getElementById("selection-length");

  const folderDisplay = document.getElementById("folder-display");
  const folderBtn = document.getElementById("folder-btn");

  const downloadBtn = document.getElementById("download-btn");
  const progressArea = document.getElementById("progress-area");
  const downloadProgressFill = document.getElementById("download-progress-fill");
  const progressText = document.getElementById("progress-text");
  const successArea = document.getElementById("success-area");
  const successPath = document.getElementById("success-path");
  const openFolderBtn = document.getElementById("open-folder-btn");
  const downloadError = document.getElementById("download-error");

  const setupBanner = document.getElementById("setup-banner");
  const setupMessage = document.getElementById("setup-message");
  const setupProgressFill = document.getElementById("setup-progress-fill");

  // ---------------- estado ----------------
  let ytPlayer = null;
  let playerReady = false;
  let trimEnabled = false;
  let ffmpegReady = false;
  let videoLoaded = false;
  let folderChosen = false;
  let currentFolder = "";

  // ---------------- helpers ----------------
  function setHidden(el, hidden) { el.hidden = hidden; }

  function secondsToLabel(total) {
    total = Math.max(0, Math.round(total || 0));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }

  function labelToSeconds(label) {
    const parts = String(label).trim().split(":").map((x) => parseInt(x, 10));
    if (parts.some((n) => isNaN(n))) return 0;
    let secs = 0;
    for (const p of parts) secs = secs * 60 + p;
    return secs;
  }

  function api() {
    if (!window.pywebview || !window.pywebview.api) {
      throw new Error("A ponte com o backend ainda não está pronta.");
    }
    return window.pywebview.api;
  }

  function updateDownloadButtonState() {
    downloadBtn.disabled = !(ffmpegReady && videoLoaded && folderChosen);
  }

  // ---------------- setup (ffmpeg na primeira execução) ----------------
  window.onSetupStatus = function (payload) {
    if (payload.done) {
      ffmpegReady = true;
      setHidden(setupBanner, true);
      if (payload.error) {
        urlError.textContent = payload.error;
        setHidden(urlError, false);
      }
      updateDownloadButtonState();
      return;
    }
    setHidden(setupBanner, false);
    setupMessage.textContent = payload.message || "Preparando...";
    if (typeof payload.percent === "number") {
      setupProgressFill.style.width = payload.percent + "%";
    }
  };

  // ---------------- YouTube IFrame API ----------------
  function resetPlayerContainer() {
    const wrap = document.querySelector(".video-wrap");
    wrap.innerHTML = '<div id="yt-player"></div>';
  }

  function createPlayer(videoId) {
    playerReady = false;
    resetPlayerContainer();
    ytPlayer = new YT.Player("yt-player", {
      videoId: videoId,
      playerVars: { rel: 0 },
      events: {
        onReady: function () { playerReady = true; },
      },
    });
  }

  function loadPlayer(videoId) {
    if (window.YT && window.YT.Player) {
      createPlayer(videoId);
      return;
    }
    window.onYouTubeIframeAPIReady = function () { createPlayer(videoId); };
    if (!document.getElementById("yt-iframe-api-script")) {
      const tag = document.createElement("script");
      tag.id = "yt-iframe-api-script";
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
  }

  // ---------------- slider de corte ----------------
  function updateSliderVisual() {
    const max = parseInt(rangeStart.max, 10) || 1;
    const s = parseInt(rangeStart.value, 10);
    const e = parseInt(rangeEnd.value, 10);
    const leftPct = (s / max) * 100;
    const rightPct = (e / max) * 100;
    sliderRange.style.left = leftPct + "%";
    sliderRange.style.width = Math.max(0, rightPct - leftPct) + "%";
    startTimeInput.value = secondsToLabel(s);
    endTimeInput.value = secondsToLabel(e);
    selectionLength.textContent = secondsToLabel(Math.max(0, e - s));
  }

  function setupSlider(durationSeconds) {
    const maxVal = Math.max(1, Math.round(durationSeconds));
    rangeStart.min = 0; rangeStart.max = maxVal; rangeStart.value = 0;
    rangeEnd.min = 0; rangeEnd.max = maxVal; rangeEnd.value = maxVal;
    updateSliderVisual();
  }

  rangeStart.addEventListener("input", () => {
    let s = parseInt(rangeStart.value, 10);
    const e = parseInt(rangeEnd.value, 10);
    if (s > e) { s = e; rangeStart.value = s; }
    updateSliderVisual();
  });

  rangeEnd.addEventListener("input", () => {
    const s = parseInt(rangeStart.value, 10);
    let e = parseInt(rangeEnd.value, 10);
    if (e < s) { e = s; rangeEnd.value = e; }
    updateSliderVisual();
  });

  function applyManualTime(input, isStart) {
    const max = parseInt(rangeStart.max, 10) || 0;
    let secs = Math.min(Math.max(0, labelToSeconds(input.value)), max);
    if (isStart) {
      const e = parseInt(rangeEnd.value, 10);
      if (secs > e) secs = e;
      rangeStart.value = secs;
    } else {
      const s = parseInt(rangeStart.value, 10);
      if (secs < s) secs = s;
      rangeEnd.value = secs;
    }
    updateSliderVisual();
  }

  startTimeInput.addEventListener("change", () => applyManualTime(startTimeInput, true));
  endTimeInput.addEventListener("change", () => applyManualTime(endTimeInput, false));

  markStartBtn.addEventListener("click", () => {
    if (!playerReady || !ytPlayer) return;
    const t = Math.floor(ytPlayer.getCurrentTime());
    rangeStart.value = Math.min(t, parseInt(rangeEnd.value, 10));
    updateSliderVisual();
  });

  markEndBtn.addEventListener("click", () => {
    if (!playerReady || !ytPlayer) return;
    const t = Math.ceil(ytPlayer.getCurrentTime());
    rangeEnd.value = Math.max(t, parseInt(rangeStart.value, 10));
    updateSliderVisual();
  });

  // ---------------- carregar vídeo ----------------
  async function handleLoadVideo() {
    const url = urlInput.value.trim();
    setHidden(urlError, true);
    if (!url) return;

    loadBtn.disabled = true;
    loadBtn.textContent = "Carregando...";
    try {
      const result = await api().load_video(url);
      if (result.error) {
        urlError.textContent = result.error;
        setHidden(urlError, false);
        videoLoaded = false;
        updateDownloadButtonState();
        return;
      }

      videoTitleEl.textContent = result.title;
      setHidden(previewCard, false);
      loadPlayer(result.id);

      if (result.duration) {
        trimEnabled = true;
        setHidden(trimCard, false);
        setupSlider(result.duration);
      } else {
        trimEnabled = false;
        setHidden(trimCard, true);
      }

      videoLoaded = true;
      updateDownloadButtonState();
    } catch (e) {
      urlError.textContent = "Não foi possível carregar esse vídeo.";
      setHidden(urlError, false);
    } finally {
      loadBtn.disabled = false;
      loadBtn.textContent = "Carregar vídeo";
    }
  }

  loadBtn.addEventListener("click", handleLoadVideo);
  urlInput.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") handleLoadVideo();
  });

  // ---------------- pasta de destino ----------------
  folderBtn.addEventListener("click", async () => {
    try {
      const folder = await api().choose_folder();
      if (folder) {
        currentFolder = folder;
        folderDisplay.value = folder;
        folderDisplay.title = folder;
        folderChosen = true;
        updateDownloadButtonState();
      }
    } catch (e) { /* ponte ainda não pronta */ }
  });

  // ---------------- download ----------------
  window.onProgress = function (payload) {
    setHidden(progressArea, false);
    if (payload.status === "downloading") {
      const pct = typeof payload.percent === "number" ? payload.percent : 0;
      downloadProgressFill.style.width = pct + "%";
      progressText.textContent = `Baixando... ${pct}%`;
    } else if (payload.status === "converting") {
      downloadProgressFill.style.width = "100%";
      progressText.textContent = "Convertendo para MP3...";
    }
  };

  window.onDownloadComplete = function (payload) {
    setHidden(progressArea, true);
    setHidden(downloadError, true);
    successPath.textContent = payload.path;
    setHidden(successArea, false);
    openFolderBtn.dataset.folder = payload.folder;
    downloadBtn.disabled = false;
    downloadBtn.textContent = "⬇ Baixar MP3";
  };

  window.onDownloadError = function (message) {
    setHidden(progressArea, true);
    downloadError.textContent = "Ocorreu um erro: " + message;
    setHidden(downloadError, false);
    downloadBtn.disabled = false;
    downloadBtn.textContent = "⬇ Baixar MP3";
  };

  downloadBtn.addEventListener("click", async () => {
    setHidden(successArea, true);
    setHidden(downloadError, true);
    setHidden(progressArea, false);
    downloadProgressFill.style.width = "0%";
    progressText.textContent = "Iniciando...";
    downloadBtn.disabled = true;
    downloadBtn.textContent = "Baixando...";

    const url = urlInput.value.trim();
    const start = trimEnabled ? parseInt(rangeStart.value, 10) : 0;
    const end = trimEnabled ? parseInt(rangeEnd.value, 10) : null;
    const folder = folderDisplay.value;

    try {
      await api().start_download(url, start, end, folder);
    } catch (e) {
      window.onDownloadError("não foi possível iniciar o download.");
    }
  });

  openFolderBtn.addEventListener("click", async () => {
    const folder = openFolderBtn.dataset.folder || currentFolder;
    try { await api().open_folder(folder); } catch (e) { /* ignore */ }
  });

  // ---------------- inicialização ----------------
  // O evento "pywebviewready" pode disparar antes deste script terminar de
  // carregar; se a ponte ja existir, inicializa na hora em vez de esperar
  // um evento que ja passou.
  async function initWithApi() {
    try {
      const cfg = await api().get_config();
      if (cfg.last_folder) {
        currentFolder = cfg.last_folder;
        folderDisplay.value = cfg.last_folder;
        folderDisplay.title = cfg.last_folder;
        folderChosen = true;
      }
      ffmpegReady = !!cfg.ffmpeg_ready;
      updateDownloadButtonState();
    } catch (e) { /* segue sem config previa */ }
  }

  if (window.pywebview && window.pywebview.api) {
    initWithApi();
  } else {
    window.addEventListener("pywebviewready", initWithApi);
  }
})();
