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
const webRisksError = document.getElementById("webRisksError");

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

// Filters（合体）
const f_q = document.getElementById("f_q");
const f_element = document.getElementById("f_element");
const f_category = document.getElementById("f_category");
const f_status = document.getElementById("f_status");
const f_reset = document.getElementById("f_reset");

const dateRows = document.getElementById("dateRows");
const btnAddDateRow = document.getElementById("btnAddDateRow");

const saveFiltersWithLog = document.getElementById("saveFiltersWithLog");

// -------------------
// utils
// -------------------
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
function safeUrl(u) {
  const t = (u || "").trim();
  if (!t) return "";
  try { return new URL(t).toString(); } catch { return ""; }
}

// -------------------
// Category label
// -------------------
function categoryLabel(cat) {
  const map = {
    copyright: "著作権",
    privacy: "プライバシー",
    ethics: "倫理",
    safety: "安全",
    bias: "偏り",
    art: "美術",
    costume: "衣装",
    sns: "SNS",
  };
  return map[cat] || cat || "";
}

// -------------------
// Data model
// -------------------
// data = { schemaVersion, currentProjectId, projects: { [id]: { id, title, logs: [] } } }
// logs[]: { ..., attachments[], filterSnapshot? }
function loadData() {
  const raw = localStorage.getItem(STORE_KEY);
  if (!raw) {
    const firstId = uid();
    const init = {
      schemaVersion: "2.5.0",
      currentProjectId: firstId,
      projects: {
        [firstId]: { id: firstId, title: "デモ案件", logs: [] }
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
  ids.forEach(pid => {
    const p = data.projects[pid];
    if (!Array.isArray(p.logs)) p.logs = [];
    p.logs.forEach(l => {
      if (!l.id) l.id = uid();
      if (!l.at) l.at = nowISO();
      if (!l.status) l.status = "needs_review";
      if (!Array.isArray(l.attachments)) l.attachments = [];
      if (!l.severity) l.severity = "low";
    });
  });
  data.schemaVersion = "2.5.0";
  return data;
}

// -------------------
// severity（簡易）
// -------------------
function estimateSeverity(element, category, issueText) {
  const t = (issueText || "").toLowerCase();
  if (category === "safety") return "high";
  if (category === "privacy" && (t.includes("未成年") || t.includes("楽屋") || t.includes("個人特定"))) return "high";
  if (category === "art" || category === "costume" || category === "sns") return "medium";
  if (category === "copyright") return "medium";
  return "low";
}

// ------------------------
// ✅ 期間（複数）
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
  rowEl.querySelector(".f_from")?.addEventListener("change", () => renderAll());
  rowEl.querySelector(".f_to")?.addEventListener("change", () => renderAll());
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
// ✅ フィルタ：絞り込み用（表示用）
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
// ✅ 「ログに保存する用」フィルタスナップショット（期間含む）
// ------------------------
function snapshotFiltersForLog() {
  // “絞り込み条件”の保存（要求：検索/要素/カテゴリ/ステータス/期間）
  return {
    q: (f_q?.value || "").trim(),
    element: f_element?.value || "",
    category: f_category?.value || "",
    status: f_status?.value || "",
    dateRanges: getDateRangesFromUI()
  };
}
function formatDateRanges(ranges) {
  if (!ranges || !ranges.length) return "";
  return ranges.map(r => `${r.from || "----/--/--"}〜${r.to || "----/--/--"}`).join("\n");
}

// ------------------------
// 解析（ここは軽量ルール版）
// ------------------------
function extractIssues(text) {
  const t = (text || "").toLowerCase();
  const issues = [];
  const add = (element, category, issue) => issues.push({ element, category, issue });

  if (text.includes("配信") || text.includes("収録") || t.includes("youtube") || t.includes("tiktok") || text.includes("アーカイブ")) {
    add("映像", "copyright", "配信/収録がある場合、上演と配信で必要な許諾（音楽・映像素材・実演/肖像）が分かれる可能性があります。形態ごとに権利処理を整理してください。");
    add("映像", "privacy", "舞台裏/楽屋/未成年の映り込みや個人特定のリスクがあります。撮影範囲・同意取得・公開範囲を設計してください。");
  }

  if (text.includes("既存曲") || text.includes("カバー") || text.includes("BGM") || text.includes("音源") || text.includes("歌")) {
    add("音楽", "copyright", "既存曲の利用は『上演』と『配信/録画』で許諾が変わることがあります。使用形態・区間・音源種類（生演奏/録音）を分けて確認してください。");
  }

  if (text.includes("美術") || text.includes("舞台美術") || text.includes("大道具") || text.includes("小道具") || text.includes("背景") || text.includes("ロゴ") || text.includes("画像") || text.includes("写真")) {
    add("演出", "art", "美術・小道具・背景・ロゴ・画像素材に第三者の著作物/商標が含まれるとリスクがあります。素材の出所（自作/購入/フリー/許諾）を整理してください。");
  }

  if (text.includes("衣装") || text.includes("コスプレ") || text.includes("制服") || text.includes("ブランド") || text.includes("ロゴ")) {
    add("演出", "costume", "衣装にブランドロゴ/キャラクターデザイン/既製品の意匠が含まれる場合、配信・SNSで露出するとリスクが増えます。公開範囲と利用条件を確認してください。");
  }

  if (t.includes("sns") || t.includes("twitter") || t.includes("instagram") || t.includes("tiktok") || text.includes("告知") || text.includes("投稿") || text.includes("サムネ") || text.includes("リール") || text.includes("ショート") || text.includes("X")) {
    add("演出", "sns", "SNS告知で画像/フォント/音源/写真/映像素材を使う場合、素材ライセンスやプラットフォーム規約により利用条件が変わります。素材の出所と利用範囲を確認してください。");
    add("演出", "privacy", "SNS投稿は拡散力が高く、未成年・客席・楽屋の映り込み、個人特定のリスクが上がります。公開範囲/撮影ルール/同意の運用を定義してください。");
  }

  if (text.includes("未成年")) {
    add("全体", "privacy", "未成年出演がある場合、同意書（保護者含む）・公開範囲・撮影可否の取り扱いを明確化してください。");
  }

  if (issues.length === 0) add("全体", "ethics", "顕著な論点は検出できませんでした。配信有無・素材出所・改変範囲（脚本/演出/美術/衣装/SNS）を追記すると精度が上がります。");
  return issues;
}

function generateQuestions(text) {
  const q = [];
  const push = (s) => { if (!q.includes(s)) q.push(s); };
  const t = text || "";
  const low = t.toLowerCase();

  if (t.includes("配信") || low.includes("youtube") || low.includes("tiktok")) {
    push("配信はライブのみ？アーカイブ（後日公開）もありますか？");
    push("配信の公開範囲（限定公開/有料/全公開）はどれですか？");
  }
  if (t.includes("美術") || t.includes("小道具") || t.includes("背景") || t.includes("ロゴ") || t.includes("画像") || t.includes("写真")) {
    push("美術素材の出所（自作/購入/フリー/許諾）を一覧化できますか？");
  }
  if (t.includes("衣装") || t.includes("ブランド") || t.includes("ロゴ") || t.includes("コスプレ")) {
    push("衣装のロゴ/意匠/キャラ要素の有無を確認していますか？");
  }
  if (low.includes("sns") || t.includes("告知") || t.includes("投稿") || t.includes("サムネ")) {
    push("SNSで使う画像/フォント/音源の利用条件は確認済みですか？");
  }
  if (!q.length) push("配信有無、素材の出所、改変範囲（脚本/演出/美術/衣装/SNS）を追記できますか？");
  return q;
}

function generateActionTemplates(issues) {
  const out = [];
  const push = (s) => { if (!out.includes(s)) out.push(s); };
  issues.forEach(it => {
    if (it.category === "copyright") push("権利処理の表を作成（上演/配信/録画/SNS別に：楽曲、音源、映像素材、台本、写真/フォント/ロゴ）");
    if (it.category === "art") push("美術・小道具・背景素材の出所（自作/購入/フリー/許諾）を一覧化");
    if (it.category === "costume") push("衣装（ロゴ/意匠/キャラ要素）の公開範囲（撮影/配信/SNS）を確認");
    if (it.category === "sns") push("SNS告知素材（画像/フォント/音源）の利用条件を確認（商用可否・改変可否・クレジット要否）");
    if (it.category === "privacy") push("撮影範囲・公開範囲・同意の運用を決める（未成年/客席/楽屋）");
  });
  if (!out.length) out.push("不足情報の確認後、対応案テンプレを作成してください。");
  return out;
}

function generateTasksFromIssues(issues) {
  const tasks = [];
  const add = (title) => tasks.push({ id: uid(), title });
  issues.forEach(it => {
    if (it.category === "art") add("美術素材の出所一覧を作成");
    if (it.category === "costume") add("衣装のロゴ/意匠/キャラ要素を整理");
    if (it.category === "sns") add("SNS告知素材（画像/フォント/音源）の利用条件確認");
    if (it.category === "privacy") add("撮影・公開の同意フロー確認（未成年含む）");
    if (it.category === "copyright") add("上演/配信/録画/SNS別の権利処理整理");
  });
  if (!tasks.length) add("不足情報の確認（配信/素材出所/改変範囲）");
  return tasks;
}

// -------------------
// Web検索リンク（簡易）
// -------------------
function buildGoogleSearchUrl(query) {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}
function clearWebError() {
  if (!webRisksError) return;
  webRisksError.style.display = "none";
  webRisksError.textContent = "";
}
function showWebError(msg) {
  if (!webRisksError) return;
  webRisksError.style.display = "block";
  webRisksError.textContent = msg;
}

function detectWebRiskCandidates(text) {
  const t = String(text || "");
  const low = t.toLowerCase();
  const items = [];
  const add = (title, element, category, reason, query) => items.push({ title, element, category, reason, query });

  if (t.includes("配信") || t.includes("収録") || t.includes("アーカイブ") || low.includes("youtube") || low.includes("tiktok")) {
    add("配信/収録の許諾（上演とは別）", "映像", "copyright",
      "配信・収録・アーカイブは上演と許諾範囲が分かれる場合があります。",
      "舞台 配信 収録 許諾 権利処理 上演 違い");
  }
  if (t.includes("美術") || t.includes("小道具") || t.includes("背景") || t.includes("ロゴ") || t.includes("画像") || t.includes("写真")) {
    add("舞台美術・小道具・背景素材（著作権/商標）", "演出", "art",
      "美術や小道具に他者の画像・ロゴ等が含まれると、撮影/配信/告知でリスクが上がります。",
      "舞台美術 小道具 背景 ロゴ 画像 著作権 商標");
  }
  if (t.includes("衣装") || t.includes("コスプレ") || t.includes("制服") || t.includes("ブランド") || t.includes("ロゴ")) {
    add("衣装（ロゴ/意匠/キャラ要素）の公開リスク", "演出", "costume",
      "衣装のロゴ/意匠が配信・SNSで露出すると利用条件確認が必要になることがあります。",
      "衣装 ブランドロゴ コスプレ 舞台 配信 SNS 権利");
  }
  if (low.includes("sns") || t.includes("告知") || t.includes("投稿") || t.includes("サムネ") || t.includes("リール") || t.includes("ショート") || t.includes("X")) {
    add("SNS告知素材（画像/フォント/音源）の利用条件", "演出", "sns",
      "SNSは拡散されやすく、素材ライセンス違反が目立ちやすいです。",
      "SNS 告知 画像 フォント 音源 利用条件 ライセンス");
  }

  if (!items.length) {
    add("舞台の権利処理チェック（一般）", "全体", "ethics",
      "配信有無・素材出所・改変範囲（脚本/演出/美術/衣装/SNS）を確認しましょう。",
      "舞台 権利処理 チェックリスト 美術 衣装 SNS");
  }

  return items;
}

function renderWebRisks(text) {
  clearWebError();
  if (!webRisksList) return;

  webRisksList.innerHTML = "";

  try {
    const items = detectWebRiskCandidates(text);

    items.forEach((it) => {
      const card = document.createElement("div");
      card.className = "webriskCard";

      const gUrl = buildGoogleSearchUrl(it.query);
      const defaultMemo = `${it.title}（根拠）`;

      card.innerHTML = `
        <div class="webriskTitle">${escapeHtml(it.title)}</div>
        <div class="webriskMeta">
          <span class="tag">${escapeHtml(it.element)}</span>
          <span class="tag">${escapeHtml(categoryLabel(it.category))}</span>
        </div>
        <div>${escapeHtml(it.reason)}</div>

        <div class="webriskActions">
          <a href="${escapeHtml(gUrl)}" target="_blank" rel="noreferrer">🔎 Googleで検索</a>
        </div>

        <div class="webriskActions">
          <input class="riskUrlInput" placeholder="見つけた根拠URLを貼る（https://...）" />
          <button type="button" class="ghost btnApplyRiskUrl">添付URLに反映</button>
        </div>

        <div class="webriskActions">
          <button type="button" class="ghost btnFillLogFromRisk">このリスクをログ入力欄へセット</button>
        </div>
      `;

      const urlInput = card.querySelector(".riskUrlInput");
      card.querySelector(".btnApplyRiskUrl").addEventListener("click", () => {
        const u = safeUrl(urlInput.value);
        if (!u) return alert("URLが正しくありません（https://... 形式で貼ってください）");
        if (logAttachUrl) logAttachUrl.value = u;
        if (logAttachMemo && !logAttachMemo.value.trim()) logAttachMemo.value = defaultMemo;
        window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
      });

      card.querySelector(".btnFillLogFromRisk").addEventListener("click", () => {
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
  } catch (e) {
    showWebError("Webリスク表示中にエラーが出ました。\n\n" + (e?.stack || e?.message || String(e)));
  }
}

// ------------------------
// Render
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
        <span class="tag">${escapeHtml(categoryLabel(it.category))}</span>
      </div>
      <div style="margin-top:6px;">${escapeHtml(it.issue)}</div>
      <div class="row" style="margin-top:10px;">
        <button class="ghost" data-add="1">この論点をログに入れる</button>
      </div>
    `;
    li.querySelector("button[data-add]").addEventListener("click", () => {
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

    // ✅ 保存されたフィルタ（期間含む）を表示
    let filterHtml = "";
    if (l.filterSnapshot) {
      const fs = l.filterSnapshot;
      const rangesText = formatDateRanges(fs.dateRanges);
      const parts = [];
      if (fs.q) parts.push(`検索: ${fs.q}`);
      if (fs.element) parts.push(`要素: ${fs.element}`);
      if (fs.category) parts.push(`カテゴリ: ${categoryLabel(fs.category)}`);
      if (fs.status) parts.push(`ステータス: ${fs.status}`);
      if (rangesText) parts.push(`期間:\n${rangesText}`);
      if (parts.length) filterHtml = `<div class="small">保存フィルタ\n${escapeHtml(parts.join("\n"))}</div>`;
    }

    row.innerHTML = `
      <div class="cell">
        <span class="tag">${escapeHtml(l.element)}</span>
        <span class="tag">${escapeHtml(categoryLabel(l.category))}</span>
        <span class="tag">sev:${escapeHtml(l.severity || "low")}</span>
        ${filterHtml}
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

    row.querySelector("select[data-st]").addEventListener("change", (e) => {
      const newStatus = e.target.value;
      const d = loadData();
      const pp = d.projects[d.currentProjectId];
      const idx = pp.logs.findIndex(x => x.id === l.id);
      if (idx >= 0) pp.logs[idx].status = newStatus;
      saveData(d);
      renderAll();
    });

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

function renderAll() {
  const data = loadData();
  renderProjects(data);
  renderLogs(data);
}

// ------------------------
// Events
// ------------------------
analyzeBtn?.addEventListener("click", () => {
  const text = inputText?.value || "";
  const issues = extractIssues(text);

  renderIssues(issues);

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

  renderWebRisks(text);
});

clearBtn?.addEventListener("click", () => {
  if (inputText) inputText.value = "";
  if (issuesList) issuesList.innerHTML = "";
  if (questionsList) questionsList.innerHTML = "";
  if (actionsList) actionsList.innerHTML = "";
  if (tasksList) tasksList.innerHTML = "";
  if (webRisksList) webRisksList.innerHTML = "";
  clearWebError();
});

// Projects
createProjectBtn?.addEventListener("click", () => {
  const title = (projectTitle?.value || "").trim();
  if (!title) return alert("案件名を入力してください");
  const data = loadData();
  const id = uid();
  data.projects[id] = { id, title, logs: [] };
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

// ✅ 期間追加
btnAddDateRow?.addEventListener("click", () => {
  addDateRow("", "");
  renderAll();
});

// ✅ 初期行イベント
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

// フィルタ変更で再描画（絞り込み）
[f_q, f_element, f_category, f_status].forEach(el => {
  el?.addEventListener("input", () => renderAll());
  el?.addEventListener("change", () => renderAll());
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

  const entry = {
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
  };

  // ✅ 合体ポイント：フィルタ（期間含む）をログに保存
  if (saveFiltersWithLog?.checked) {
    entry.filterSnapshot = snapshotFiltersForLog();
  }

  p.logs.unshift(entry);

  saveData(data);

  // 入力クリア
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

// init
renderAll();
renderWebRisks(inputText?.value || "");
