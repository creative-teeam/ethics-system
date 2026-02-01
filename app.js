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

// ⑤ Unified (filter + log common)
const f_q = document.getElementById("f_q");
const logElement = document.getElementById("logElement");   // ✅ filter兼ログ（統一）
const logCategory = document.getElementById("logCategory"); // ✅ filter兼ログ（統一）
const logStatus = document.getElementById("logStatus");     // ✅ filter兼ログ（統一）
const f_reset = document.getElementById("f_reset");

// periods UI
const dateRows = document.getElementById("dateRows");
const btnAddDateRow = document.getElementById("btnAddDateRow");

// Log body input
const logIssue = document.getElementById("logIssue");
const logDecision = document.getElementById("logDecision");
const logRationale = document.getElementById("logRationale");
const logAttachUrl = document.getElementById("logAttachUrl");
const logAttachMemo = document.getElementById("logAttachMemo");
const addLogBtn = document.getElementById("addLogBtn");
const clearLogsBtn = document.getElementById("clearLogsBtn");
const logsTable = document.getElementById("logsTable");

// KPI
const kpiNeeds = document.getElementById("kpiNeeds");
const kpiDoing = document.getElementById("kpiDoing");
const kpiDone = document.getElementById("kpiDone");
const progressPct = document.getElementById("progressPct");
const progressFill = document.getElementById("progressFill");

// Web risks UI
const webRisksList = document.getElementById("webRisksList");
const webRisksError = document.getElementById("webRisksError");
const webQuery = document.getElementById("webQuery");
const btnWebSearch = document.getElementById("btnWebSearch");

// Template
const btnApplyTemplate = document.getElementById("btnApplyTemplate");
const btnResetTemplate = document.getElementById("btnResetTemplate");
const tpl = (id) => document.getElementById(id);

// --- utils ---
function uid() {
  return crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();
}
function nowISO() { return new Date().toISOString(); }
function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function safeText(s) { return String(s ?? "").trim(); }

// --- Data model ---
function loadData() {
  const raw = localStorage.getItem(STORE_KEY);
  if (!raw) {
    const firstId = uid();
    const init = {
      schemaVersion: "2.5.0",
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
      if (!l.rationale) l.rationale = "";
      if (!Array.isArray(l.periods)) l.periods = []; // ✅ 追加：ログに期間を保存
      if (!l.filterSnapshot) l.filterSnapshot = null;
    });
  });

  data.schemaVersion = "2.5.0";
  return data;
}

// --- severity（簡易） ---
function estimateSeverity(element, category, issueText) {
  const t = (issueText || "").toLowerCase();
  if (category === "safety") return "high";
  if (category === "privacy" && (t.includes("未成年") || t.includes("楽屋") || t.includes("個人") || t.includes("顔"))) return "high";
  if (category === "copyright" && (t.includes("配信") || t.includes("録画") || t.includes("既存曲") || t.includes("ロゴ") || t.includes("キャラ") || t.includes("写真") || t.includes("フォント"))) return "medium";
  if (element === "美術" || element === "衣装" || element === "SNS") return "medium";
  return "low";
}

// --- Rule-based extractor（①〜③用：最低限） ---
function extractIssues(text) {
  const raw = text || "";
  const t = raw.toLowerCase();
  const issues = [];
  const add = (element, category, issue) => issues.push({ element, category, issue });

  if (raw.includes("配信") || raw.includes("収録") || t.includes("youtube") || t.includes("tiktok") || raw.includes("アーカイブ")) {
    add("映像", "copyright", "配信/収録がある場合、上演と配信で必要な許諾が分かれる可能性があります。形態ごとに権利処理を整理してください。");
    add("映像", "privacy", "舞台裏/楽屋/未成年の映り込みや個人特定のリスクがあります。撮影範囲・同意取得・公開範囲を設計してください。");
  }
  if (raw.includes("既存曲") || raw.includes("カバー") || raw.includes("BGM") || raw.includes("音源")) {
    add("音楽", "copyright", "既存曲の利用は『上演』と『配信/録画』で許諾が変わることがあります。使用形態を分けて確認してください。");
  }
  if (raw.includes("SNS") || t.includes("sns") || raw.includes("告知") || t.includes("twitter") || t.includes("instagram") || t.includes("x")) {
    add("SNS", "copyright", "告知画像/動画で使う写真・フォント・ロゴ・キャラクター画像は権利確認が必要です。");
    add("SNS", "privacy", "SNS告知で個人特定・未成年の公開範囲に配慮が必要です。");
  }
  if (raw.includes("美術") || raw.includes("小道具") || raw.includes("背景") || raw.includes("ロゴ") || raw.includes("キャラ")) {
    add("美術", "copyright", "舞台美術に既存作品の図柄・写真・キャラ・ロゴを取り込む場合は許諾や引用要件の検討が必要です。");
  }
  if (raw.includes("衣装") || raw.includes("既製品") || raw.includes("ブランド") || raw.includes("コス")) {
    add("衣装", "copyright", "衣装にロゴ・柄・キャラ絵が入る場合、撮影/配信/告知に載ると権利問題になり得ます。露出範囲を決めてください。");
  }
  if (issues.length === 0) add("全体", "ethics", "顕著な論点は検出できませんでした。自由記述を追記すると精度が上がります。");

  const uniq = [];
  const seen = new Set();
  for (const it of issues) {
    const key = `${it.element}__${it.category}__${it.issue}`;
    if (!seen.has(key)) { seen.add(key); uniq.push(it); }
  }
  return uniq;
}

