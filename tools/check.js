/* 檢查工具：node tools/check.js
   1. site/index.html 的句庫：沒有禁用詞、人設之間沒有重複句、每種文案形式都有句子
   2. site/news.json：格式正確、日期是今天、每位夥伴都有內容、沒有禁用詞、有來源
   有任何一項不過就以非 0 結束，不要發佈。 */
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..", "site");
let fail = 0;
const bad = m => { fail++; console.log("✗ " + m); };
const ok = m => console.log("✓ " + m);

/* ---------- index.html ---------- */
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const js = html.split("<script>")[1].split("</script>")[0];
const els = {};
const mk = () => ({ value: "500", checked: true, innerHTML: "", textContent: "", style: {}, classList: { add() {}, remove() {}, contains() { return false; } }, append() {}, addEventListener() {}, scrollIntoView() {}, set onclick(f) {} });
global.document = { getElementById: id => els[id] || (els[id] = mk()), createElement: () => mk() };
global.window = { innerWidth: 1000, addEventListener() {}, scrollTo() {} };
global.location = { hash: "", pathname: "/", search: "" };
global.history = { replaceState() {} };
global.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
global.fetch = () => Promise.reject(new Error("no fetch in check"));
els.risk = Object.assign(mk(), { checked: false });
els.hot = Object.assign(mk(), { checked: false });
eval(js + ";globalThis.T={PERSONAS,FORMATS,BANNED,build,combos,get S(){return S},setP(v){P=v}}");
const active = T.PERSONAS.filter(p => !p.off);

let hits = [];
for (const p of T.PERSONAS) {
  for (const k in p.pools) for (const s of p.pools[k]) for (const w of T.BANNED) if (s.includes(w)) hits.push(`${p.name}/${k}: ${s} [${w}]`);
  for (const s of p.sign) for (const w of T.BANNED) if (s.includes(w)) hits.push(`${p.name}/sign: ${s} [${w}]`);
}
hits.length ? bad("句庫有禁用詞：" + hits.join(" | ")) : ok("句庫沒有禁用詞");

const seen = new Map(); let dup = [];
for (const p of T.PERSONAS) for (const k in p.pools) for (const s of new Set(p.pools[k])) {
  if (seen.has(s) && seen.get(s) !== p.name) dup.push(`${s} (${seen.get(s)}/${p.name})`); else seen.set(s, p.name);
}
dup.length ? bad("人設之間有重複句：" + dup.join(" | ")) : ok("人設之間沒有重複句");

let missing = [];
for (const p of active) for (const f in T.FORMATS) {
  const variants = (p.slots && p.slots[f]) || T.FORMATS[f].variants || [T.FORMATS[f].slots];   // 人設有自己的結構就檢查他的
  for (const sl of variants) for (const s of sl) if (!p.pools[s] || !p.pools[s].length) missing.push(`${p.name}/${s}`);
}
missing.length ? bad("缺句庫：" + missing.join(", ")) : ok("每種文案形式都有句子");

/* 藍色小友那幾句分兩種：
   - 淡化版（result、resultS 等）：不能暗示「每天都有、一定有」
   - 原版強力句（resultHot、resultSHot）：使用者要保留，因為轉化效果好；預設只佔 30%（index.html 的 HOT_SHARE） */
const STRONG = /天天|每天|每日|穩定|穩穩|準時|固定|照常|照樣|一如既往|依舊|持續|不缺席|一定|保證/;
let strong = [], hotCount = 0;
for (const p of active) for (const k in p.pools) {
  if (k.endsWith("Hot")) { hotCount += p.pools[k].length; continue; }
  for (const s of p.pools[k]) if (s.includes("藍色小友") && STRONG.test(s)) strong.push(`${p.name}/${k}: ${s}`);
}
strong.length ? bad("淡化版的藍色小友句子帶有承諾頻率或結果的字：" + strong.join(" | ")) : ok(`淡化版的藍色小友句子沒有承諾頻率或結果（另有原版強力句 ${hotCount} 句）`);

for (const p of active) {
  T.setP(p); T.S.fmt = "mix";
  let h = 0; const set = new Set();
  for (let i = 0; i < 2000; i++) { const r = T.build([]); set.add(r.t); if (T.BANNED.some(w => r.t.includes(w))) h++; }
  h ? bad(`${p.name} 抽樣 2000 則有 ${h} 則含禁用詞`) : ok(`${p.name}：抽樣 2000 則無禁用詞，可組合 ${T.combos()} 種`);
}

