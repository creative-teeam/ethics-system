// app.js（LocalStorage版：複数期間フィルタ対応・機能拡張済み）
const STORE_KEY = "stageEthicsData_v1";

/* =========================
   DOM
========================= */
const inputText = document.getElementById("inputText");
const analyzeBtn = document.getElementById("analyzeBtn");
const clearBtn = document.getElementById("clearBtn");
const issuesList = document.getElementById("issuesList");
const questionsList = document.getElementById("questionsList");
const actionsList = document.getElementById("actionsList");
const tasksList = document.getElementById("tasksList");

const projectTitle = document.getElementById("projectTitle");
const createProjectBtn = document.getElementById("createProjectBtn");
const projectSelect = document.getElementById("projectSelect");
const deleteProjectBtn = document.getElementById("deleteProjectBtn");

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

// テンプレ
const btnApplyTemplate = document.getElementById("btnApplyTemplate");
const btnResetTemplate = document.getElementById("btnResetTemplate");
const tpl = (id) => document.getElementById(id);

// フィルタ
const f_q = document.getElementById("f_q");
const f_element = document.getElementById("f_element");
const f_category = document.getElementById("f_category");
const f_status = document.getElementById("f_status");
const f_reset = document.getElementById("f_reset");

// 複数期間UI
const dateRows = document.getElementById("dateRows");
const btnAddDateRow = document.getElementById("btnAddDateRow");

// KPI
const kpiNeeds = document.getElementById("kpiNeeds");
const kpiDoing = document.getElementById("kpiDoing");
const kpiDone = document.getElementById("kpiDone");
const progressPct = document.getElementById("progressPct");
const progressFill = document.getElementById("progressFill");

/* =========================
   utils
========================= */
function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();
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

