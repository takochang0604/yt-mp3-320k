/* ═══════════════════════════════════════════════
   YT → MP3 Frontend Logic
   ═══════════════════════════════════════════════ */

// ── DOM Elements ──
const urlInput = document.getElementById('urlInput');
const pasteBtn = document.getElementById('pasteBtn');
const convertBtn = document.getElementById('convertBtn');
const statusBadge = document.getElementById('statusBadge');
const statusText = document.getElementById('statusText');
const infoCard = document.getElementById('infoCard');
const thumbnail = document.getElementById('thumbnail');
const videoTitle = document.getElementById('videoTitle');
const videoUploader = document.getElementById('videoUploader');
const durationBadge = document.getElementById('durationBadge');
const viewCountText = document.getElementById('viewCountText');
const progressCard = document.getElementById('progressCard');
const progressBar = document.getElementById('progressBar');
const progressGlow = document.getElementById('progressGlow');
const progressStage = document.getElementById('progressStage');
const progressPercent = document.getElementById('progressPercent');
const progressHint = document.getElementById('progressHint');
const doneCard = document.getElementById('doneCard');
const doneFilename = document.getElementById('doneFilename');
const downloadLink = document.getElementById('downloadLink');
const resetBtn = document.getElementById('resetBtn');
const errorCard = document.getElementById('errorCard');
const errorMessage = document.getElementById('errorMessage');
const retryBtn = document.getElementById('retryBtn');

// ── State ──
let isProcessing = false;
let currentVideoInfo = null;

// ── Initialize ──
document.addEventListener('DOMContentLoaded', () => {
  createParticles();
  checkStatus();
  setupEventListeners();
});

// ── Create Floating Particles ──
function createParticles() {
  const container = document.getElementById('particles');
  const count = 30;
  for (let i = 0; i < count; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.animationDuration = (8 + Math.random() * 15) + 's';
    particle.style.animationDelay = (Math.random() * 10) + 's';
    particle.style.width = (1 + Math.random() * 2) + 'px';
    particle.style.height = particle.style.width;
    particle.style.opacity = 0.2 + Math.random() * 0.4;
    container.appendChild(particle);
  }
}

// ── Check Backend Status ──
async function checkStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    if (data.ready) {
      statusBadge.className = 'badge ready';
      statusText.textContent = '就緒';
      hideCard(document.getElementById('setupCard'));
    } else if (data.settingUp) {
      statusBadge.className = 'badge';
      statusText.textContent = '安裝中...';
      // Re-check in 3 seconds
      setTimeout(checkStatus, 3000);
    } else {
      statusBadge.className = 'badge error';
      let missing = [];
      if (!data.ytDlp) missing.push('yt-dlp');
      if (!data.ffmpeg) missing.push('ffmpeg');
      statusText.textContent = '缺少 ' + missing.join(', ');

      // Show setup card
      const setupCard = document.getElementById('setupCard');
      const setupYtdlp = document.getElementById('setupYtdlp');
      const setupFfmpeg = document.getElementById('setupFfmpeg');
      setupYtdlp.querySelector('.setup-status').textContent = data.ytDlp ? '✅' : '❌';
      setupFfmpeg.querySelector('.setup-status').textContent = data.ffmpeg ? '✅' : '❌';
      showCard(setupCard);
    }
  } catch (e) {
    statusBadge.className = 'badge error';
    statusText.textContent = '無法連線';
  }
}

// ── Auto Setup ──
async function triggerSetup() {
  const setupBtn = document.getElementById('setupBtn');
  const content = setupBtn.querySelector('.btn-content');
  const loader = setupBtn.querySelector('.btn-loader');
  content.style.display = 'none';
  loader.style.display = 'flex';
  setupBtn.disabled = true;

  statusBadge.className = 'badge';
  statusText.textContent = '安裝中...';

  try {
    const res = await fetch('/api/setup', { method: 'POST' });
    const data = await res.json();

    const setupYtdlp = document.getElementById('setupYtdlp');
    const setupFfmpeg = document.getElementById('setupFfmpeg');
    setupYtdlp.querySelector('.setup-status').textContent = data.ytDlp ? '✅' : '❌';
    setupFfmpeg.querySelector('.setup-status').textContent = data.ffmpeg ? '✅' : '❌';

    if (data.ready) {
      statusBadge.className = 'badge ready';
      statusText.textContent = '就緒';
      setTimeout(() => hideCard(document.getElementById('setupCard')), 1500);
    } else {
      statusBadge.className = 'badge error';
      let missing = [];
      if (!data.ytDlp) missing.push('yt-dlp');
      if (!data.ffmpeg) missing.push('ffmpeg');
      statusText.textContent = '缺少 ' + missing.join(', ');
      content.style.display = 'flex';
      loader.style.display = 'none';
      setupBtn.disabled = false;
    }
  } catch (e) {
    statusBadge.className = 'badge error';
    statusText.textContent = '安裝失敗';
    content.style.display = 'flex';
    loader.style.display = 'none';
    setupBtn.disabled = false;
  }
}


// ── Event Listeners ──
function setupEventListeners() {
  // Input change
  urlInput.addEventListener('input', () => {
    const valid = isValidYouTubeUrl(urlInput.value.trim());
    convertBtn.disabled = !valid;
    if (valid && !isProcessing) {
      fetchVideoInfo(urlInput.value.trim());
    } else if (!valid) {
      hideCard(infoCard);
    }
  });

  // Paste button
  pasteBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      urlInput.value = text;
      urlInput.dispatchEvent(new Event('input'));
    } catch (e) {
      // Fallback: focus input
      urlInput.focus();
    }
  });

  // Convert button
  convertBtn.addEventListener('click', () => {
    if (!isProcessing) startDownload();
  });

  // Enter key
  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !convertBtn.disabled && !isProcessing) {
      startDownload();
    }
  });

  // Reset button
  resetBtn.addEventListener('click', resetUI);

  // Retry button
  retryBtn.addEventListener('click', () => {
    hideCard(errorCard);
    if (urlInput.value.trim()) {
      startDownload();
    }
  });

  // Setup button
  const setupBtn = document.getElementById('setupBtn');
  if (setupBtn) {
    setupBtn.addEventListener('click', triggerSetup);
  }
}

