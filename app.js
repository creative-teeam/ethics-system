// app.js（完全版）
// - 根拠確認（Web検索リンク）をデフォルト表示 & 入力中に自動更新
// - 撮影範囲欄を削除（t_shoot_rangeなし）
// - 自由記述（台本/演出メモ）でも根拠確認の候補が出る
const STORE_KEY = "stageEthicsData_v1";

// --- DOM ---
const inputText = document.getElementById("inputText");
const analyzeBtn = document.getElementById("analyzeBtn");
const clearBtn = document.getElementById("clearBtn");
const issuesList = document.getElementById("issuesList");
const questionsList = document.getElementById("questionsList");
const actionsList = document.getElementById("actionsList");
const tasksList = document.getElementById("tasksList");

// Projects
const projectTitle = document.getElementById("projectTitle");
const createProjectBtn = document.getElementById("createProjectBtn");
const projectSelect = document.getElementById("projectSelect");
const deleteProjectBtn = document.getElementById("deleteProjectBtn");

// Log input
const logElement = document.getElementById("logElement");
const logCategory = document.getElementById("logCategory");
const logIssue = document.getElementById("logIssue");
const logDecision = document.getElementById("logDecision");
const logStatus = document.getElementById("logStatus");
const logRationale = document.getElementById("logRationale");
const logAttachUrl = document.getElementById("logAttachUrl");
const logAttachMemo = document.getElementById("logAttachMemo");
const addLogBtn = document.getElementById("addLogBtn");
const clearLogsBtn = document.getElementById("clearLogsBtn");
const logsTable = document.getElementById("logsTable");

// Template
const btnApplyTemplate = document.getElementById("btnApplyTemplate");
const btnResetTemplate = document.getElementById("btnResetTemplate");
const tpl = (id) => document.getElementById(id);

// Filters
const f_q = document.getElementById("f_q");
const f_element = document.getElementById("f_element");
const f_category = document.getElementById("f_category");
const f_status = document.getElementById("f_status");
const f_reset = document.getElementById("f_reset");

// Multi date rows
const dateRows = document.getElementById("dateRows");
const btnAddDateRow = document.getElementById("btnAddDateRow");

// KPI
const kpiNeeds = document.getElementById("kpiNeeds");
const kpiDoing = document.getElementById("kpiDoing");
const kpiDone = document.getElementById("kpiDone");
const progressPct = document.getElementById("progressPct");
const progressFill = document.getElementById("progressFill");

// Web risks UI
const webRisksList = document.getElementById("webRisksList");
const webRisksError = document.getElementById("webRisksError");

// ✅ 追加検索欄
const webQuery = document.getElementById("webQuery");
const btnWebSearch = document.getElementById("btnWebSearch");

// --- utils ---
function uid() {
  return crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();
}
function nowISO() {
  return new Date().toISOString();
}
function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function safeText(s) {
  return String(s ?? "").trim();
}

// --- Data model ---
function loadData() {
  const raw = localStorage.getItem(STORE_KEY);
  if (!raw) {
    const firstId = uid();
    const init = {
      schemaVersion: "2.4.0",
      currentProjectId: firstId,
      projects: { [firstId]: { id: firstId, title: "デモ案件", logs: [], tasks: [] } }
    };
    localStorage.setItem(STORE_KEY, JSON.stringify(init));
    return init;
  }
  try {
    const d = JSON.parse(raw);
    return migrateIfNeeded(d);
  } catch {
    localStorage.removeItem(STORE_KEY);
    return loadData();
  }
}
function saveData(data) {
  localStorage.setItem(STORE_KEY, JSON.stringify(data));
}
function migrateIfNeeded(data) {
  if (!data.schemaVersion) data.schemaVersion = "1.0.0";
  if (!data.projects) data.projects = {};
  const ids = Object.keys(data.projects);

  if (!data.currentProjectId || !data.projects[data.currentProjectId]) {
    data.currentProjectId = ids[0] || null;
  }

  ids.forEach((pid) => {
    const p = data.projects[pid];
    if (!Array.isArray(p.logs)) p.logs = [];
    if (!Array.isArray(p.tasks)) p.tasks = [];
    p.logs.forEach((l) => {
      if (!l.id) l.id = uid();
      if (!l.at) l.at = nowISO();
      if (!l.status) l.status = "needs_review";
      if (!l.decision) l.decision = "要確認";
      if (!Array.isArray(l.attachments)) l.attachments = [];
      if (!l.severity) l.severity = "low";
      if (!l.rationale) l.rationale = "";
    });
  });

  data.schemaVersion = "2.4.0";
  return data;
}

