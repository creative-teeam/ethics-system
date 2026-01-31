// app.js（LocalStorage版：index.html一致・期間（複数）追加対応 + フィルタ操作ログ + 自由記述Web根拠動線）

const STORE_KEY = "stageEthicsData_v1";

// --- DOM ---
const inputText = document.getElementById("inputText");
const analyzeBtn = document.getElementById("analyzeBtn");
const clearBtn = document.getElementById("clearBtn");
const issuesList = document.getElementById("issuesList");
const questionsList = document.getElementById("questionsList");
const actionsList = document.getElementById("actionsList");
const tasksList = document.getElementById("tasksList");
const webRisksList = document.getElementById("webRisksList");

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

// Template UI
const btnApplyTemplate = document.getElementById("btnApplyTemplate");
const btnResetTemplate = document.getElementById("btnResetTemplate");
const tpl = (id) => document.getElementById(id);

// Filters
const f_q = document.getElementById("f_q");
const f_element = document.getElementById("f_element");
const f_category = document.getElementById("f_category");
const f_status = document.getElementById("f_status");
const f_reset = document.getElementById("f_reset");

// ✅ Multi date rows
const dateRows = document.getElementById("dateRows");
const btnAddDateRow = document.getElementById("btnAddDateRow");

// KPI
const kpiNeeds = document.getElementById("kpiNeeds");
const kpiDoing = document.getElementById("kpiDoing");
const kpiDone = document.getElementById("kpiDone");
const progressPct = document.getElementById("progressPct");
const progressFill = document.getElementById("progressFill");

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
function safeUrl(u) {
  const t = (u || "").trim();
  if (!t) return "";
  try {
    const url = new URL(t);
    return url.toString();
  } catch {
    return "";
  }
}

// --- Data model ---
// data = { schemaVersion, currentProjectId, projects: { [id]: { id, title, logs: [], tasks: [], filterLogs: [] } } }
function loadData() {
  const raw = localStorage.getItem(STORE_KEY);
  if (!raw) {
    const firstId = uid();
    const init = {
      schemaVersion: "2.3.0",
      currentProjectId: firstId,
      projects: {
        [firstId]: { id: firstId, title: "デモ案件", logs: [], tasks: [], filterLogs: [] }
      }
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
    if (!Array.isArray(p.filterLogs)) p.filterLogs = [];

    p.logs.forEach((l) => {
      if (!l.id) l.id = uid();
      if (!l.at) l.at = nowISO();
      if (!l.status) l.status = "needs_review";
      if (!Array.isArray(l.attachments)) l.attachments = [];
      if (!l.severity) l.severity = "low";
    });
  });

  data.schemaVersion = "2.3.0";
  return data;
}

// --- AI補助（ルール）: severity推定 ---
function estimateSeverity(element, category, issueText) {
  const t = (issueText || "").toLowerCase();
  if (category === "safety") return "high";
  if (category === "privacy" && (t.includes("未成年") || t.includes("楽屋") || t.includes("個人特定"))) return "high";
  if (category === "copyright" && (t.includes("配信") || t.includes("録画") || t.includes("既存曲") || t.includes("引用"))) return "medium";
  if (category === "ethics" && (t.includes("実在") || t.includes("事件") || t.includes("災害"))) return "medium";
  return "low";
}