// ── Validate YouTube URL ──
function isValidYouTubeUrl(url) {
  const patterns = [
    /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=[\w-]+/,
    /^(https?:\/\/)?(www\.)?youtube\.com\/shorts\/[\w-]+/,
    /^(https?:\/\/)?youtu\.be\/[\w-]+/,
    /^(https?:\/\/)?(www\.)?youtube\.com\/embed\/[\w-]+/,
    /^(https?:\/\/)?music\.youtube\.com\/watch\?v=[\w-]+/,
  ];
  return patterns.some(p => p.test(url));
}

// ── Format Duration ──
function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ── Format View Count ──
function formatViews(count) {
  if (!count) return '0';
  if (count >= 1e8) return (count / 1e8).toFixed(1) + '億';
  if (count >= 1e4) return (count / 1e4).toFixed(1) + '萬';
  return count.toLocaleString();
}

// ── Fetch Video Info ──
let infoAbortController = null;
async function fetchVideoInfo(url) {
  // Cancel previous request
  if (infoAbortController) infoAbortController.abort();
  infoAbortController = new AbortController();

  try {
    const res = await fetch('/api/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: infoAbortController.signal,
    });
    const data = await res.json();
    if (data.error) {
      hideCard(infoCard);
      return;
    }

    currentVideoInfo = data;
    thumbnail.src = data.thumbnail;
    videoTitle.textContent = data.title;
    videoUploader.textContent = data.uploader;
    durationBadge.textContent = formatDuration(data.duration);
    viewCountText.textContent = formatViews(data.view_count) + ' 次觀看';
    showCard(infoCard);
  } catch (e) {
    if (e.name !== 'AbortError') {
      hideCard(infoCard);
    }
  }
}

// ── Start Download ──
async function startDownload() {
  const url = urlInput.value.trim();
  if (!url || isProcessing) return;

  isProcessing = true;
  setButtonLoading(true);
  hideCard(doneCard);
  hideCard(errorCard);
  showCard(progressCard);
  updateProgress(0, 'download');

  // Use EventSource (GET-based SSE) for reliable streaming
  const encodedUrl = encodeURIComponent(url);
  const evtSource = new EventSource(`/api/download?url=${encodedUrl}`);

  evtSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleSSE(data);

      // Close connection when done or error
      if (data.type === 'done' || data.type === 'error') {
        evtSource.close();
        isProcessing = false;
        setButtonLoading(false);
      }
    } catch (e) {
      // ignore parse errors
    }
  };

  evtSource.onerror = (e) => {
    evtSource.close();
    // Only show error if we haven't already received a done/error event
    if (isProcessing) {
      showError('連線中斷，請重試');
      isProcessing = false;
      setButtonLoading(false);
    }
  };
}

// ── Handle SSE Events ──
function handleSSE(data) {
  switch (data.type) {
    case 'progress':
      updateProgress(data.percent, data.stage);
      break;
    case 'done':
      hideCard(progressCard);
      showDone(data.filename);
      break;
    case 'error':
      hideCard(progressCard);
      showError(data.message);
      break;
  }
}

// ── Update Progress ──
function updateProgress(percent, stage) {
  const pct = Math.min(100, Math.max(0, percent));
  progressBar.style.width = pct + '%';
  progressGlow.style.width = pct + '%';
  progressPercent.textContent = Math.round(pct) + '%';

  if (stage === 'converting') {
    progressStage.textContent = '🔄 轉換為 MP3 中...';
    progressHint.textContent = '正在轉換為 320kbps 高音質 MP3...';
    progressBar.style.width = '100%';
    progressGlow.style.width = '100%';
    progressPercent.textContent = '轉換中';
  } else {
    progressStage.textContent = '⬇️ 下載中...';
    progressHint.textContent = '正在從 YouTube 下載音訊...';
  }
}

// ── Show Done ──
function showDone(filename) {
  const displayName = decodeURIComponent(filename);
  doneFilename.textContent = displayName;
  downloadLink.href = `/api/file/${encodeURIComponent(filename)}`;
  downloadLink.download = filename;
  showCard(doneCard);
}

// ── Show Error ──
function showError(msg) {
  errorMessage.textContent = msg;
  showCard(errorCard);
}

// ── Button Loading State ──
function setButtonLoading(loading) {
  const content = convertBtn.querySelector('.btn-content');
  const loader = convertBtn.querySelector('.btn-loader');
  if (loading) {
    content.style.display = 'none';
    loader.style.display = 'flex';
    convertBtn.disabled = true;
  } else {
    content.style.display = 'flex';
    loader.style.display = 'none';
    convertBtn.disabled = !isValidYouTubeUrl(urlInput.value.trim());
  }
}

// ── Reset UI ──
function resetUI() {
  urlInput.value = '';
  convertBtn.disabled = true;
  currentVideoInfo = null;
  hideCard(infoCard);
  hideCard(progressCard);
  hideCard(doneCard);
  hideCard(errorCard);
  urlInput.focus();
}

// ── Show / Hide Card ──
function showCard(card) {
  card.style.display = '';
  // Re-trigger animation
  card.style.animation = 'none';
  card.offsetHeight; // force reflow
  card.style.animation = '';
}

function hideCard(card) {
  card.style.display = 'none';
}