// --- severity推定（簡易） ---
function estimateSeverity(element, category, issueText) {
  const t = (issueText || "").toLowerCase();
  if (category === "safety") return "high";
  if (category === "privacy" && (t.includes("未成年") || t.includes("楽屋") || t.includes("個人") || t.includes("顔"))) return "high";
  if (category === "copyright" && (t.includes("配信") || t.includes("録画") || t.includes("既存曲") || t.includes("ロゴ") || t.includes("キャラ") || t.includes("写真") || t.includes("フォント"))) return "medium";
  if (category === "ethics" && (t.includes("実在") || t.includes("事件") || t.includes("災害"))) return "medium";
  if (element === "美術" || element === "衣装" || element === "SNS") return "medium";
  return "low";
}

// --- Rule-based issue extractor ---
function extractIssues(text) {
  const raw = text || "";
  const t = raw.toLowerCase();
  const issues = [];
  const add = (element, category, issue) => issues.push({ element, category, issue });

  // 配信/収録
  if (raw.includes("配信") || raw.includes("収録") || t.includes("youtube") || t.includes("tiktok") || raw.includes("アーカイブ")) {
    add("映像", "copyright", "配信/収録がある場合、上演と配信で必要な許諾（音楽・映像素材・実演/肖像）が分かれる可能性があります。形態ごとに権利処理を整理してください。");
    add("映像", "privacy", "舞台裏/楽屋/未成年の映り込みや個人特定のリスクがあります。撮影範囲・同意取得・公開範囲を設計してください。");
  }

  // 音楽
  if (raw.includes("既存曲") || raw.includes("カバー") || raw.includes("BGM") || t.includes("j-pop") || raw.includes("音源")) {
    add("音楽", "copyright", "既存曲の利用は『上演』と『配信/録画』で許諾が変わることがあります。使用形態・区間・音源種類（生演奏/録音）を分けて確認してください。");
  }

  // 実在事件/災害
  if (raw.includes("実在") || raw.includes("事件") || raw.includes("災害")) {
    add("脚本", "ethics", "実在の事件/災害を扱う場合、当事者性・再トラウマ化・誤解や誹謗中傷の誘発リスクを評価し、注意書きや監修の導入を検討してください。");
  }

  // ストロボ/点滅
  if (raw.includes("ストロボ") || raw.includes("点滅")) {
    add("照明", "safety", "点滅・強い光は体調不良を引き起こす可能性があります。注意書き・緩和策・観客導線を検討してください。");
  }

  // 未成年
  if (raw.includes("未成年")) {
    add("全体", "privacy", "未成年出演がある場合、同意書（保護者含む）・公開範囲・撮影可否の取り扱いを明確化してください。");
  }

  // ✅ 演出メモ（自由記述）も拾う：演出/演出メモ/メモ
  if (raw.includes("演出") || raw.includes("演出メモ") || raw.includes("メモ")) {
    add("演出", "ethics", "演出メモに『演出意図』『引用元』『模倣/参照関係』が含まれる場合、後で説明できるよう根拠（出所URL/書籍名/許諾）を残してください。");
  }

  // ✅ SNS
  if (raw.includes("SNS") || t.includes("sns") || raw.includes("告知") || t.includes("twitter") || t.includes("instagram") || t.includes("tiktok") || t.includes("x")) {
    add("SNS", "privacy", "SNS告知で出演者の顔・実名・学校名などが特定されないよう配慮が必要です。未成年がいる場合は公開範囲の同意を分けて取ってください。");
    add("SNS", "copyright", "告知画像/動画で使う写真・フォント・ロゴ・キャラクター画像は権利確認が必要です（転載・スクショ利用に注意）。");
  }

  // ✅ 美術
  if (raw.includes("美術") || raw.includes("小道具") || raw.includes("大道具") || raw.includes("背景") || raw.includes("パネル") || raw.includes("ポスター") || raw.includes("造形")) {
    add("美術", "copyright", "舞台美術（背景/小道具/パネル）に既存作品の図柄・写真・キャラクター・ロゴを取り込む場合は許諾や引用要件の検討が必要です。");
  }
  if (raw.includes("ロゴ") || raw.includes("キャラ") || raw.includes("キャラクター") || raw.includes("商標")) {
    add("美術", "copyright", "ロゴ/キャラクター/商標を美術や衣装に載せる場合、著作権だけでなく商標・ブランドガイドラインにも注意が必要です。");
  }

  // ✅ 衣装
  if (raw.includes("衣装") || raw.includes("コス") || raw.includes("コスプレ") || raw.includes("既製品") || raw.includes("ブランド") || raw.includes("ユニフォーム")) {
    add("衣装", "copyright", "衣装に既製品のロゴ・柄・キャラ絵が入る場合、撮影/配信/告知に載ると権利問題になり得ます。露出する範囲・隠す対応を決めてください。");
  }

  // 何もない場合
  if (issues.length === 0) {
    add("全体", "ethics", "顕著な論点は検出できませんでした。自由記述に「配信」「SNS」「美術」「衣装」などを追記すると精度が上がります。");
  }

  // 重複除去
  const uniq = [];
  const seen = new Set();
  for (const it of issues) {
    const key = `${it.element}__${it.category}__${it.issue}`;
    if (!seen.has(key)) { seen.add(key); uniq.push(it); }
  }
  return uniq;
}