function generateQuestions(text) {
  const raw = text || "";
  const t = raw.toLowerCase();
  const q = [];
  const push = (s) => { if (!q.includes(s)) q.push(s); };

  if (raw.includes("配信") || t.includes("youtube") || t.includes("tiktok")) {
    push("配信はライブのみ？アーカイブ（後日公開）もありますか？");
    push("配信の公開範囲（限定公開/有料/全公開）はどれですか？");
  }
  if (raw.includes("既存曲") || raw.includes("BGM") || raw.includes("音源")) {
    push("既存曲は生演奏ですか？録音音源ですか？");
    push("上演だけでなく録画/配信でも使いますか？");
  }
  if (raw.includes("SNS") || t.includes("sns") || raw.includes("告知")) {
    push("告知素材（写真/フォント/ロゴ）の出所は確認できますか？");
  }
  if (raw.includes("美術") || raw.includes("ロゴ") || raw.includes("キャラ")) {
    push("美術に取り込む素材の出所（自作/購入/転載/引用）はどれですか？");
  }
  if (raw.includes("衣装") || raw.includes("ブランド")) {
    push("衣装のロゴ/柄は配信や告知で見えますか？隠す対応はしますか？");
  }
  if (!q.length) push("配信有無、素材出所、公開範囲（SNS/配信）など条件を追記できますか？");
  return q;
}

function generateActionTemplates(issues) {
  const out = [];
  const push = (s) => { if (!out.includes(s)) out.push(s); };
  issues.forEach((it) => {
    if (it.category === "copyright") {
      push("権利処理の表を作成（上演/配信/録画別に：楽曲、音源、映像素材、美術、衣装、SNS素材）");
    }
    if (it.category === "privacy") {
      push("同意取得フロー（出演者/保護者/スタッフ/映り込み）を決める");
    }
    if (it.category === "safety") push("安全注意（点滅・音量・導線）を掲示");
    if (it.category === "ethics") push("注意書き＋第三者レビューを検討");
  });
  if (!out.length) out.push("情報が不足しています。自由記述に条件を追記してください。");
  return out;
}

function generateTasksFromIssues(issues) {
  const tasks = [];
  const add = (title) => tasks.push({ id: uid(), title, status: "todo", created_at: nowISO() });
  issues.forEach((it) => {
    if (it.element === "音楽") add("既存曲の利用一覧（曲名/区間/形態）を作成");
    if (it.element === "映像") add("配信/収録の公開範囲を確定");
    if (it.element === "SNS") add("SNS告知素材の出所（写真/フォント/ロゴ）を確認");
    if (it.element === "美術") add("美術素材の権利確認（ロゴ/写真/キャラ等）");
    if (it.element === "衣装") add("衣装ロゴ/柄の露出範囲を確認");
  });
  const uniq = [];
  const seen = new Set();
  for (const t of tasks) {
    if (!seen.has(t.title)) { seen.add(t.title); uniq.push(t); }
  }
  return uniq.length ? uniq : [{ id: uid(), title: "不足情報の確認（配信/素材出所/公開範囲）", status: "todo", created_at: nowISO() }];
}