// --- Rule-based issue extractor (no AI) ---
function extractIssues(text) {
  const t = (text || "").toLowerCase();
  const issues = [];
  const add = (element, category, issue) => issues.push({ element, category, issue });

  if (text.includes("配信") || text.includes("収録") || t.includes("youtube") || t.includes("tiktok") || text.includes("アーカイブ")) {
    add("映像", "copyright", "配信/収録がある場合、上演と配信で必要な許諾（音楽・映像素材・実演/肖像）が分かれる可能性があります。形態ごとに権利処理を整理してください。");
    add("映像", "privacy", "舞台裏/楽屋/未成年の映り込みや個人特定のリスクがあります。撮影範囲・同意取得・公開範囲を設計してください。");
  }
  if (text.includes("既存曲") || text.includes("カバー") || text.includes("BGM") || t.includes("j-pop") || text.includes("音源")) {
    add("音楽", "copyright", "既存曲の利用は『上演』と『配信/録画』で許諾が変わることがあります。使用形態・区間・音源種類（生演奏/録音）を分けて確認してください。");
  }
  if (text.includes("実在") || text.includes("事件") || text.includes("災害")) {
    add("脚本", "ethics", "実在の事件/災害を扱う場合、当事者性・再トラウマ化・誤解や誹謗中傷の誘発リスクを評価し、注意書きや監修の導入を検討してください。");
  }
  if (text.includes("ストロボ") || text.includes("点滅")) {
    add("照明", "safety", "点滅・強い光は体調不良を引き起こす可能性があります。注意書き・緩和策・観客導線を検討してください。");
  }
  if (text.includes("未成年")) {
    add("全体", "privacy", "未成年出演がある場合、同意書（保護者含む）・公開範囲・撮影可否の取り扱いを明確化してください。");
  }
  if (issues.length === 0) {
    add("全体", "ethics", "顕著な論点は検出できませんでした。『配信有無』『素材の出所』『改変範囲（脚本/演出）』などの情報を追記すると精度が上がります。");
  }
  return issues;
}

// --- AI補助（ルール）: 確認質問生成 ---
function generateQuestions(text) {
  const t = text || "";
  const q = [];
  const push = (s) => { if (!q.includes(s)) q.push(s); };

  if (t.includes("配信") || t.toLowerCase().includes("youtube") || t.toLowerCase().includes("tiktok")) {
    push("配信はライブのみ？アーカイブ（後日公開）もありますか？");
    push("配信の公開範囲（限定公開/有料/全公開）はどれですか？");
    push("客席や未成年が映る可能性はありますか？撮影範囲は？");
  }
  if (t.includes("既存曲") || t.includes("BGM") || t.includes("カバー") || t.includes("音源")) {
    push("既存曲は生演奏ですか？録音音源ですか？");
    push("上演だけでなく録画/配信でも使いますか？（許諾が変わる可能性）");
    push("曲名・使用区間・使用回数を一覧にできますか？");
  }
  if (t.includes("未成年")) {
    push("未成年出演者の同意（保護者含む）は取得済みですか？");
    push("写真/動画の公開範囲の同意は別で取っていますか？");
  }
  if (t.includes("実在") || t.includes("事件") || t.includes("災害")) {
    push("当事者や関係者が特定されない表現になっていますか？");
    push("注意書きや監修者（第三者チェック）を入れますか？");
  }
  if (t.includes("ストロボ") || t.includes("点滅")) {
    push("点滅演出はどの程度の強さ/頻度ですか？注意書きは出しますか？");
  }
  if (!q.length) push("配信有無、素材の出所、改変範囲（脚本/演出）を追記できますか？");

  return q;
}

// --- AI補助（ルール）: 対応案テンプレ ---
function generateActionTemplates(issues) {
  const out = [];
  const push = (s) => { if (!out.includes(s)) out.push(s); };

  issues.forEach((it) => {
    if (it.category === "copyright") {
      push("権利処理の表を作成（上演/配信/録画別に：楽曲、音源、映像素材、台本、写真）");
      push("利用許諾の範囲を文章化（期間・地域・公開形態・二次利用）");
    }
    if (it.category === "privacy") {
      push("同意取得フロー（出演者/保護者/スタッフ/映り込み）を決める");
      push("撮影範囲・公開範囲を掲示（会場/配信ページ）");
    }
    if (it.category === "safety") {
      push("安全注意（点滅・音量・導線）を掲示し、代替観覧方法を用意");
    }
    if (it.category === "ethics") {
      push("注意書き（実在題材・表現配慮）＋監修/第三者レビューを検討");
    }
  });

  if (!out.length) out.push("今の情報だけでは対応案を出しにくいです。テンプレ入力で条件を埋めてください。");
  return out;
}

