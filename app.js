// --- Storage keys ---
const STORE_KEY = "stageEthicsData_v1";

// --- DOM ---
const inputText = document.getElementById("inputText");
const analyzeBtn = document.getElementById("analyzeBtn");
const clearBtn = document.getElementById("clearBtn");
const issuesList = document.getElementById("issuesList");

const projectTitle = document.getElementById("projectTitle");
const createProjectBtn = document.getElementById("createProjectBtn");
const projectSelect = document.getElementById("projectSelect");
const deleteProjectBtn = document.getElementById("deleteProjectBtn");

const logElement = document.getElementById("logElement");
const logCategory = document.getElementById("logCategory");
const logIssue = document.getElementById("logIssue");
const logDecision = document.getElementById("logDecision");
const logRationale = document.getElementById("logRationale");

const addLogBtn = document.getElementById("addLogBtn");
const exportBtn = document.getElementById("exportBtn");
const clearLogsBtn = document.getElementById("clearLogsBtn");
const logsTable = document.getElementById("logsTable");

// --- Data model ---
// data = { projects: { [id]: { id, title, logs: [] } }, currentProjectId }
function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();
}

function loadData() {
  const raw = localStorage.getItem(STORE_KEY);
  if (!raw) {
    const firstId = uid();
    const init = {
      currentProjectId: firstId,
      projects: {
        [firstId]: { id: firstId, title: "デモ案件", logs: [] }
      }
    };
    localStorage.setItem(STORE_KEY, JSON.stringify(init));
    return init;
  }
  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(STORE_KEY);
    return loadData();
  }
}

function saveData(data) {
  localStorage.setItem(STORE_KEY, JSON.stringify(data));
}

// --- Rule-based issue extractor (no AI) ---
function extractIssues(text) {
  const t = (text || "").toLowerCase();
  const issues = [];

  const add = (element, category, issue) => issues.push({ element, category, issue });

  if (text.includes("配信") || text.includes("収録") || t.includes("youtube") || t.includes("tiktok")) {
    add("映像", "copyright", "配信/収録がある場合、上演と配信で必要な許諾（音楽・映像素材・実演/肖像）が分かれる可能性があります。形態ごとに権利処理を整理してください。");
    add("映像", "privacy", "舞台裏/楽屋/未成年の映り込みや個人特定のリスクがあります。撮影範囲・同意取得・公開範囲を設計してください。");
  }

  if (text.includes("既存曲") || text.includes("カバー") || text.includes("BGM") || t.includes("j-pop")) {
    add("音楽", "copyright", "既存曲の利用は『上演』と『配信/録画』で許諾が変わることがあります。使用形態・区間・音源種類（生演奏/録音）を分けて確認してください。");
  }

  if (text.includes("実在") || text.includes("事件") || text.includes("災害")) {
    add("脚本", "ethics", "実在の事件/災害を扱う場合、当事者性・再トラウマ化・誤解や誹謗中傷の誘発リスクを評価し、注意書きや監修の導入を検討してください。");
  }

  if (text.includes("ストロボ") || text.includes("点滅")) {
    add("照明", "safety", "点滅・強い光は体調不良を引き起こす可能性があります。注意書き・緩和策・観客導線を検討してください。");
  }

  if (issues.length === 0) {
    add("全体", "ethics", "顕著な論点は検出できませんでした。『配信有無』『素材の出所』『改変範囲（脚本/演出）』などの情報を追記すると精度が上がります。");
  }

  return issues;
}

