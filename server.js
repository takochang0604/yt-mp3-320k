const express = require('express');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Create directories
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');
const BIN_DIR = path.join(__dirname, 'bin');
if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
if (!fs.existsSync(BIN_DIR)) fs.mkdirSync(BIN_DIR, { recursive: true });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Download a file from URL (supports http/https redirects) ──
function downloadFile(url, dest, maxRedirects = 10) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Too many redirects'));

    const proto = url.startsWith('https') ? require('https') : require('http');
    proto.get(url, { headers: { 'User-Agent': 'YT-MP3-Downloader/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (redirectUrl.startsWith('/')) {
          const parsed = new URL(url);
          redirectUrl = `${parsed.protocol}//${parsed.host}${redirectUrl}`;
        }
        res.resume(); // drain response
        downloadFile(redirectUrl, dest, maxRedirects - 1).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`Download failed: HTTP ${res.statusCode}`));
        return;
      }
      const totalSize = parseInt(res.headers['content-length'], 10);
      let downloaded = 0;
      const file = fs.createWriteStream(dest);
      res.on('data', (chunk) => {
        downloaded += chunk.length;
        if (totalSize) {
          const pct = ((downloaded / totalSize) * 100).toFixed(1);
          process.stdout.write(`\r   下載進度: ${pct}% (${(downloaded / 1024 / 1024).toFixed(1)}MB / ${(totalSize / 1024 / 1024).toFixed(1)}MB)`);
        }
      });
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        if (totalSize) process.stdout.write('\n');
        resolve();
      });
      file.on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

// ── Auto-setup yt-dlp ──
async function setupYtDlp() {
  // First check if yt-dlp is in PATH
  try {
    execSync('yt-dlp --version', { stdio: 'pipe', timeout: 5000 });
    return 'yt-dlp';
  } catch (e) { /* not in PATH */ }

  // Check local bin
  const localPath = path.join(BIN_DIR, 'yt-dlp.exe');
  if (fs.existsSync(localPath) && fs.statSync(localPath).size > 0) {
    try {
      execSync(`"${localPath}" --version`, { stdio: 'pipe', timeout: 5000 });
      return localPath;
    } catch (e) { /* corrupted, re-download */ }
  }

  // Download yt-dlp
  console.log('📥 正在下載 yt-dlp...');
  const ytDlpUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
  try {
    await downloadFile(ytDlpUrl, localPath);
    console.log('✅ yt-dlp 下載完成');
    return localPath;
  } catch (e) {
    console.error('❌ yt-dlp 下載失敗:', e.message);
    return null;
  }
}

// ── Auto-setup ffmpeg ──
async function setupFfmpeg() {
  // Check if ffmpeg is in PATH
  try {
    execSync('ffmpeg -version', { stdio: 'pipe', timeout: 5000 });
    return true;
  } catch (e) { /* not in PATH */ }

  // Check local bin
  const localFfmpeg = path.join(BIN_DIR, 'ffmpeg.exe');
  if (fs.existsSync(localFfmpeg) && fs.statSync(localFfmpeg).size > 0) {
    return true;
  }

  // Download ffmpeg from BtbN GitHub releases (more reliable)
  console.log('📥 正在下載 ffmpeg（約 80MB，請稍候）...');
  const zipPath = path.join(BIN_DIR, 'ffmpeg.zip');
  const ffmpegUrl = 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip';

  try {
    // Clean up any previous failed download
    try { fs.unlinkSync(zipPath); } catch (e) { /* ignore */ }

    await downloadFile(ffmpegUrl, zipPath);

    const zipStat = fs.statSync(zipPath);
    if (zipStat.size < 1000) {
      throw new Error('Downloaded file is too small, likely failed');
    }

    // Extract using PowerShell
    console.log('📦 正在解壓 ffmpeg...');
    execSync(`powershell -ExecutionPolicy Bypass -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${BIN_DIR}' -Force"`, {
      stdio: 'pipe',
      timeout: 120000,
    });

    // Find and move ffmpeg.exe to bin root
    const extractedDirs = fs.readdirSync(BIN_DIR).filter(d => d.startsWith('ffmpeg-'));
    for (const dir of extractedDirs) {
      const ffmpegBin = path.join(BIN_DIR, dir, 'bin', 'ffmpeg.exe');
      const ffprobeBin = path.join(BIN_DIR, dir, 'bin', 'ffprobe.exe');
      if (fs.existsSync(ffmpegBin)) {
        fs.copyFileSync(ffmpegBin, localFfmpeg);
        if (fs.existsSync(ffprobeBin)) {
          fs.copyFileSync(ffprobeBin, path.join(BIN_DIR, 'ffprobe.exe'));
        }
        break;
      }
    }

    // Clean up
    try { fs.unlinkSync(zipPath); } catch (e) { /* ignore */ }
    // Remove extracted directory
    for (const dir of extractedDirs) {
      try {
        fs.rmSync(path.join(BIN_DIR, dir), { recursive: true, force: true });
      } catch (e) { /* ignore */ }
    }

    if (fs.existsSync(localFfmpeg)) {
      console.log('✅ ffmpeg 下載完成');
      return true;
    }
  } catch (e) {
    console.error('❌ ffmpeg 下載失敗:', e.message);
    console.log('   請手動安裝: winget install ffmpeg');
    console.log('   或到 https://ffmpeg.org/download.html 下載');
  }

  return false;
}