// --- Tasks（チェックリスト）自動生成 ---
function generateTasksFromIssues(issues) {
  const tasks = [];
  const add = (title) => tasks.push({ id: uid(), title, status: "todo", created_at: nowISO() });

  issues.forEach((it) => {
    if (it.category === "copyright" && it.element === "音楽") {
      add("既存曲の利用一覧（曲名/区間/形態）を作成");
      add("上演/配信/録画別の許諾要否を整理");
    }
    if (it.category === "privacy") {
      add("撮影範囲と掲示文を確定");
      add("出演者（未成年含む）の同意書フロー確認");
    }
    if (it.category === "safety") add("点滅/音量の注意書きを作成・掲示");
    if (it.category === "ethics") add("注意書き作成（題材配慮）＋監修の要否検討");
  });

  if (!tasks.length) add("不足情報の確認（配信/素材出所/改変範囲）");
  return tasks;
}

// ------------------------
// ✅ 自由記述メモ → リスク候補抽出 → 検索リンク生成（Web根拠を探す動線）
// ------------------------
function extractUrlsFromText(text) {
  const urls = [];
  const re = /(https?:\/\/[^\s<>"'）\]]+)/g;
  const m = String(text || "").match(re) || [];
  m.forEach(u => {
    const su = safeUrl(u);
    if (su && !urls.includes(su)) urls.push(su);
  });
  return urls;
}

function buildGoogleSearchUrl(query) {
  const q = encodeURIComponent(query);
  return `https://www.google.com/search?q=${q}`;
}

function detectWebRiskCandidates(text) {
  const t = String(text || "");
  const low = t.toLowerCase();

  // すでに本文にURLがあれば「参照URL候補」として使える
  const foundUrls = extractUrlsFromText(t);

  const items = [];
  const add = (key, title, element, category, reason, query) => {
    items.push({ key, title, element, category, reason, query, foundUrls });
  };

  // 代表的な “権利侵害になりうる” トリガー
  if (t.includes("配信") || t.includes("収録") || t.includes("アーカイブ") || low.includes("youtube") || low.includes("tiktok")) {
    add(
      "stream",
      "配信/収録の許諾（上演とは別）",
      "映像",
      "copyright",
      "配信・収録・アーカイブは『上演』と許諾範囲が分かれることがあり、音楽・肖像・映像素材の整理が必要です。",
      "舞台 配信 収録 許諾 権利処理 上演との違い"
    );
  }

  if (t.includes("既存曲") || t.includes("BGM") || t.includes("カバー") || t.includes("歌") || t.includes("音源")) {
    add(
      "music",
      "既存曲（BGM/歌/カバー）の利用許諾",
      "音楽",
      "copyright",
      "既存曲は「上演」「配信/録画」「音源（録音）利用」で許諾が変わることがあります。",
      "既存曲 BGM 上演 配信 録画 許諾 どこまで"
    );
  }

  if (t.includes("台本") || t.includes("引用") || t.includes("セリフ") || t.includes("原作") || t.includes("脚色")) {
    add(
      "script",
      "台本・原作の引用/翻案/脚色（著作権）",
      "脚本",
      "copyright",
      "台本の引用や翻案（脚色/改変）は、許諾や引用要件の検討が必要です。",
      "台本 引用 要件 著作権 翻案 脚色 許諾"
    );
  }

  if (t.includes("画像") || t.includes("写真") || t.includes("ロゴ") || t.includes("ポスター") || t.includes("映像素材") || t.includes("素材")) {
    add(
      "image",
      "画像/写真/ロゴ/素材の二次利用（著作権・商標）",
      "映像",
      "copyright",
      "画像やロゴ、映像素材は権利者が複数のことがあり、二次利用条件の確認が必要です。",
      "画像 ロゴ 二次利用 著作権 商標 舞台"
    );
  }

  if (t.includes("未成年") || t.includes("高校生") || t.includes("中学生") || t.includes("子役")) {
    add(
      "minor",
      "未成年の撮影・公開（同意/プライバシー）",
      "全体",
      "privacy",
      "未成年の出演・映り込みがある場合、保護者同意や公開範囲の設計が重要です。",
      "未成年 出演 撮影 公開 同意書 何が必要"
    );
  }

  if (t.includes("楽屋") || t.includes("舞台裏") || t.includes("バックヤード") || t.includes("個人情報")) {
    add(
      "backstage",
      "舞台裏/楽屋の映り込み（プライバシー）",
      "映像",
      "privacy",
      "楽屋や舞台裏は個人情報・私物・機微情報が映り込みやすく、公開範囲の制御が必要です。",
      "楽屋 舞台裏 撮影 映り込み プライバシー 対策"
    );
  }

  if (t.includes("実在") || t.includes("事件") || t.includes("災害")) {
    add(
      "real",
      "実在事件/災害題材（倫理・名誉・配慮）",
      "脚本",
      "ethics",
      "当事者性、誤解、名誉毀損・誹謗中傷の誘発などを評価し、注意書きや監修を検討します。",
      "実在 事件 災害 舞台 表現 配慮 注意書き"
    );
  }

  if (t.includes("ストロボ") || t.includes("点滅") || t.includes("爆音") || t.includes("大音量")) {
    add(
      "safety",
      "点滅・大音量の注意（安全配慮）",
      "照明",
      "safety",
      "光過敏や体調不良に配慮し、事前注意や回避導線を用意します。",
      "ストロボ 点滅 注意書き 観客 体調不良 対策"
    );
  }

  if (items.length === 0) {
    add(
      "none",
      "明確なトリガーが少ないため、一般的な確認項目を検索",
      "全体",
      "ethics",
      "配信有無、素材出所、改変範囲（脚本/演出）などを書き足すと検出が増えます。",
      "舞台 権利処理 チェックリスト 配信 音楽 台本"
    );
  }

  return items;
}

function renderWebRisks(text) {
  if (!webRisksList) return;
  webRisksList.innerHTML = "";

  const items = detectWebRiskCandidates(text);
  const urlsInMemo = extractUrlsFromText(text);

  // 先に「メモ内URL」があれば表示
  if (urlsInMemo.length) {
    const box = document.createElement("div");
    box.className = "webriskCard";
    box.innerHTML = `
      <div class="webriskTitle">メモ内に含まれるURL（参照候補）</div>
      <div class="hint">※すでに書かれているURLをそのまま添付URLへ入れられます。</div>
      <div class="webriskActions" style="margin-top:10px;">
        <select id="memoUrlSelect"></select>
        <button type="button" class="ghost" id="btnUseMemoUrl">このURLを添付URLへ</button>
      </div>
    `;
    webRisksList.appendChild(box);

    const sel = box.querySelector("#memoUrlSelect");
    urlsInMemo.forEach(u => {
      const opt = document.createElement("option");
      opt.value = u;
      opt.textContent = u;
      sel.appendChild(opt);
    });

    box.querySelector("#btnUseMemoUrl").addEventListener("click", () => {
      const u = sel.value;
      if (logAttachUrl) logAttachUrl.value = u;
      if (logAttachMemo && !logAttachMemo.value.trim()) logAttachMemo.value = "メモ内参照URL";
      // ついでにログ欄へスクロール
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    });
  }

  items.forEach((it) => {
    const card = document.createElement("div");
    card.className = "webriskCard";

    const gUrl = buildGoogleSearchUrl(it.query);
    const defaultMemo = `${it.title}（根拠）`;

    card.innerHTML = `
      <div class="webriskTitle">${escapeHtml(it.title)}</div>
      <div class="webriskMeta">
        <span class="tag">${escapeHtml(it.element)}</span>
        <span class="tag">${escapeHtml(it.category)}</span>
      </div>
      <div>${escapeHtml(it.reason)}</div>

      <div class="webriskActions">
        <a class="weblink" href="${escapeHtml(gUrl)}" target="_blank" rel="noreferrer">🔎 この内容で検索（Google）</a>
      </div>

      <div class="webriskActions">
        <input class="riskUrlInput" placeholder="見つけた根拠URLを貼る（https://...）" />
        <button type="button" class="ghost btnApplyRiskUrl">添付URLに反映</button>
      </div>

      <div class="webriskActions">
        <button type="button" class="ghost btnFillLogFromRisk">このリスクをログ入力欄へセット</button>
      </div>
    `;

    // URLを添付へ反映
    const urlInput = card.querySelector(".riskUrlInput");
    const btnApply = card.querySelector(".btnApplyRiskUrl");
    btnApply.addEventListener("click", () => {
      const u = safeUrl(urlInput.value);
      if (!u) return alert("URLが正しくありません（https://... 形式で貼ってください）");
      if (logAttachUrl) logAttachUrl.value = u;
      if (logAttachMemo && !logAttachMemo.value.trim()) logAttachMemo.value = defaultMemo;
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    });

    // リスクをログ入力欄へセット（要素/カテゴリ/論点に入れる）
    const btnFill = card.querySelector(".btnFillLogFromRisk");
    btnFill.addEventListener("click", () => {
      if (logElement) logElement.value = it.element;
      if (logCategory) logCategory.value = it.category;
      if (logIssue) logIssue.value = `${it.title}：${it.reason}`;
      if (logDecision) logDecision.value = "要確認";
      if (logStatus) logStatus.value = "needs_review";
      if (logRationale && !logRationale.value.trim()) logRationale.value = "自由記述から検出。Web根拠URLを添付して判断。";
      if (logAttachMemo && !logAttachMemo.value.trim()) logAttachMemo.value = defaultMemo;
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    });

    webRisksList.appendChild(card);
  });
}

// ------------------------
// ✅ 期間（複数）行の追加/削除
// ------------------------
function attachDateRowEvents(rowEl) {
  const delBtn = rowEl.querySelector(".btnDelDate");

  delBtn?.addEventListener("click", () => {
    const rows = dateRows?.querySelectorAll(".dateRow") || [];
    if (rows.length <= 1) {
      rowEl.querySelector(".f_from").value = "";
      rowEl.querySelector(".f_to").value = "";
      addFilterLog("date_del");
      return;
    }
    rowEl.remove();
    addFilterLog("date_del");
  });

  rowEl.querySelector(".f_from")?.addEventListener("change", () => addFilterLog("change"));
  rowEl.querySelector(".f_to")?.addEventListener("change", () => addFilterLog("change"));
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
  return ranges.some(r => inDateRange(iso, r.from, r.to));
}

// ------------------------
// ✅ フィルタ操作ログ（保存）
// ------------------------
function snapshotFilters() {
  return {
    q: (f_q?.value || "").trim(),
    element: f_element?.value || "",
    category: f_category?.value || "",
    status: f_status?.value || "",
    dateRanges: getDateRangesFromUI()
  };
}
function sameFilters(a, b) {
  return JSON.stringify(a || {}) === JSON.stringify(b || {});
}
function addFilterLog(action) {
  const d = loadData();
  const p = d.projects[d.currentProjectId];
  if (!p) return;

  if (!Array.isArray(p.filterLogs)) p.filterLogs = [];

  const filters = snapshotFilters();
  const last = p.filterLogs[0]?.filters;

  if (action === "change" && sameFilters(filters, last)) {
    renderAll();
    return;
  }

  p.filterLogs.unshift({
    id: uid(),
    at: nowISO(),
    action, // change/reset/date_add/date_del
    filters
  });

  if (p.filterLogs.length > 200) p.filterLogs.length = 200;

  saveData(d);
  renderAll();
}

// ------------------------
// フィルタ適用
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
      const hay = `${l.issue || ""} ${l.rationale || ""}`.toLowerCase();
      if (!hay.includes(f.q)) return false;
    }
    return true;
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
        <button class="ghost" data-add="1">この論点をログに入れる</button>
      </div>
    `;
    const btn = li.querySelector("button[data-add]");
    btn.addEventListener("click", () => {
      if (logElement) logElement.value = it.element;
      if (logCategory) logCategory.value = it.category;
      if (logIssue) logIssue.value = it.issue;
      if (logDecision) logDecision.value = "要確認";
      if (logStatus) logStatus.value = "needs_review";
      if (logRationale) logRationale.value = "";
      if (logAttachUrl) logAttachUrl.value = "";
      if (logAttachMemo) logAttachMemo.value = "";
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    });
    issuesList.appendChild(li);
  });
}

function renderLogs(data) {
  if (!logsTable) return;

  const p = data.projects[data.currentProjectId];
  const logs0 = (p?.logs || []);
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
      <div class="cell">${escapeHtml(l.issue)}</div>
      <div class="cell">${escapeHtml(l.decision)}</div>
      <div class="cell">
        <select data-st="${escapeHtml(l.id)}">
          <option value="needs_review" ${l.status==="needs_review"?"selected":""}>要確認</option>
          <option value="doing" ${l.status==="doing"?"selected":""}>対応中</option>
          <option value="done" ${l.status==="done"?"selected":""}>完了</option>
        </select>
      </div>
      <div class="cell">${attachHtml}</div>
      <div class="cell"><button class="ghost danger" data-del="${escapeHtml(l.id)}">×</button></div>
    `;

    // ステータス変更
    row.querySelector("select[data-st]").addEventListener("change", (e) => {
      const newStatus = e.target.value;
      const d = loadData();
      const pp = d.projects[d.currentProjectId];
      const idx = pp.logs.findIndex(x => x.id === l.id);
      if (idx >= 0) pp.logs[idx].status = newStatus;
      saveData(d);
      renderAll();
    });

    // 削除
    row.querySelector("button[data-del]").addEventListener("click", () => {
      if (!confirm("このログを削除しますか？")) return;
      const d = loadData();
      const pp = d.projects[d.currentProjectId];
      pp.logs = pp.logs.filter(x => x.id !== l.id);
      saveData(d);
      renderAll();
    });

    logsTable.appendChild(row);
  });
}