// --- 確認質問生成 ---
function generateQuestions(text) {
  const raw = text || "";
  const t = raw.toLowerCase();
  const q = [];
  const push = (s) => { if (!q.includes(s)) q.push(s); };

  if (raw.includes("配信") || t.includes("youtube") || t.includes("tiktok")) {
    push("配信はライブのみ？アーカイブ（後日公開）もありますか？");
    push("配信の公開範囲（限定公開/有料/全公開）はどれですか？");
    push("客席や未成年が映る可能性はありますか？");
  }
  if (raw.includes("既存曲") || raw.includes("BGM") || raw.includes("カバー") || raw.includes("音源")) {
    push("既存曲は生演奏ですか？録音音源ですか？");
    push("上演だけでなく録画/配信でも使いますか？（許諾が変わる可能性）");
    push("曲名・使用区間・使用回数を一覧にできますか？");
  }
  if (raw.includes("未成年")) {
    push("未成年出演者の同意（保護者含む）は取得済みですか？");
    push("写真/動画の公開範囲の同意は別で取っていますか？");
  }
  if (raw.includes("実在") || raw.includes("事件") || raw.includes("災害")) {
    push("当事者や関係者が特定されない表現になっていますか？");
    push("注意書きや監修者（第三者チェック）を入れますか？");
  }
  if (raw.includes("ストロボ") || raw.includes("点滅")) {
    push("点滅演出はどの程度の強さ/頻度ですか？注意書きは出しますか？");
  }
  if (raw.includes("SNS") || t.includes("sns") || raw.includes("告知")) {
    push("告知に使う画像/動画の素材（写真/フォント/ロゴ）の出所は確認できますか？");
    push("未成年が写る場合、公開範囲の同意は取っていますか？");
  }
  if (raw.includes("美術") || raw.includes("小道具") || raw.includes("ロゴ") || raw.includes("キャラ")) {
    push("美術に取り込む図柄・写真・ロゴ・キャラの出所（自作/引用/購入/転載）はどれですか？");
  }
  if (raw.includes("衣装") || raw.includes("既製品") || raw.includes("ブランド") || raw.includes("コス")) {
    push("衣装のロゴや柄は撮影/配信/告知で見えますか？隠す対応はしますか？");
  }
  if (raw.includes("演出") || raw.includes("演出メモ") || raw.includes("メモ")) {
    push("演出メモの参照元（作品/画像/動画/演出例）の出所はありますか？URLや書籍名を残せますか？");
  }

  if (!q.length) push("配信有無、素材の出所、改変範囲（脚本/演出/美術/衣装/SNS）を追記できますか？");
  return q;
}

// --- 対応案テンプレ ---
function generateActionTemplates(issues) {
  const out = [];
  const push = (s) => { if (!out.includes(s)) out.push(s); };

  issues.forEach((it) => {
    if (it.category === "copyright") {
      push("権利処理の表を作成（上演/配信/録画別に：楽曲、音源、映像素材、台本、美術、衣装、SNS素材）");
      push("利用許諾の範囲を文章化（期間・地域・公開形態・二次利用）");
    }
    if (it.category === "privacy") {
      push("同意取得フロー（出演者/保護者/スタッフ/映り込み）を決める");
      push("撮影可否・公開範囲を掲示（会場/配信ページ/SNS）");
    }
    if (it.category === "safety") {
      push("安全注意（点滅・音量・導線）を掲示し、代替観覧方法を用意");
    }
    if (it.category === "ethics") {
      push("注意書き（実在題材・表現配慮）＋監修/第三者レビューを検討");
    }
  });

  if (!out.length) out.push("今の情報だけでは対応案を出しにくいです。自由記述で条件を埋めてください。");
  return out;
}

// --- Tasks（チェックリスト）自動生成 ---
function generateTasksFromIssues(issues) {
  const tasks = [];
  const add = (title) => tasks.push({ id: uid(), title, status: "todo", created_at: nowISO() });

  issues.forEach((it) => {
    if (it.element === "音楽" && it.category === "copyright") {
      add("既存曲の利用一覧（曲名/区間/形態）を作成");
      add("上演/配信/録画別の許諾要否を整理");
    }
    if (it.element === "映像") {
      add("配信/収録の公開範囲（限定/有料/全公開）を確定");
      add("撮影可否の掲示文を確定");
    }
    if (it.element === "SNS") {
      add("SNS告知素材（写真/フォント/ロゴ）の出所を確認");
      add("未成年の写り込み・個人特定の回避ルールを決める");
    }
    if (it.element === "美術") {
      add("美術に取り込む図柄/写真/ロゴの権利確認");
      add("転載/引用/購入素材の証跡（URL/ライセンス）を残す");
    }
    if (it.element === "衣装") {
      add("衣装のロゴ/柄の露出範囲を確認し、隠す対応を決める");
    }
    if (it.element === "演出") {
      add("演出メモの参照元（出所URL/書籍名/許諾）を残す");
    }
    if (it.category === "privacy") {
      add("同意書フロー（出演者/保護者/スタッフ/映り込み）を確認");
    }
    if (it.category === "safety") add("点滅/音量の注意書きを作成・掲示");
    if (it.category === "ethics") add("注意書き作成（題材配慮）＋監修の要否検討");
  });

  if (!tasks.length) add("不足情報の確認（配信/素材出所/改変範囲）");
  const uniq = [];
  const seen = new Set();
  for (const t of tasks) {
    if (!seen.has(t.title)) { seen.add(t.title); uniq.push(t); }
  }
  return uniq;
}