// ------------------------
// ✅ 期間（複数行）UI
// ------------------------
function attachDateRowEvents(rowEl) {
  const delBtn = rowEl.querySelector(".btnDelDate");
  delBtn?.addEventListener("click", () => {
    const rows = dateRows?.querySelectorAll(".dateRow") || [];
    if (rows.length <= 1) {
      rowEl.querySelector(".f_from").value = "";
      rowEl.querySelector(".f_to").value = "";
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

// --- 期間の重なり判定（フィルタ用）
// どちらも from/to が空の可能性あり。空は無限として扱う。
function normalizeRange(r) {
  const from = r.from || "0000-01-01";
  const to = r.to || "9999-12-31";
  return { from, to };
}
function rangesOverlap(a, b) {
  const A = normalizeRange(a);
  const B = normalizeRange(b);
  return !(A.to < B.from || B.to < A.from);
}
function logMatchesFilterPeriods(logPeriods, filterPeriods) {
  if (!filterPeriods || filterPeriods.length === 0) return true; // フィルタ期間なし→全部
  if (!logPeriods || logPeriods.length === 0) return false;      // フィルタ期間あり＆ログに期間なし→除外
  return filterPeriods.some(fp => logPeriods.some(lp => rangesOverlap(fp, lp)));
}

// ------------------------
// ⑤ フィルタ（要素/カテゴリ/ステータスは logElement/logCategory/logStatus を使う）
// ------------------------
function getActiveFilters() {
  return {
    q: (f_q?.value || "").trim().toLowerCase(),
    element: logElement?.value || "",
    category: logCategory?.value || "",
    status: logStatus?.value || "",
    dateRanges: getDateRangesFromUI()
  };
}

function applyLogFilters(logs) {
  const f = getActiveFilters();
  return logs.filter((l) => {
    // element/category/status は統一UIなので、常に指定される
    // 「全部」概念がないので、フィルタとして扱うために
    // ここでは "空なら全て" は不要。常に一致させると絞り込み強すぎなので、
    // 代わりに「フィルタON/OFF」を q と期間で行う設計。
    // ただしユーザーが選んだ要素/カテゴリ/ステータスで絞りたいので、適用する。
    if (f.element && l.element !== f.element) return false;
    if (f.category && l.category !== f.category) return false;
    if (f.status && l.status !== f.status) return false;

    // ✅ 期間は log.periods に対して重なりで判定
    if (f.dateRanges.length > 0) {
      if (!logMatchesFilterPeriods(l.periods || [], f.dateRanges)) return false;
    }

    if (f.q) {
      const att = (l.attachments?.[0] || {});
      const hay = `${l.issue || ""} ${l.rationale || ""} ${att.url || ""} ${att.memo || ""} ${JSON.stringify(l.periods || [])} ${JSON.stringify(l.filterSnapshot || {})}`.toLowerCase();
      if (!hay.includes(f.q)) return false;
    }
    return true;
  });
}

// ------------------------
// Projects render
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

// ------------------------
// Issues / outputs render（①〜③）
// ------------------------
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
      // ✅ ⑤は統一UIなので、ここへセットするだけでログに使える
      if (logElement) logElement.value = it.element;
      if (logCategory) logCategory.value = it.category;
      if (logIssue) logIssue.value = it.issue;
      if (logStatus) logStatus.value = "needs_review";
      if (logDecision) logDecision.value = "要確認";
      if (logRationale) logRationale.value = "";
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
      renderAll(); // フィルタにも影響するので更新
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

// ------------------------
// Web risks（③） ※簡易（前回の仕様維持）
// ------------------------
function buildSearchUrl(query) {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}
function defaultWebItems() {
  return [
    { title: "舞台上演と配信の権利処理", query: "舞台 上演 配信 許諾 公衆送信権 実演家 肖像権", memo: "配信/録画/公衆送信" },
    { title: "SNS告知素材（画像・フォント・ロゴ）", query: "SNS 告知 画像 フォント ロゴ 著作権 引用 スクリーンショット", memo: "SNS素材/フォント/ロゴ" },
    { title: "舞台美術（写真・ロゴ・キャラ）の扱い", query: "舞台 美術 ロゴ キャラクター 写真 著作権 商標", memo: "美術/ロゴ/キャラ" },
    { title: "衣装（既製品・ブランド）の扱い", query: "衣装 ロゴ ブランド 既製品 撮影 配信 著作権 商標", memo: "衣装/ブランド/ロゴ" },
    { title: "未成年・同意・撮影の配慮", query: "未成年 出演 同意書 撮影 公開範囲 SNS", memo: "未成年/同意/公開範囲" },
  ].map((it) => ({ ...it, url: buildSearchUrl(it.query) }));
}
function buildWebRiskItems(text) {
  const raw = safeText(text);
  if (!raw) return defaultWebItems();
  const items = [];
  const push = (title, query, memo) => items.push({ title, query, memo, url: buildSearchUrl(query) });

  if (/sns|告知|twitter|instagram|tiktok|x/i.test(raw)) push("SNS告知の権利・素材", "SNS 告知 画像 フォント ロゴ 著作権 利用規約", "SNS");
  if (/(美術|小道具|大道具|背景|ロゴ|キャラ|商標)/.test(raw)) push("美術の権利確認", "舞台 美術 ロゴ キャラクター 写真 著作権 商標", "美術");
  if (/(衣装|既製品|ブランド|コス)/.test(raw)) push("衣装の権利確認", "衣装 ロゴ ブランド 既製品 撮影 配信 著作権 商標", "衣装");
  if (/(配信|収録|youtube|tiktok|アーカイブ)/i.test(raw)) push("配信の権利処理", "舞台 配信 許諾 公衆送信権 実演家 肖像", "配信");
  if (/(既存曲|BGM|音源)/.test(raw)) push("既存曲の許諾", "既存曲 上演 配信 録画 許諾 JASRAC", "音楽");

  push("自由記述から総合検索", `舞台 著作権 肖像権 許諾 ${raw.slice(0, 120)}`, "総合");
  return items.slice(0, 12);
}
function renderWebRisks(text) {
  if (!webRisksList) return;
  if (webRisksError) webRisksError.style.display = "none";
  webRisksList.innerHTML = "";
  const items = buildWebRiskItems(text);

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
        <button type="button" class="success" data-apply="1">添付URLに反映</button>
      </div>
    `;
    box.querySelector("button[data-apply]")?.addEventListener("click", () => {
      if (logAttachUrl) logAttachUrl.value = it.url;
      if (logAttachMemo) logAttachMemo.value = it.memo || "";
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    });
    webRisksList.appendChild(box);
  });
}

// ------------------------
// ⑤ Logs render（期間列を表示）
// ------------------------
function formatPeriods(periods) {
  if (!periods || periods.length === 0) return "—";
  return periods.map(p => {
    const a = p.from || "未設定";
    const b = p.to || "未設定";
    return `${a}〜${b}`;
  }).join(" / ");
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
    <div class="cell">論点（＋理由）</div>
    <div class="cell">判断</div>
    <div class="cell">進捗</div>
    <div class="cell">期間/添付</div>
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
      : `<span style="color:#666;">添付なし</span>`;

    const periodsText = formatPeriods(l.periods);
    const snap = l.filterSnapshot ? `<div class="hint" style="margin-top:6px;">保存時検索: ${escapeHtml(l.filterSnapshot.q || "—")}</div>` : "";

    row.innerHTML = `
      <div class="cell">
        <span class="tag">${escapeHtml(l.element)}</span>
        <span class="tag">${escapeHtml(l.category)}</span>
        <span class="tag">sev:${escapeHtml(l.severity || "low")}</span>
      </div>

      <div class="cell">
        ${escapeHtml(l.issue)}
        ${l.rationale ? `<div class="hint" style="margin-top:6px;">理由：${escapeHtml(l.rationale)}</div>` : ""}
        ${snap}
      </div>

      <div class="cell">${escapeHtml(l.decision || "")}</div>

      <div class="cell">
        <select data-st="${escapeHtml(l.id)}">
          <option value="needs_review" ${l.status === "needs_review" ? "selected" : ""}>要確認</option>
          <option value="doing" ${l.status === "doing" ? "selected" : ""}>対応中</option>
          <option value="done" ${l.status === "done" ? "selected" : ""}>完了</option>
        </select>
      </div>

      <div class="cell">
        <div>${escapeHtml(periodsText)}</div>
        <div style="margin-top:6px;">${attachHtml}</div>
      </div>

      <div class="cell">
        <button type="button" class="ghost danger" data-del="${escapeHtml(l.id)}">×</button>
      </div>
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
// Template -> text（④以前維持）
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
// Events（①〜④）
// ------------------------
analyzeBtn?.addEventListener("click", () => {
  const data = loadData();
  const p = data.projects[data.currentProjectId];

  const text = inputText?.value || "";
  const issues = extractIssues(text);

  renderIssues(issues);
  renderMaterialOutputs(text, issues);
  renderWebRisks(text);

  const newTasks = generateTasksFromIssues(issues);
  const existingTitles = new Set((p.tasks || []).map((t) => t.title));
  newTasks.forEach((t) => {
    if (!existingTitles.has(t.title)) p.tasks.push(t);
  });

  saveData(data);
  renderAll();
});

let webTimer = null;
function scheduleWebUpdate() {
  if (webTimer) clearTimeout(webTimer);
  webTimer = setTimeout(() => renderWebRisks(inputText?.value || ""), 120);
}
inputText?.addEventListener("input", scheduleWebUpdate);

btnWebSearch?.addEventListener("click", () => {
  const q = safeText(webQuery?.value || "");
  if (!q) return alert("キーワードを入力してください。");
  const url = buildSearchUrl(q);

  const box = document.createElement("div");
  box.className = "webriskItem";
  box.innerHTML = `
    <div class="webriskTop">
      <span class="webriskTitle">手動追加検索</span>
      <span class="tag">手動入力</span>
    </div>
    <div style="margin-top:6px;">
      <a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">検索を開く</a>
      <span style="color:#666; font-size:0.85rem; margin-left:8px;">（クエリ：${escapeHtml(q)}）</span>
    </div>
    <div class="row" style="margin-top:10px;">
      <button type="button" class="success" data-apply="1">添付URLに反映</button>
    </div>
  `;
  box.querySelector("button[data-apply]")?.addEventListener("click", () => {
    if (logAttachUrl) logAttachUrl.value = url;
    if (logAttachMemo) logAttachMemo.value = "手動入力";
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  });

  webRisksList?.prepend(box);
  if (webQuery) webQuery.value = "";
});

clearBtn?.addEventListener("click", () => {
  if (inputText) inputText.value = "";
  if (issuesList) issuesList.innerHTML = "";
  if (questionsList) questionsList.innerHTML = "";
  if (actionsList) actionsList.innerHTML = "";
  if (tasksList) tasksList.innerHTML = "";
  renderWebRisks("");
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

// Template
btnApplyTemplate?.addEventListener("click", () => {
  const t = buildTemplateText();
  const cur = inputText?.value || "";
  if (inputText) inputText.value = cur ? `${t}\n\n${cur}` : t;
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

// ------------------------
// ✅ ⑤：ログ追加（期間も保存／フィルタ設定もスナップ保存）
// ------------------------
addLogBtn?.addEventListener("click", () => {
  const issue = safeText(logIssue?.value || "");
  if (!issue) return alert("論点（issue）を入力してください");

  const data = loadData();
  const p = data.projects[data.currentProjectId];

  const element = logElement?.value || "全体";
  const category = logCategory?.value || "ethics";
  const status = logStatus?.value || "needs_review";
  const decision = logDecision?.value || "要確認";
  const rationale = safeText(logRationale?.value || "");

  // ✅ 期間：現在UIに入っている期間をログへ保存
  const periods = getDateRangesFromUI();

  // 添付
  const attUrl = safeText(logAttachUrl?.value || "");
  const attMemo = safeText(logAttachMemo?.value || "");
  const attachments = [];
  if (attUrl) attachments.push({ url: attUrl, memo: attMemo || "添付" });

  const severity = estimateSeverity(element, category, issue);

  // ✅ フィルタ（検索語）もスナップとして保存（要求の「検索〜を1つのログに保存」対応）
  const filterSnapshot = {
    q: safeText(f_q?.value || ""),
    element, category, status,
    periods: periods.map(x => ({ from: x.from || "", to: x.to || "" }))
  };

  p.logs.unshift({
    id: uid(),
    at: nowISO(),
    element,
    category,
    issue,
    decision,
    rationale,
    status,
    severity,
    periods,
    attachments,
    filterSnapshot
  });

  saveData(data);

  // 入力欄クリア（共通設定は維持）
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

// ✅ ⑤フィルタ：検索・要素・カテゴリ・ステータス・期間の変更で即反映
[f_q, logElement, logCategory, logStatus].forEach((el) => {
  el?.addEventListener("input", renderAll);
  el?.addEventListener("change", renderAll);
});

// periods add
btnAddDateRow?.addEventListener("click", () => {
  addDateRow("", "");
  renderAll();
});

// 初期行にイベント付与
if (dateRows) {
  const first = dateRows.querySelector(".dateRow");
  if (first) attachDateRowEvents(first);
}

// フィルタ解除（共通設定は初期値へ、ログ本文は消さない）
f_reset?.addEventListener("click", () => {
  if (f_q) f_q.value = "";
  if (logElement) logElement.value = "脚本";
  if (logCategory) logCategory.value = "copyright";
  if (logStatus) logStatus.value = "needs_review";

  if (dateRows) {
    dateRows.innerHTML = "";
    addDateRow("", "");
  }

  renderAll();
});

// init
renderAll();
renderWebRisks(inputText?.value || "");