function renderDashboard(data) {
  const p = data.projects[data.currentProjectId];
  const logs = p?.logs || [];
  const needs = logs.filter(l => l.status === "needs_review").length;
  const doing = logs.filter(l => l.status === "doing").length;
  const done = logs.filter(l => l.status === "done").length;
  const total = logs.length || 0;
  const pct = total ? Math.round((done / total) * 100) : 0;

  if (kpiNeeds) kpiNeeds.textContent = String(needs);
  if (kpiDoing) kpiDoing.textContent = String(doing);
  if (kpiDone) kpiDone.textContent = String(done);
  if (progressPct) progressPct.textContent = `${pct}%`;
  if (progressFill) progressFill.style.width = `${pct}%`;
}

function renderMaterialOutputs(text, issues) {
  if (questionsList) {
    questionsList.innerHTML = "";
    generateQuestions(text).forEach(s => {
      const li = document.createElement("li");
      li.textContent = s;
      questionsList.appendChild(li);
    });
  }
  if (actionsList) {
    actionsList.innerHTML = "";
    generateActionTemplates(issues).forEach(s => {
      const li = document.createElement("li");
      li.textContent = s;
      actionsList.appendChild(li);
    });
  }
  if (tasksList) {
    tasksList.innerHTML = "";
    generateTasksFromIssues(issues).slice(0, 8).forEach(t => {
      const li = document.createElement("li");
      li.textContent = `☐ ${t.title}`;
      tasksList.appendChild(li);
    });
  }
}