// ------------------------
// ✅ 期間（複数）行の追加/削除
// ------------------------
function attachDateRowEvents(rowEl) {
  const delBtn = rowEl.querySelector(".btnDelDate");
  delBtn?.addEventListener("click", () => {
    const rows = dateRows?.querySelectorAll(".dateRow") || [];
    if (rows.length <= 1) {
      const fromEl = rowEl.querySelector(".f_from");
      const toEl = rowEl.querySelector(".f_to");
      if (fromEl) fromEl.value = "";
      if (toEl) toEl.value = "";
      renderAll();
      return;
    }
    rowEl.remove();
    renderAll();
  });

  rowEl.querySelector(".f_from")?.addEventListener("change", renderAll);
  rowEl.querySelector(".f_to")?.addEventListener("change", renderAll);
}

function addDateRow(from = "", to = "") {
  if (!dateRows) return;

  const row = document.createElement("div");
  row.className = "dateRow";
  row.innerHTML = `
    <input class="f_from" type="date" value="${escapeHtml(from)}" />
    <span class="dateSep">〜</span>
    <input class="f_to" type="date" value="${escapeHtml(to)}" />
    <button type="button" class="ghost danger btnDelDate" title="この期間を削除">×</button>
  `;
  dateRows.appendChild(row);
  attachDateRowEvents(row);
}

function getDateRangesFromUI() {
  const ranges = [];
  if (!dateRows) return ranges;
  const rows = Array.from(dateRows.querySelectorAll(".dateRow"));
  rows.forEach((row) => {
    const from = row.querySelector(".f_from")?.value || "";
    const to = row.querySelector(".f_to")?.value || "";
    if (!from && !to) return;
    ranges.push({ from, to });
  });
  return ranges;
}