// ── Sanitize YouTube URL ──
function sanitizeYouTubeUrl(url) {
  // Extract video ID and reconstruct clean URL
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/|music\.youtube\.com\/watch\?v=)([\w-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return `https://www.youtube.com/watch?v=${match[1]}`;
    }
  }
  return url; // return as-is if can't parse
}

// ── Find ffmpeg path ──
function getFfmpegDir() {
  const localFfmpeg = path.join(BIN_DIR, 'ffmpeg.exe');
  if (fs.existsSync(localFfmpeg)) {
    return BIN_DIR;
  }
  return null;
}

let ytDlpPath = null;
let ffmpegAvailable = false;
let isSettingUp = false;

// ── API: Health / status check ──
app.get('/api/status', (req, res) => {
  res.json({
    ytDlp: !!ytDlpPath,
    ffmpeg: ffmpegAvailable,
    ready: !!ytDlpPath && ffmpegAvailable,
    settingUp: isSettingUp,
  });
});

// ── API: Trigger auto-setup ──
app.post('/api/setup', async (req, res) => {
  if (isSettingUp) return res.json({ status: 'already_running' });

  isSettingUp = true;
  try {
    if (!ytDlpPath) ytDlpPath = await setupYtDlp();
    if (!ffmpegAvailable) ffmpegAvailable = await setupFfmpeg();
    res.json({
      ytDlp: !!ytDlpPath,
      ffmpeg: ffmpegAvailable,
      ready: !!ytDlpPath && ffmpegAvailable,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    isSettingUp = false;
  }
});

// ── API: Get video info ──
app.post('/api/info', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: '請提供 YouTube 網址' });
  if (!ytDlpPath) return res.status(500).json({ error: '找不到 yt-dlp，請先安裝' });

  const args = [
    '--dump-json',
    '--no-playlist',
    '--no-warnings',
    url,
  ];

  // Add ffmpeg location if local
  const ffmpegDir = getFfmpegDir();
  if (ffmpegDir) {
    args.unshift('--ffmpeg-location', ffmpegDir);
  }

  const proc = spawn(ytDlpPath, args, { timeout: 30000 });
  let stdout = '';
  let stderr = '';

  proc.stdout.on('data', (data) => { stdout += data.toString(); });
  proc.stderr.on('data', (data) => { stderr += data.toString(); });

  proc.on('close', (code) => {
    if (code !== 0) {
      console.error('yt-dlp info error:', stderr);
      return res.status(500).json({ error: '無法取得影片資訊，請確認網址是否正確' });
    }
    try {
      const info = JSON.parse(stdout);
      res.json({
        title: info.title || 'Unknown',
        thumbnail: info.thumbnail || '',
        duration: info.duration || 0,
        uploader: info.uploader || 'Unknown',
        view_count: info.view_count || 0,
      });
    } catch (e) {
      res.status(500).json({ error: '解析影片資訊失敗' });
    }
  });

  proc.on('error', (err) => {
    console.error('yt-dlp spawn error:', err);
    res.status(500).json({ error: '執行 yt-dlp 時發生錯誤' });
  });
});