function renderAll() {
  const data = loadData();
  renderProjects(data);
  renderLogs(data);
  renderDashboard(data);
}

// --- Template -> text ---
function buildTemplateText() {
  const checks = {
    stream: tpl("t_stream")?.checked,
    archive: tpl("t_archive")?.checked,
    existing_music: tpl("t_existing_music")?.checked,
    recorded_music: tpl("t_recorded_music")?.checked,
    minors: tpl("t_minors")?.checked,
    backstage: tpl("t_backstage")?.checked,
    strobe: tpl("t_strobe")?.checked,
    real_event: tpl("t_real_event")?.checked,
    shoot_range: (tpl("t_shoot_range")?.value || "").trim()
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
  if (checks.shoot_range) lines.push(`・撮影範囲：${checks.shoot_range}`);
  lines.push("【自由記述】");
  return lines.join("\n");
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

  // ✅ 自由記述のWeb根拠動線を表示
  renderWebRisks(text);

  const newTasks = generateTasksFromIssues(issues);
  const existingTitles = new Set((p.tasks || []).map(t => t.title));
  newTasks.forEach(t => {
    if (!existingTitles.has(t.title)) p.tasks.push(t);
  });

  saveData(data);
  renderAll();
});

clearBtn?.addEventListener("click", () => {
  if (inputText) inputText.value = "";
  if (issuesList) issuesList.innerHTML = "";
  if (questionsList) questionsList.innerHTML = "";
  if (actionsList) actionsList.innerHTML = "";
  if (tasksList) tasksList.innerHTML = "";
  if (webRisksList) webRisksList.innerHTML = "";
});