function inDateRange(iso, from, to) {
  if (!iso) return true;
  const d = iso.slice(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

function inAnyDateRanges(iso, ranges) {
  if (!ranges || ranges.length === 0) return true;
  return ranges.some((r) => inDateRange(iso, r.from, r.to));
}

// ------------------------
// フィルタ
// ------------------------
function getActiveFilters() {
  return {
    q: (f_q?.value || "").trim().toLowerCase(),
    element: f_element?.value || "",
    category: f_category?.value || "",
    status: f_status?.value || "",
    dateRanges: getDateRangesFromUI()
  };
}

function applyLogFilters(logs) {
  const f = getActiveFilters();
  return logs.filter((l) => {
    if (f.element && l.element !== f.element) return false;
    if (f.category && l.category !== f.category) return false;
    if (f.status && l.status !== f.status) return false;
    if (!inAnyDateRanges(l.at, f.dateRanges)) return false;

    if (f.q) {
      const hay = `${l.issue || ""} ${l.rationale || ""} ${(l.attachments?.[0]?.url || "")} ${(l.attachments?.[0]?.memo || "")}`.toLowerCase();
      if (!hay.includes(f.q)) return false;
    }
    return true;
  });
}

// ------------------------
// Web検索リンク生成（デフォルト表示対応）
// ------------------------
function buildSearchUrl(query) {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function defaultWebItems() {
  // ✅ 入力が空でも出る「デフォルト根拠確認」
  return [
    { title: "舞台上演と配信の権利処理", query: "舞台 上演 配信 許諾 公衆送信権 実演家 肖像権", memo: "配信/録画/公衆送信" },
    { title: "SNS告知素材（画像・フォント・ロゴ）", query: "SNS 告知 画像 フォント ロゴ 著作権 引用 スクリーンショット", memo: "SNS素材/フォント/ロゴ" },
    { title: "舞台美術（写真・ロゴ・キャラ）の扱い", query: "舞台 美術 ロゴ キャラクター 写真 著作権 商標", memo: "美術/ロゴ/キャラ" },
    { title: "衣装（既製品・ブランド）の扱い", query: "衣装 ロゴ ブランド 既製品 撮影 配信 著作権 商標", memo: "衣装/ブランド/ロゴ" },
    { title: "未成年・同意・撮影の配慮", query: "未成年 出演 同意書 撮影 公開範囲 SNS", memo: "未成年/同意/公開範囲" },
  ].map((it) => ({ ...it, url: buildSearchUrl(it.query) }));
}

function buildWebRiskItems(text, issues) {
  const raw = safeText(text);
  const items = [];

  const push = (title, query, memo) => {
    items.push({ title, query, url: buildSearchUrl(query), memo });
  };

  // ✅ 入力が空ならデフォルトを返す
  if (!raw) return defaultWebItems();

  // 入力内容から自動生成（自由記述＝台本＋演出メモ込み）
  if (/sns|告知|twitter|instagram|tiktok|x/i.test(raw)) {
    push("SNS告知の権利・肖像・素材", "SNS 告知 画像 フォント ロゴ 著作権 肖像権 利用規約", "SNS素材/肖像/規約");
  }
  if (/(美術|小道具|大道具|背景|ロゴ|キャラ|キャラクター|商標)/.test(raw)) {
    push("舞台美術（ロゴ/キャラ/写真）の扱い", "舞台 美術 ロゴ キャラクター 写真 著作権 商標 ブランドガイドライン", "美術の権利確認");
  }
  if (/(衣装|既製品|ブランド|コス|コスプレ|ユニフォーム)/.test(raw)) {
    push("衣装（ロゴ/ブランド/柄）の扱い", "衣装 ロゴ ブランド 既製品 撮影 配信 著作権 商標", "衣装ロゴの露出");
  }
  if (/(配信|収録|youtube|tiktok|アーカイブ)/i.test(raw)) {
    push("上演と配信の許諾差", "舞台 配信 許諾 上演 公衆送信権 実演家 肖像", "配信/録画の権利処理");
  }
  if (/(既存曲|BGM|カバー|音源)/.test(raw)) {
    push("既存曲の上演/配信の違い", "既存曲 上演 配信 録画 許諾 JASRAC", "音楽の利用形態");
  }
  if (/(未成年|保護者)/.test(raw)) {
    push("未成年の同意・公開範囲", "未成年 出演 同意書 保護者 撮影 公開範囲", "未成年/同意");
  }
  if (/(演出|演出メモ|メモ|参考|参照|オマージュ|模倣)/.test(raw)) {
    push("演出メモの参照元（出所・許諾・引用）", "演出 参照 元ネタ 引用 許諾 著作権 舞台", "演出メモ/参照元");
  }

  // issuesからも補強（上位のみ）
  issues.slice(0, 8).forEach((it) => {
    const q = `舞台 ${it.element} ${it.category} ${it.issue}`.slice(0, 160);
    push(`論点：${it.element}/${it.category}`, q, `根拠探し：${it.element}/${it.category}`);
  });

  // 最後に総合
  const clip = raw.slice(0, 120);
  push("自由記述（全文）から総合検索", `舞台 著作権 肖像権 許諾 ${clip}`, "自由記述の総合確認");

  // 重複除去
  const uniq = [];
  const seen = new Set();
  for (const it of items) {
    const key = `${it.title}__${it.url}`;
    if (!seen.has(key)) { seen.add(key); uniq.push(it); }
  }
  return uniq.slice(0, 14);
}

function renderWebRisks(text, issues) {
  if (!webRisksList) return;
  if (webRisksError) webRisksError.style.display = "none";

  webRisksList.innerHTML = "";
  const items = buildWebRiskItems(text, issues);

  items.forEach((it) => {
    const box = document.createElement("div");
    box.className = "webriskItem";
    box.innerHTML = `
      <div class="webriskTop">
        <span class="webriskTitle">${escapeHtml(it.title)}</span>
        <span class="tag">${escapeHtml(it.memo || "")}</span>
      </div>
      <div style="margin-top:6px;">
        <a href="${escapeHtml(it.url)}" target="_blank" rel="noreferrer">検索を開く</a>
        <span style="color:#666; font-size:0.85rem; margin-left:8px;">（クエリ：${escapeHtml(it.query)}）</span>
      </div>
      <div class="row" style="margin-top:10px;">
        <button type="button" class="success" data-apply-url="1" data-url="${escapeHtml(it.url)}" data-memo="${escapeHtml(it.memo || "")}">添付URLに反映</button>
      </div>
    `;

    box.querySelector("button[data-apply-url]")?.addEventListener("click", () => {
      if (logAttachUrl) logAttachUrl.value = it.url;
      if (logAttachMemo) logAttachMemo.value = it.memo || "";
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    });

    webRisksList.appendChild(box);
  });
}

// ------------------------
// UI render
// ------------------------
function renderProjects(data) {
  if (!projectSelect) return;
  projectSelect.innerHTML = "";
  const ids = Object.keys(data.projects || {});
  ids.forEach((id) => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = data.projects[id].title;
    projectSelect.appendChild(opt);
  });
  projectSelect.value = data.currentProjectId;
}

function renderIssues(issues) {
  if (!issuesList) return;
  issuesList.innerHTML = "";

  issues.forEach((it) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <div>
        <span class="tag">${escapeHtml(it.element)}</span>
        <span class="tag">${escapeHtml(it.category)}</span>
      </div>
      <div style="margin-top:6px;">${escapeHtml(it.issue)}</div>
      <div class="row" style="margin-top:10px;">
        <button type="button" class="ghost" data-add="1">この論点をログに入れる</button>
      </div>
    `;

    li.querySelector("button[data-add]")?.addEventListener("click", () => {
      if (logElement) logElement.value = it.element;
      if (logCategory) logCategory.value = it.category;
      if (logIssue) logIssue.value = it.issue;
      if (logDecision) logDecision.value = "要確認";
      if (logStatus) logStatus.value = "needs_review";
      if (logRationale) logRationale.value = "";
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    });

    issuesList.appendChild(li);
  });
}

function renderMaterialOutputs(text, issues) {
  if (questionsList) {
    questionsList.innerHTML = "";
    generateQuestions(text).forEach((s) => {
      const li = document.createElement("li");
      li.textContent = s;
      questionsList.appendChild(li);
    });
  }

  if (actionsList) {
    actionsList.innerHTML = "";
    generateActionTemplates(issues).forEach((s) => {
      const li = document.createElement("li");
      li.textContent = s;
      actionsList.appendChild(li);
    });
  }

  if (tasksList) {
    tasksList.innerHTML = "";
    generateTasksFromIssues(issues).slice(0, 10).forEach((t) => {
      const li = document.createElement("li");
      li.textContent = `☐ ${t.title}`;
      tasksList.appendChild(li);
    });
  }
}

function renderLogs(data) {
  if (!logsTable) return;

  const p = data.projects[data.currentProjectId];
  const logs0 = p?.logs || [];
  const logs = applyLogFilters(logs0);

  logsTable.innerHTML = "";

  const head = document.createElement("div");
  head.className = "rowh";
  head.innerHTML = `
    <div class="cell">要素/カテゴリ</div>
    <div class="cell">論点</div>
    <div class="cell">判断</div>
    <div class="cell">進捗</div>
    <div class="cell">添付</div>
    <div class="cell">削除</div>
  `;
  logsTable.appendChild(head);

  if (logs.length === 0) {
    const empty = document.createElement("div");
    empty.className = "rowd";
    empty.innerHTML = `<div class="cell" style="grid-column:1/-1;color:#666;">該当ログがありません。</div>`;
    logsTable.appendChild(empty);
    return;
  }

  logs.forEach((l) => {
    const row = document.createElement("div");
    row.className = "rowd";

    const attach = (l.attachments || [])[0];
    const attachHtml = attach?.url
      ? `<a href="${escapeHtml(attach.url)}" target="_blank" rel="noreferrer">${escapeHtml(attach.memo || "リンク")}</a>`
      : `<span style="color:#666;">なし</span>`;

    row.innerHTML = `
      <div class="cell">
        <span class="tag">${escapeHtml(l.element)}</span>
        <span class="tag">${escapeHtml(l.category)}</span>
        <span class="tag">sev:${escapeHtml(l.severity || "low")}</span>
      </div>
      <div class="cell">
        ${escapeHtml(l.issue)}
        ${l.rationale ? `<div class="hint" style="margin-top:6px;">理由：${escapeHtml(l.rationale)}</div>` : ""}
      </div>
      <div class="cell">${escapeHtml(l.decision || "")}</div>
      <div class="cell">
        <select data-st="${escapeHtml(l.id)}">
          <option value="needs_review" ${l.status === "needs_review" ? "selected" : ""}>要確認</option>
          <option value="doing" ${l.status === "doing" ? "selected" : ""}>対応中</option>
          <option value="done" ${l.status === "done" ? "selected" : ""}>完了</option>
        </select>
      </div>
      <div class="cell">${attachHtml}</div>
      <div class="cell"><button type="button" class="ghost danger" data-del="${escapeHtml(l.id)}">×</button></div>
    `;

    row.querySelector("select[data-st]")?.addEventListener("change", (e) => {
      const newStatus = e.target.value;
      const d = loadData();
      const pp = d.projects[d.currentProjectId];
      const idx = pp.logs.findIndex((x) => x.id === l.id);
      if (idx >= 0) pp.logs[idx].status = newStatus;
      saveData(d);
      renderAll();
    });

    row.querySelector("button[data-del]")?.addEventListener("click", () => {
      if (!confirm("このログを削除しますか？")) return;
      const d = loadData();
      const pp = d.projects[d.currentProjectId];
      pp.logs = pp.logs.filter((x) => x.id !== l.id);
      saveData(d);
      renderAll();
    });

    logsTable.appendChild(row);
  });
}

function renderDashboard(data) {
  const p = data.projects[data.currentProjectId];
  const logs = p?.logs || [];
  const needs = logs.filter((l) => l.status === "needs_review").length;
  const doing = logs.filter((l) => l.status === "doing").length;
  const done = logs.filter((l) => l.status === "done").length;
  const total = logs.length || 0;
  const pct = total ? Math.round((done / total) * 100) : 0;

  if (kpiNeeds) kpiNeeds.textContent = String(needs);
  if (kpiDoing) kpiDoing.textContent = String(doing);
  if (kpiDone) kpiDone.textContent = String(done);
  if (progressPct) progressPct.textContent = `${pct}%`;
  if (progressFill) progressFill.style.width = `${pct}%`;
}

function renderAll() {
  const data = loadData();
  renderProjects(data);
  renderLogs(data);
  renderDashboard(data);
}

// ------------------------
// Template -> text（✅ 撮影範囲なし）
// ------------------------
function buildTemplateText() {
  const checks = {
    stream: tpl("t_stream")?.checked,
    archive: tpl("t_archive")?.checked,
    existing_music: tpl("t_existing_music")?.checked,
    recorded_music: tpl("t_recorded_music")?.checked,
    minors: tpl("t_minors")?.checked,
    backstage: tpl("t_backstage")?.checked,
    strobe: tpl("t_strobe")?.checked,
    real_event: tpl("t_real_event")?.checked
  };

  const lines = [];
  lines.push("【テンプレ】");
  if (checks.stream) lines.push("・配信あり（ライブ）");
  if (checks.archive) lines.push("・アーカイブあり（後日公開）");
  if (checks.existing_music) lines.push("・既存曲を使用（BGM/歌）");
  if (checks.recorded_music) lines.push("・録音音源を使用（生演奏ではない）");
  if (checks.minors) lines.push("・未成年出演あり");
  if (checks.backstage) lines.push("・舞台裏/楽屋が映る可能性あり");
  if (checks.strobe) lines.push("・ストロボ/点滅照明あり");
  if (checks.real_event) lines.push("・実在事件/災害が題材");
  lines.push("【自由記述】");
  return lines.join("\n");
}

// ------------------------
// ✅ 根拠確認を入力中に自動更新
// ------------------------
let webUpdateTimer = null;
function scheduleWebUpdate() {
  if (webUpdateTimer) clearTimeout(webUpdateTimer);
  webUpdateTimer = setTimeout(() => {
    const text = inputText?.value || "";
    const issues = extractIssues(text);
    renderWebRisks(text, issues);
  }, 150);
}

// ------------------------
// Events
// ------------------------
analyzeBtn?.addEventListener("click", () => {
  const data = loadData();
  const p = data.projects[data.currentProjectId];

  const text = inputText?.value || "";
  const issues = extractIssues(text);

  renderIssues(issues);
  renderMaterialOutputs(text, issues);

  // ✅ 解析時も根拠確認を更新
  renderWebRisks(text, issues);

  // tasks（案件に貯める：重複回避）
  const newTasks = generateTasksFromIssues(issues);
  const existingTitles = new Set((p.tasks || []).map((t) => t.title));
  newTasks.forEach((t) => {
    if (!existingTitles.has(t.title)) p.tasks.push(t);
  });

  saveData(data);
  renderAll();
});

// ✅ 入力中に根拠確認更新（自由記述＝演出メモ含む）
inputText?.addEventListener("input", scheduleWebUpdate);

// ✅ 追加検索欄：手動で検索リンクを追加
btnWebSearch?.addEventListener("click", () => {
  const q = safeText(webQuery?.value || "");
  if (!q) return alert("キーワードを入力してください。");
  const url = buildSearchUrl(q);

  // 追加した検索を先頭に表示するため、仮のitems描画を上書き
  const text = inputText?.value || "";
  const issues = extractIssues(text);

  // 既存リストを作り、先頭に追加
  const items = buildWebRiskItems(text, issues);
  items.unshift({ title: "手動追加検索", query: q, url, memo: "手動入力" });

  if (webRisksList) {
    webRisksList.innerHTML = "";
    items.slice(0, 14).forEach((it) => {
      const box = document.createElement("div");
      box.className = "webriskItem";
      box.innerHTML = `
        <div class="webriskTop">
          <span class="webriskTitle">${escapeHtml(it.title)}</span>
          <span class="tag">${escapeHtml(it.memo || "")}</span>
        </div>
        <div style="margin-top:6px;">
          <a href="${escapeHtml(it.url)}" target="_blank" rel="noreferrer">検索を開く</a>
          <span style="color:#666; font-size:0.85rem; margin-left:8px;">（クエリ：${escapeHtml(it.query)}）</span>
        </div>
        <div class="row" style="margin-top:10px;">
          <button type="button" class="success" data-apply-url="1">添付URLに反映</button>
        </div>
      `;
      box.querySelector("button[data-apply-url]")?.addEventListener("click", () => {
        if (logAttachUrl) logAttachUrl.value = it.url;
        if (logAttachMemo) logAttachMemo.value = it.memo || "";
        window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
      });
      webRisksList.appendChild(box);
    });
  }

  if (webQuery) webQuery.value = "";
});

clearBtn?.addEventListener("click", () => {
  if (inputText) inputText.value = "";
  if (issuesList) issuesList.innerHTML = "";
  if (questionsList) questionsList.innerHTML = "";
  if (actionsList) actionsList.innerHTML = "";
  if (tasksList) tasksList.innerHTML = "";
  // ✅ 空でもデフォルト根拠確認を出す
  renderWebRisks("", []);
});

// Projects
createProjectBtn?.addEventListener("click", () => {
  const title = safeText(projectTitle?.value || "");
  if (!title) return alert("案件名を入力してください");

  const data = loadData();
  const id = uid();
  data.projects[id] = { id, title, logs: [], tasks: [] };
  data.currentProjectId = id;
  saveData(data);

  if (projectTitle) projectTitle.value = "";
  renderAll();
});

projectSelect?.addEventListener("change", () => {
  const data = loadData();
  data.currentProjectId = projectSelect.value;
  saveData(data);
  renderAll();
});

deleteProjectBtn?.addEventListener("click", () => {
  const data = loadData();
  const id = data.currentProjectId;
  const keys = Object.keys(data.projects);

  if (keys.length <= 1) return alert("最後の案件は削除できません");
  if (!confirm("この案件を削除しますか？（ログも消えます）")) return;

  delete data.projects[id];
  data.currentProjectId = Object.keys(data.projects)[0];
  saveData(data);
  renderAll();
});

// Logs
addLogBtn?.addEventListener("click", () => {
  const issue = safeText(logIssue?.value || "");
  if (!issue) return alert("論点（issue）を入力してください");

  const data = loadData();
  const p = data.projects[data.currentProjectId];

  const attUrl = safeText(logAttachUrl?.value || "");
  const attMemo = safeText(logAttachMemo?.value || "");
  const attachments = [];
  if (attUrl) attachments.push({ url: attUrl, memo: attMemo || "添付" });

  const element = logElement?.value || "全体";
  const category = logCategory?.value || "ethics";
  const severity = estimateSeverity(element, category, issue);

  p.logs.unshift({
    id: uid(),
    at: nowISO(),
    element,
    category,
    issue,
    decision: logDecision?.value || "要確認",
    rationale: safeText(logRationale?.value || ""),
    status: logStatus?.value || "needs_review",
    severity,
    attachments
  });

  saveData(data);

  if (logIssue) logIssue.value = "";
  if (logRationale) logRationale.value = "";
  if (logAttachUrl) logAttachUrl.value = "";
  if (logAttachMemo) logAttachMemo.value = "";

  renderAll();
});

clearLogsBtn?.addEventListener("click", () => {
  if (!confirm("この案件のログを全削除しますか？")) return;
  const data = loadData();
  data.projects[data.currentProjectId].logs = [];
  saveData(data);
  renderAll();
});

// Template
btnApplyTemplate?.addEventListener("click", () => {
  const t = buildTemplateText();
  const cur = inputText?.value || "";
  if (inputText) inputText.value = cur ? `${t}\n\n${cur}` : t;

  // ✅ テンプレ反映した直後も根拠確認更新
  scheduleWebUpdate();
});

btnResetTemplate?.addEventListener("click", () => {
  [
    "t_stream","t_archive","t_existing_music","t_recorded_music",
    "t_minors","t_backstage","t_strobe","t_real_event"
  ].forEach((id) => {
    const el = tpl(id);
    if (el) el.checked = false;
  });
});

// Filters
[f_q, f_element, f_category, f_status].forEach((el) => {
  el?.addEventListener("input", renderAll);
  el?.addEventListener("change", renderAll);
});

// Date rows add
btnAddDateRow?.addEventListener("click", () => {
  addDateRow("", "");
  renderAll();
});

// 初期行にイベント付与
if (dateRows) {
  const first = dateRows.querySelector(".dateRow");
  if (first) attachDateRowEvents(first);
}

// フィルタ解除
f_reset?.addEventListener("click", () => {
  if (f_q) f_q.value = "";
  if (f_element) f_element.value = "";
  if (f_category) f_category.value = "";
  if (f_status) f_status.value = "";

  if (dateRows) {
    dateRows.innerHTML = "";
    addDateRow("", "");
  }
  renderAll();
});

// init
renderAll();

// ✅ ページ起動時点で根拠確認をデフォルト表示（入力が空でも出る）
renderWebRisks(inputText?.value || "", extractIssues(inputText?.value || ""));