// ── API: Download and convert ──
app.get('/api/download', (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: '請提供 YouTube 網址' });
  if (!ytDlpPath) return res.status(500).json({ error: '找不到 yt-dlp，請先安裝' });

  // Sanitize URL to remove playlist params etc.
  const cleanUrl = sanitizeYouTubeUrl(url);
  console.log(`[download] URL: ${cleanUrl}`);

  // Generate unique filename with safe template (avoid encoding issues)
  const timestamp = Date.now();
  const outputTemplate = path.join(DOWNLOADS_DIR, `%(title).100B_${timestamp}.%(ext)s`);

  const args = [
    '-x',
    '--audio-format', 'mp3',
    '--audio-quality', '320K',
    '--no-playlist',
    '--no-warnings',
    '--newline',
    '--encoding', 'utf-8',
    '-o', outputTemplate,
    cleanUrl,
  ];

  // Add ffmpeg location if local
  const ffmpegDir = getFfmpegDir();
  if (ffmpegDir) {
    args.unshift('--ffmpeg-location', ffmpegDir);
  }

  console.log(`[download] Spawning yt-dlp with args:`, args.join(' '));
  const proc = spawn(ytDlpPath, args);

  let stderr = '';
  let processFinished = false;
  let clientDisconnected = false;

  // Use SSE (Server-Sent Events) for progress
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Send initial keepalive
  res.write(`data: ${JSON.stringify({ type: 'progress', percent: 0, stage: 'download' })}\n\n`);

  proc.stdout.on('data', (data) => {
    if (clientDisconnected) return;
    const lines = data.toString().split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      console.log(`[yt-dlp stdout] ${trimmed}`);

      const progressMatch = trimmed.match(/\[download\]\s+([\d.]+)%/);
      if (progressMatch) {
        const pct = parseFloat(progressMatch[1]);
        try { res.write(`data: ${JSON.stringify({ type: 'progress', percent: pct, stage: 'download' })}\n\n`); } catch(e) {}
      } else if (trimmed.includes('[ExtractAudio]') || trimmed.includes('Post-process')) {
        try { res.write(`data: ${JSON.stringify({ type: 'progress', percent: 100, stage: 'converting' })}\n\n`); } catch(e) {}
      }
    }
  });

  proc.stderr.on('data', (data) => {
    stderr += data.toString();
    console.log(`[yt-dlp stderr] ${data.toString().trim()}`);
  });

  proc.on('close', (code) => {
    processFinished = true;
    console.log(`[download] yt-dlp exited with code: ${code}`);

    if (clientDisconnected) {
      console.log('[download] Client already disconnected, skipping response');
      return;
    }

    // Find the output MP3 file
    const files = fs.readdirSync(DOWNLOADS_DIR)
      .filter(f => f.includes(`_${timestamp}`) && f.endsWith('.mp3'))
      .sort((a, b) => {
        const statA = fs.statSync(path.join(DOWNLOADS_DIR, a));
        const statB = fs.statSync(path.join(DOWNLOADS_DIR, b));
        return statB.mtimeMs - statA.mtimeMs;
      });

    if (files.length > 0) {
      const filename = files[0];
      console.log(`[download] Output file: ${filename}`);
      try {
        res.write(`data: ${JSON.stringify({ type: 'done', filename })}\n\n`);
        res.end();
      } catch(e) {}
      return;
    }

    // No file found
    console.error('[download] No output file found. stderr:', stderr);
    try {
      res.write(`data: ${JSON.stringify({ type: 'error', message: '下載失敗，請重試' })}\n\n`);
      res.end();
    } catch(e) {}
  });

  proc.on('error', (err) => {
    processFinished = true;
    console.error('yt-dlp spawn error:', err);
    try {
      res.write(`data: ${JSON.stringify({ type: 'error', message: '執行 yt-dlp 時發生錯誤' })}\n\n`);
      res.end();
    } catch(e) {}
  });

  // Only kill process if user navigates away (not just SSE close)
  res.on('close', () => {
    clientDisconnected = true;
    if (!processFinished) {
      console.log('[download] Client disconnected, killing yt-dlp');
      proc.kill();
    }
  });
});

// ── API: Serve downloaded file ──
app.get('/api/file/:filename', (req, res) => {
  const filename = req.params.filename;
  const safe = path.basename(filename);
  const filepath = path.join(DOWNLOADS_DIR, safe);

  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: '檔案不存在' });
  }

  res.download(filepath, safe, (err) => {
    if (err) {
      console.error('Download error:', err);
    }
    // Clean up file after download
    setTimeout(() => {
      try { fs.unlinkSync(filepath); } catch (e) { /* ignore */ }
    }, 60000);
  });
});

// ── Start server ──
async function start() {
  // Auto-setup tools
  console.log('\n🎵 YouTube MP3 下載器');
  console.log('━'.repeat(40));
  console.log('⏳ 正在檢查必要工具...\n');

  ytDlpPath = await setupYtDlp();
  ffmpegAvailable = await setupFfmpeg();

  console.log('\n━'.repeat(40));

  if (ytDlpPath) {
    console.log('✅ yt-dlp 已就緒');
  } else {
    console.log('⚠️  yt-dlp 未就緒 - 請手動安裝：');
    console.log('   winget install yt-dlp');
    console.log('   或到 https://github.com/yt-dlp/yt-dlp/releases 下載');
  }

  if (ffmpegAvailable) {
    console.log('✅ ffmpeg 已就緒');
  } else {
    console.log('⚠️  ffmpeg 未就緒 - 請手動安裝：');
    console.log('   winget install ffmpeg');
    console.log('   或到 https://ffmpeg.org/download.html 下載');
  }

  app.listen(PORT, () => {
    console.log(`\n📍 開啟瀏覽器前往: http://localhost:${PORT}`);
    console.log('━'.repeat(40) + '\n');
  });
}

start();