// Projects
createProjectBtn?.addEventListener("click", () => {
  const title = (projectTitle?.value || "").trim();
  if (!title) return alert("案件名を入力してください");
  const data = loadData();
  const id = uid();
  data.projects[id] = { id, title, logs: [], tasks: [], filterLogs: [] };
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
  const issue = (logIssue?.value || "").trim();
  if (!issue) return alert("論点（issue）を入力してください");

  const data = loadData();
  const p = data.projects[data.currentProjectId];

  const attUrl = safeUrl(logAttachUrl?.value || "");
  const attMemo = (logAttachMemo?.value || "").trim();
  const attachments = [];
  if (attUrl) attachments.push({ url: attUrl, memo: attMemo || "添付" });

  const severity = estimateSeverity(logElement?.value, logCategory?.value, issue);

  p.logs.unshift({
    id: uid(),
    at: nowISO(),
    element: logElement?.value || "全体",
    category: logCategory?.value || "ethics",
    issue,
    decision: logDecision?.value || "要確認",
    rationale: (logRationale?.value || "").trim(),
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
});

btnResetTemplate?.addEventListener("click", () => {
  ["t_stream","t_archive","t_existing_music","t_recorded_music","t_minors","t_backstage","t_strobe","t_real_event"].forEach(id => {
    const el = tpl(id);
    if (el) el.checked = false;
  });
  const r = tpl("t_shoot_range");
  if (r) r.value = "";
});

// ✅ フィルタ：変更したらフィルタログを貯める（デバウンス）
let filterLogTimer = null;
function logFilterChangeDebounced() {
  if (filterLogTimer) clearTimeout(filterLogTimer);
  filterLogTimer = setTimeout(() => {
    addFilterLog("change");
  }, 500);
}

[f_q, f_element, f_category, f_status].forEach(el => {
  el?.addEventListener("input", () => { renderAll(); logFilterChangeDebounced(); });
  el?.addEventListener("change", () => { renderAll(); addFilterLog("change"); });
});

// ✅ 期間（複数）: 追加ボタン
btnAddDateRow?.addEventListener("click", () => {
  addDateRow("", "");
  addFilterLog("date_add");
});

// ✅ 初期行にもイベント付与
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

  addFilterLog("reset");
});

// init
renderAll();
