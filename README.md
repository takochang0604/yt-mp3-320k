# 🎵 YT → MP3 | 高音質 320kbps 下載器

將 YouTube 影片網址轉換為 **320kbps 高音質 MP3** 並下載，支援一鍵操作。

![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## ✨ 功能特色

- 🎯 **一鍵轉換** — 貼上 YouTube 網址即可轉換下載
- 🔊 **320kbps CBR** — 真正的高音質 MP3 輸出
- 📺 **影片預覽** — 自動顯示影片標題、縮圖、時長、觀看次數
- 📊 **即時進度** — SSE 串流即時顯示下載與轉換進度
- ⚡ **自動安裝** — 首次啟動自動下載 yt-dlp 和 ffmpeg，無需手動設定
- 🌙 **精美介面** — 深色玻璃態 UI，流暢動畫效果

---

## 📸 截圖

啟動後開啟瀏覽器前往 `http://localhost:3000` 即可看到介面。

---

## 🚀 快速開始

### 環境需求

- [Node.js](https://nodejs.org/) 18 以上版本
- Windows 作業系統（自動下載的 yt-dlp/ffmpeg 為 Windows 版本）

### 安裝與啟動

```bash
# 1. 下載專案
git clone https://github.com/your-username/yt-mp3-320k.git
cd yt-mp3-320k

# 2. 安裝依賴
npm install

# 3. 啟動伺服器
node server.js
```

啟動後會看到：

```
🎵 YouTube MP3 下載器
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏳ 正在檢查必要工具...

📥 正在下載 yt-dlp...
✅ yt-dlp 下載完成
📥 正在下載 ffmpeg（約 80MB，請稍候）...
✅ ffmpeg 下載完成

✅ yt-dlp 已就緒
✅ ffmpeg 已就緒

📍 開啟瀏覽器前往: http://localhost:3000
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

> **首次啟動**會自動下載 yt-dlp (~18MB) 和 ffmpeg (~211MB) 到 `bin/` 目錄，之後啟動不需重新下載。

### 使用方式

1. 開啟瀏覽器前往 **http://localhost:3000**
2. 貼上 YouTube 影片網址
3. 確認影片資訊（標題、縮圖、時長）
4. 點擊「**轉換並下載 MP3**」
5. 等待進度條完成後，點擊下載按鈕儲存 MP3 檔案

---

## 📁 專案結構

```
yt-mp3-320k/
├── server.js           # Express 後端伺服器
├── package.json        # 專案設定與依賴
├── public/
│   ├── index.html      # 前端頁面
│   ├── style.css       # 樣式表（深色玻璃態設計）
│   └── app.js          # 前端互動邏輯
├── bin/                # 自動下載的工具（gitignore）
│   ├── yt-dlp.exe
│   ├── ffmpeg.exe
│   └── ffprobe.exe
└── downloads/          # 暫存轉換檔案（gitignore）
```

---

## ⚙️ 技術架構

| 層級 | 技術 |
|------|------|
| 前端 | HTML + CSS + JavaScript（原生） |
| 後端 | Node.js + Express |
| 下載引擎 | yt-dlp（自動下載） |
| 音訊轉換 | ffmpeg（自動下載） |
| 即時通訊 | Server-Sent Events (SSE) |

### API 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| `GET` | `/api/status` | 檢查 yt-dlp/ffmpeg 是否就緒 |
| `POST` | `/api/setup` | 觸發自動安裝 yt-dlp/ffmpeg |
| `POST` | `/api/info` | 取得 YouTube 影片資訊 |
| `GET` | `/api/download?url=...` | 下載並轉換為 MP3（SSE 串流） |
| `GET` | `/api/file/:filename` | 下載已轉換的 MP3 檔案 |

---

## 🔧 疑難排解

### yt-dlp 或 ffmpeg 自動下載失敗

手動安裝：

```bash
# 使用 winget 安裝
winget install yt-dlp
winget install ffmpeg

# 或手動下載
# yt-dlp: https://github.com/yt-dlp/yt-dlp/releases
# ffmpeg: https://github.com/BtbN/FFmpeg-Builds/releases
```

### 出現「No supported JavaScript runtime」警告

這是 yt-dlp 的警告，不影響正常使用。如需消除，可安裝 [Deno](https://deno.land/)。

### 下載速度很慢

YouTube 可能對你的 IP 有速率限制，可嘗試使用 VPN。

---

## ⚠️ 免責聲明

本工具僅供**個人學習與研究**使用。請尊重著作權法規，勿將下載的內容用於商業用途。使用者需自行承擔使用本工具的法律責任。

---

## 📄 授權

MIT License