/* =========================
   Data
========================= */
function loadData() {
  const raw = localStorage.getItem(STORE_KEY);
  if (!raw) {
    const firstId = uid();
    const init = {
      schemaVersion: "2.0.0",
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
  Object.values(data.projects).forEach(p => {
    if (!Array.isArray(p.logs)) p.logs = [];
    if (!Array.isArray(p.tasks)) p.tasks = [];
    p.logs.forEach(l => {
      if (!l.status) l.status = "needs_review";
      if (!Array.isArray(l.attachments)) l.attachments = [];
      if (!l.severity) l.severity = "low";
    });
  });
  data.schemaVersion = "2.0.0";
  return data;
}

/* =========================
   AI補助（ルール）
========================= */
function estimateSeverity(element, category, issueText) {
  const t = (issueText || "").toLowerCase();
  if (category === "safety") return "high";
  if (category === "privacy" && (t.includes("未成年") || t.includes("楽屋"))) return "high";
  if (category === "copyright") return "medium";
  if (category === "ethics") return "medium";
  return "low";
}

function extractIssues(text) {
  const t = (text || "").toLowerCase();
  const issues = [];
  const add = (e, c, i) => issues.push({ element: e, category: c, issue: i });

  if (text.includes("配信") || text.includes("収録") || text.includes("アーカイブ")) {
    add("映像", "copyright", "配信/収録/アーカイブにより権利処理区分が変わる可能性があります。");
    add("映像", "privacy", "撮影範囲・同意取得・未成年の映り込みリスクがあります。");
  }
  if (text.includes("既存曲") || text.includes("BGM") || text.includes("音源")) {
    add("音楽", "copyright", "既存曲・音源使用は上演/配信/録画で許諾が変わります。");
  }
  if (text.includes("実在") || text.includes("事件") || text.includes("災害")) {
    add("脚本", "ethics", "実在事件/災害題材は配慮・注意書き・監修が必要です。");
  }
  if (text.includes("ストロボ") || text.includes("点滅")) {
    add("照明", "safety", "点滅演出は体調被害リスクがあります。");
  }
  if (!issues.length) {
    add("全体", "ethics", "顕著な論点は検出されませんでした。");
  }
  return issues;
}

/* =========================
   複数期間処理
========================= */
function getDateRanges() {
  if (!dateRows) return [];
  const rows = Array.from(dateRows.querySelectorAll(".dateRow"));
  const ranges = rows.map(row => {
    const from = row.querySelector(".f_from")?.value || "";
    const to = row.querySelector(".f_to")?.value || "";
    return { from, to };
  });
  return ranges.filter(r => r.from || r.to);
}

function inAnyDateRanges(iso, ranges) {
  if (!ranges.length) return true;
  if (!iso) return true;
  const d = iso.slice(0, 10);
  return ranges.some(({ from, to }) => {
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });
}

/* =========================
   UI
========================= */
function renderProjects(data) {
  projectSelect.innerHTML = "";
  Object.keys(data.projects).forEach(id => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = data.projects[id].title;
    projectSelect.appendChild(opt);
  });
  projectSelect.value = data.currentProjectId;
}

function renderIssues(issues) {
  issuesList.innerHTML = "";
  issues.forEach(it => {
    const li = document.createElement("li");
    li.innerHTML = `
      <div>
        <span class="tag">${escapeHtml(it.element)}</span>
        <span class="tag">${escapeHtml(it.category)}</span>
      </div>
      <div>${escapeHtml(it.issue)}</div>
      <button class="ghost">ログに入れる</button>
    `;
    li.querySelector("button").onclick = () => {
      logElement.value = it.element;
      logCategory.value = it.category;
      logIssue.value = it.issue;
      logDecision.value = "要確認";
      logStatus.value = "needs_review";
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    };
    issuesList.appendChild(li);
  });
}

function getActiveFilters() {
  return {
    q: (f_q?.value || "").toLowerCase(),
    element: f_element?.value || "",
    category: f_category?.value || "",
    status: f_status?.value || "",
    ranges: getDateRanges()
  };
}

function applyLogFilters(logs) {
  const f = getActiveFilters();
  return logs.filter(l => {
    if (f.element && l.element !== f.element) return false;
    if (f.category && l.category !== f.category) return false;
    if (f.status && l.status !== f.status) return false;
    if (!inAnyDateRanges(l.at, f.ranges)) return false;
    if (f.q) {
      const hay = `${l.issue} ${l.rationale}`.toLowerCase();
      if (!hay.includes(f.q)) return false;
    }
    return true;
  });
}

function renderLogs(data) {
  const p = data.projects[data.currentProjectId];
  const logs = applyLogFilters(p.logs);

  logsTable.innerHTML = `
    <div class="rowh">
      <div class="cell">分類</div>
      <div class="cell">論点</div>
      <div class="cell">判断</div>
      <div class="cell">進捗</div>
      <div class="cell">削除</div>
    </div>
  `;

  if (!logs.length) {
    logsTable.innerHTML += `<div class="rowd"><div class="cell" style="grid-column:1/-1;">該当なし</div></div>`;
    return;
  }

  logs.forEach(l => {
    const row = document.createElement("div");
    row.className = "rowd";
    row.innerHTML = `
      <div class="cell">${l.element}/${l.category}</div>
      <div class="cell">${escapeHtml(l.issue)}</div>
      <div class="cell">${escapeHtml(l.decision)}</div>
      <div class="cell">
        <select>
          <option value="needs_review" ${l.status==="needs_review"?"selected":""}>要確認</option>
          <option value="doing" ${l.status==="doing"?"selected":""}>対応中</option>
          <option value="done" ${l.status==="done"?"selected":""}>完了</option>
        </select>
      </div>
      <div class="cell"><button class="ghost">×</button></div>
    `;

    row.querySelector("select").onchange = (e) => {
      const d = loadData();
      const p = d.projects[d.currentProjectId];
      const obj = p.logs.find(x => x.id === l.id);
      obj.status = e.target.value;
      saveData(d);
      renderAll();
    };

    row.querySelector("button").onclick = () => {
      if (!confirm("削除しますか？")) return;
      const d = loadData();
      const p = d.projects[d.currentProjectId];
      p.logs = p.logs.filter(x => x.id !== l.id);
      saveData(d);
      renderAll();
    };

    logsTable.appendChild(row);
  });
}

function renderDashboard(data) {
  const p = data.projects[data.currentProjectId];
  const logs = p.logs;
  const needs = logs.filter(l=>l.status==="needs_review").length;
  const doing = logs.filter(l=>l.status==="doing").length;
  const done = logs.filter(l=>l.status==="done").length;
  const total = logs.length || 1;
  const pct = Math.round((done/total)*100);

  kpiNeeds.textContent = needs;
  kpiDoing.textContent = doing;
  kpiDone.textContent = done;
  progressPct.textContent = pct+"%";
  progressFill.style.width = pct+"%";
}

function renderAll() {
  const data = loadData();
  renderProjects(data);
  renderLogs(data);
  renderDashboard(data);
}

/* =========================
   複数期間UI
========================= */
function addDateRow(from="", to="") {
  const row = document.createElement("div");
  row.className = "dateRow";
  row.innerHTML = `
    <input class="f_from" type="date" value="${from}" />
    <span class="dateSep">〜</span>
    <input class="f_to" type="date" value="${to}" />
    <button type="button" class="ghost btnDelDate">×</button>
  `;
  dateRows.appendChild(row);
}

function resetDateRows() {
  dateRows.innerHTML = "";
  addDateRow();
}

function setupDateRows() {
  btnAddDateRow?.addEventListener("click", () => {
    addDateRow();
    renderAll();
  });

  dateRows?.addEventListener("click", (e)=>{
    const btn = e.target.closest(".btnDelDate");
    if(!btn) return;
    const row = btn.closest(".dateRow");
    if(dateRows.querySelectorAll(".dateRow").length<=1){
      row.querySelector(".f_from").value="";
      row.querySelector(".f_to").value="";
    }else{
      row.remove();
    }
    renderAll();
  });

  dateRows?.addEventListener("input", renderAll);
}

/* =========================
   Events
========================= */
analyzeBtn.onclick = ()=>{
  const text = inputText.value || "";
  const issues = extractIssues(text);
  renderIssues(issues);
};

clearBtn.onclick = ()=>{
  inputText.value="";
  issuesList.innerHTML="";
};

createProjectBtn.onclick = ()=>{
  const title = projectTitle.value.trim();
  if(!title) return alert("案件名を入力してください");
  const d = loadData();
  const id = uid();
  d.projects[id]={id,title,logs:[],tasks:[]};
  d.currentProjectId=id;
  saveData(d);
  projectTitle.value="";
  renderAll();
};

projectSelect.onchange = ()=>{
  const d = loadData();
  d.currentProjectId = projectSelect.value;
  saveData(d);
  renderAll();
};

deleteProjectBtn.onclick = ()=>{
  const d = loadData();
  if(Object.keys(d.projects).length<=1) return alert("最後の案件は削除不可");
  delete d.projects[d.currentProjectId];
  d.currentProjectId = Object.keys(d.projects)[0];
  saveData(d);
  renderAll();
};

addLogBtn.onclick = ()=>{
  const issue = logIssue.value.trim();
  if(!issue) return alert("論点を入力してください");

  const d = loadData();
  const p = d.projects[d.currentProjectId];

  const severity = estimateSeverity(logElement.value, logCategory.value, issue);

  p.logs.unshift({
    id: uid(),
    at: nowISO(),
    element: logElement.value,
    category: logCategory.value,
    issue,
    decision: logDecision.value,
    rationale: logRationale.value,
    status: logStatus.value,
    severity,
    attachments:[]
  });

  saveData(d);
  logIssue.value="";
  logRationale.value="";
  renderAll();
};

clearLogsBtn.onclick = ()=>{
  if(!confirm("全削除しますか？")) return;
  const d = loadData();
  d.projects[d.currentProjectId].logs=[];
  saveData(d);
  renderAll();
};

/* フィルタ */
[f_q, f_element, f_category, f_status].forEach(el=>{
  el?.addEventListener("input", renderAll);
  el?.addEventListener("change", renderAll);
});

f_reset.onclick = ()=>{
  f_q.value="";
  f_element.value="";
  f_category.value="";
  f_status.value="";
  resetDateRows();
  renderAll();
};

/* =========================
   init
========================= */
setupDateRows();
resetDateRows();
renderAll();

});

// init
renderAll();
