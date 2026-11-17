/* 發佈時事：node tools/publish-news.js
   把 site/news.json 複製到 newshost/，發佈到 Cloudflare Pages 專案 hundan-club-news，再從線上讀回來確認日期。
   頁面會從 https://hundan-club-news.pages.dev/news.json 讀時事，所以每天更新時事不需要發佈整個網站到 Netlify
   （Netlify 每次正式發佈要花 15 個額度，免費方案一個月只有 300 個）。
   發佈前請先跑 node tools/check.js。失敗就停下來，不要用別的方式發佈。 */
const fs = require("fs"), path = require("path"), { spawnSync } = require("child_process");
const root = path.join(__dirname, "..");
const src = path.join(root, "site", "news.json"), dir = path.join(root, "newshost"), dst = path.join(dir, "news.json");
const URL = "https://hundan-club-news.pages.dev/news.json";

const news = JSON.parse(fs.readFileSync(src, "utf8"));
fs.copyFileSync(src, dst);
/* 整個生成器也放在 Cloudflare（https://hundan-club-news.pages.dev/），所以頁面一起複製，每次發佈都是完整的一份 */
fs.copyFileSync(path.join(root, "site", "index.html"), path.join(dir, "index.html"));
console.log("時事日期：" + news.date);

const r = spawnSync("npx", ["--yes", "wrangler@latest", "pages", "deploy", "newshost", "--project-name", "hundan-club-news", "--branch", "main", "--commit-dirty=true"],
  { cwd: root, stdio: "inherit", shell: true });
if (r.status !== 0) { console.log("✗ 發佈失敗，線上維持上一版"); process.exit(1); }

(async () => {
  for (let i = 0; i < 6; i++) {                       // 剛發佈完可能要等幾秒才換
    try {
      const d = await (await fetch(URL + "?t=" + Date.now(), { cache: "no-store" })).json();
      if (d.date === news.date) { console.log("✓ 線上時事日期是 " + d.date); return; }
    } catch (e) {}
    await new Promise(ok => setTimeout(ok, 3000));
  }
  console.log("✗ 發佈完成但線上日期不是 " + news.date + "，請人工確認 " + URL);
  process.exit(1);
})();
