// app.js（LocalStorage版：index.html一致・期間（複数）追加対応）
// ✅ export系（exportBtn/exportAllBtn）は完全に削除

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

// ✅ Multi date rows (HTMLと一致)
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

// --- Data model ---
// data = { schemaVersion, currentProjectId, projects: { [id]: { id, title, logs: [], tasks: [] } } }
function loadData() {
  const raw = localStorage.getItem(STORE_KEY);
  if (!raw) {
    const firstId = uid();
    const init = {
      schemaVersion: "2.1.0",
      currentProjectId: firstId,
      projects: {
        [firstId]: { id: firstId, title: "デモ案件", logs: [], tasks: [] }
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
    p.logs.forEach((l) => {
      if (!l.id) l.id = uid();
      if (!l.at) l.at = nowISO();
      if (!l.status) l.status = "needs_review";
      if (!Array.isArray(l.attachments)) l.attachments = [];
      if (!l.severity) l.severity = "low";
    });
  });

  data.schemaVersion = "2.1.0";
  return data;
}

// --- AI補助（ルール）: severity推定 ---
function estimateSeverity(element, category, issueText) {
  const t = (issueText || "").toLowerCase();
  if (category === "safety") return "high";
  if (category === "privacy" && (t.includes("未成年") || t.includes("楽屋") || t.includes("個人特定"))) return "high";
  if (category === "copyright" && (t.includes("配信") || t.includes("録画") || t.includes("既存曲"))) return "medium";
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
// ✅ 期間（複数）行の追加/削除（HTMLと一致）
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
    <button type="button" class="ghost btnDelDate" title="この期間を削除">×</button>
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
      <div class="cell"><button class="ghost" data-del="${escapeHtml(l.id)}">×</button></div>
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
});

// Projects
createProjectBtn?.addEventListener("click", () => {
  const title = (projectTitle?.value || "").trim();
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
  const issue = (logIssue?.value || "").trim();
  if (!issue) return alert("論点（issue）を入力してください");

  const data = loadData();
  const p = data.projects[data.currentProjectId];

  const attUrl = (logAttachUrl?.value || "").trim();
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

// Filters: text/select
[f_q, f_element, f_category, f_status].forEach(el => {
  el?.addEventListener("input", renderAll);
  el?.addEventListener("change", renderAll);
});

// ✅ 期間（複数）: 追加ボタン
btnAddDateRow?.addEventListener("click", () => {
  addDateRow("", "");
  renderAll();
});

// ✅ 初期行にもイベント付与（HTML内の1行目）
if (dateRows) {
  const first = dateRows.querySelector(".dateRow");
  if (first) attachDateRowEvents(first);
}

// フィルタ解除（複数期間も含めてリセット）
f_reset?.addEventListener("click", () => {
  if (f_q) f_q.value = "";
  if (f_element) f_element.value = "";
  if (f_category) f_category.value = "";
  if (f_status) f_status.value = "";

  // ✅ 期間（複数）もリセット：1行だけ残す
  if (dateRows) {
    dateRows.innerHTML = "";
    addDateRow("", "");
  }

  renderAll();
});

// init
renderAll();