// --- UI render ---
function renderProjects(data) {
  projectSelect.innerHTML = "";
  const ids = Object.keys(data.projects);
  ids.forEach(id => {
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
      <div style="margin-top:6px;">${escapeHtml(it.issue)}</div>
      <div class="row" style="margin-top:10px;">
        <button class="ghost" data-add="1">この論点をログに入れる</button>
      </div>
    `;
    const btn = li.querySelector("button[data-add]");
    btn.addEventListener("click", () => {
      logElement.value = it.element;
      logCategory.value = it.category;
      logIssue.value = it.issue;
      logDecision.value = "要確認";
      logRationale.value = "";
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    });
    issuesList.appendChild(li);
  });
}

function renderLogs(data) {
  const p = data.projects[data.currentProjectId];
  const logs = p?.logs || [];

  logsTable.innerHTML = "";
  const head = document.createElement("div");
  head.className = "rowh";
  head.innerHTML = `
    <div class="cell">要素/カテゴリ</div>
    <div class="cell">論点</div>
    <div class="cell">判断</div>
    <div class="cell">理由</div>
    <div class="cell">削除</div>
  `;
  logsTable.appendChild(head);

  if (logs.length === 0) {
    const empty = document.createElement("div");
    empty.className = "rowd";
    empty.innerHTML = `<div class="cell" style="grid-column:1/-1;color:#666;">まだログがありません。</div>`;
    logsTable.appendChild(empty);
    return;
  }

  logs.forEach((l, idx) => {
    const row = document.createElement("div");
    row.className = "rowd";
    row.innerHTML = `
      <div class="cell">
        <span class="tag">${escapeHtml(l.element)}</span>
        <span class="tag">${escapeHtml(l.category)}</span>
      </div>
      <div class="cell">${escapeHtml(l.issue)}</div>
      <div class="cell">${escapeHtml(l.decision)}</div>
      <div class="cell">${escapeHtml(l.rationale || "")}</div>
      <div class="cell"><button class="ghost" data-del="${idx}">×</button></div>
    `;
    row.querySelector("button[data-del]").addEventListener("click", () => {
      if (!confirm("このログを削除しますか？")) return;
      const d = loadData();
      d.projects[d.currentProjectId].logs.splice(idx, 1);
      saveData(d);
      renderAll();
    });
    logsTable.appendChild(row);
  });
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderAll() {
  const data = loadData();
  renderProjects(data);
  renderLogs(data);
}

// --- Events ---
analyzeBtn.addEventListener("click", () => {
  const text = inputText.value || "";
  const issues = extractIssues(text);
  renderIssues(issues);
});

clearBtn.addEventListener("click", () => {
  inputText.value = "";
  issuesList.innerHTML = "";
});

createProjectBtn.addEventListener("click", () => {
  const title = (projectTitle.value || "").trim();
  if (!title) return alert("案件名を入力してください");
  const data = loadData();
  const id = uid();
  data.projects[id] = { id, title, logs: [] };
  data.currentProjectId = id;
  saveData(data);
  projectTitle.value = "";
  renderAll();
});

projectSelect.addEventListener("change", () => {
  const data = loadData();
  data.currentProjectId = projectSelect.value;
  saveData(data);
  renderAll();
});

deleteProjectBtn.addEventListener("click", () => {
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

addLogBtn.addEventListener("click", () => {
  const issue = (logIssue.value || "").trim();
  if (!issue) return alert("論点（issue）を入力してください");

  const data = loadData();
  const p = data.projects[data.currentProjectId];
  p.logs.unshift({
    at: new Date().toISOString(),
    element: logElement.value,
    category: logCategory.value,
    issue: issue,
    decision: logDecision.value,
    rationale: (logRationale.value || "").trim()
  });

  saveData(data);

  logIssue.value = "";
  logRationale.value = "";
  renderAll();
});

clearLogsBtn.addEventListener("click", () => {
  if (!confirm("この案件のログを全削除しますか？")) return;
  const data = loadData();
  data.projects[data.currentProjectId].logs = [];
  saveData(data);
  renderAll();
});

exportBtn.addEventListener("click", () => {
  const data = loadData();
  const p = data.projects[data.currentProjectId];
  const blob = new Blob([JSON.stringify(p, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${p.title || "project"}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// init
renderAll();
