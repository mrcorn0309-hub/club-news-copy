# 混蛋俱樂部 文案生成器：每日時事（雲端用）

給雲端排程用的最小檔案。每天更新 `site/news.json`，跑 `node tools/check.js` 檢查，通過後跑 `node tools/publish-news.js` 發佈到 Cloudflare Pages（專案 `hundan-club-news`）。
頁面本體（`site/index.html`）不放在這個 repo，每次執行時從 https://hundan-club-news.pages.dev/index.html 下載最新版。
發佈需要環境變數 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`（由使用者在雲端環境設定，不放在這個專案裡）。