/* ---------- news.json ---------- */
const now = new Date();
const today = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
try {
  const news = JSON.parse(fs.readFileSync(path.join(root, "news.json"), "utf8"));
  /* 只改句庫、沒有要更新時事的時候，可以加 --allow-stale-news：時事不是今天的只會提醒，不會擋
     （頁面本來就會標出時事的日期，過期的也不會混進隨機混搭）。每日時事更新不能加這個參數。 */
  const allowStale = process.argv.includes("--allow-stale-news");
  if (news.date === today) ok("news.json 日期是今天 " + today);
  else if (allowStale) console.log(`！ news.json 日期是 ${news.date}，不是今天 ${today}（這次只改句庫，先放行）`);
  else bad(`news.json 日期是 ${news.date}，不是今天 ${today}`);
  const src = (news.sources || []).filter(x => x && /^https?:\/\//.test(x.url || ""));
  src.length ? ok(`news.json 有 ${src.length} 個來源`) : bad("news.json 沒有來源連結");

  /* 查證表：文案裡用到的每一項事實都要列在 facts，並附來源。
     有數字或日期的事實要兩個以上互相獨立的來源；只有公司或政府自己的公告（official:true）可以只有一個 */
  const facts = Array.isArray(news.facts) ? news.facts : [];
  if (!facts.length) bad("news.json 沒有 facts 查證表");
  let weak = 0;
  for (const f of facts) {
    const urls = (f.sources || []).filter(u => /^https?:\/\//.test(u));
    const hosts = new Set(urls.map(u => u.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]));
    const needTwo = /\d/.test(f.claim || "") && !f.official;
    if (!f.claim || !urls.length) { weak++; bad("facts 裡有一項沒有內容或沒有來源"); }
    else if (needTwo && hosts.size < 2) { weak++; bad(`這項事實有數字，但只有一個來源：${f.claim.slice(0, 30)}…`); }
  }
  if (facts.length && !weak) ok(`查證表 ${facts.length} 項，來源數量符合規定`);
  /* 時事文案的結構：stories = [{ id, by:{ 人設id:{ open:[], fact:[], take:[], end:[] } } }]
     每則新聞、每個人設都要有好幾種開頭、事實寫法和觀點，按一次才會換一種角度 */
  const stories = Array.isArray(news.stories) ? news.stories : [];
  if (!stories.length) bad("news.json 沒有 stories");
  const texts = [];                       // [人設名, 文字]
  for (const p of active) {
    const mine = stories.filter(s => s.by && s.by[p.id]);
    if (p.news === false && !mine.length) continue;   // 這個人設目前不做每日時事
    if (mine.length < 3) bad(`${p.name} 的時事少於 3 則新聞（${mine.length}）`);
    for (const s of mine) {
      const v = s.by[p.id];
      if (!s.id) bad("有一則新聞沒有 id");
      if (!Array.isArray(v.fact) || v.fact.length < 2) bad(`${p.name}／${s.id}：事實的寫法要 2 種以上`);
      if (!Array.isArray(v.take) || v.take.length < 3) bad(`${p.name}／${s.id}：觀點要 3 種以上`);
      if (!Array.isArray(v.open) || v.open.length < 2) bad(`${p.name}／${s.id}：開頭要 2 種以上`);
      for (const k of ["open", "fact", "take", "end"]) for (const t of (v[k] || [])) {
        if (typeof t !== "string" || !t.trim()) { bad(`${p.name}／${s.id}／${k} 有空白或格式不對的句子`); continue; }
        if (k !== "end") texts.push([p.name, t]);
        for (const w of T.BANNED) if (t.includes(w)) bad(`${p.name} 的時事含禁用詞「${w}」：${t.slice(0, 30)}…`);
      }
    }
  }
  for (const s of stories) for (const id in (s.by || {})) if (!T.PERSONAS.some(p => p.id === id)) bad(`news.json 有不存在的人設 id：${id}`);
  /* 文案裡出現的每個日期和大數字，都要能在查證表裡找到 */
  const factText = facts.map(f => f.claim).join(" ");
  const loose = new Set();
  for (const [, t] of texts) for (const m of t.match(/\d{1,2}\/\d{1,2}|\d[\d,]*\.?\d*\s?%|\d{1,3}(,\d{3})+|\d{3,}/g) || []) {
    if (!factText.includes(m.replace(/\s/g, ""))) loose.add(m);
  }
  loose.size ? bad("文案裡有查證表沒列到的日期或數字：" + [...loose].join("、")) : ok("文案裡的日期和數字都在查證表裡");
  /* 不同夥伴之間不能有一模一樣的句子 */
  const seenN = new Map(); let dupN = [];
  for (const [who, t] of texts) { if (seenN.has(t) && seenN.get(t) !== who) dupN.push(`${t.slice(0, 20)}…（${seenN.get(t)}／${who}）`); else seenN.set(t, who); }
  dupN.length ? bad("時事有不同夥伴用到同一句：" + dupN.join(" | ")) : ok(`時事共 ${stories.length} 則新聞、${texts.length} 個句子，夥伴之間沒有重複`);
} catch (e) { bad("news.json 讀不到或不是合法 JSON：" + e.message); }

console.log(fail ? `\n${fail} 項未通過，不要發佈。` : "\n全部通過，可以發佈。");
process.exit(fail ? 1 : 0);
