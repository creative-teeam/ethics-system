// app.js（融合版）
// 必ず index.html 側で <script type="module" src="./app.js"></script> にする

import { loadStore, saveStore, exportJSON, importJSON } from "./storage.js";
import { createUser, createProject, addInput, addIssue, addDecision } from "./db_json.js";

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

// JSONストア版のUI（あなたが貼った後半のやつ）
const btnUser = document.getElementById("btnUser");
const btnProject = document.getElementById("btnProject");
const btnExportAll = document.getElementById("btnExport");
const debug = document.getElementById("debug");

const $ = (id) => document.getElementById(id);

// --- Store ---
let store = loadStore();
let currentUserId = store.users[0]?.user_id ?? null;

// 「今選択中の案件」を store.meta に保存しておく（追加）
if (!store.meta) store.meta = { schemaVersion: "1.0.0", exportedAt: null };
if (!store.meta.currentProjectId) store.meta.currentProjectId = store.projects[0]?.project_id ?? null;

// 初回のダミー案件（なければ作る）
function ensureInitialProject() {
  if (store.projects.length > 0) return;

  // ユーザーがいなければ仮ユーザー作成
  if (!currentUserId) {
    const u = createUser(store, { display_name: "デモユーザー", email: null, role: "editor" });
    currentUserId = u.user_id;
  }
  const p = createProject(store, {
    title: "デモ案件",
    description: "初期プロジェクト",
    owner_user_id: currentUserId,
    status: "draft"
  });
  store.meta.currentProjectId = p.project_id;
}

ensureInitialProject();

// --- Helpers ---
function persist() {
  saveStore(store);
  renderAll();
}

function getCurrentProjectId() {
  return store.meta.currentProjectId ?? store.projects[0]?.project_id ?? null;
}

function setCurrentProjectId(id) {
  store.meta.currentProjectId = id;
}

function getCurrentProject() {
  const pid = getCurrentProjectId();
  return store.projects.find(p => p.project_id === pid) ?? null;
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
function renderProjects() {
  projectSelect.innerHTML = "";
  store.projects.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.project_id;
    opt.textContent = p.title;
    projectSelect.appendChild(opt);
  });

  const pid = getCurrentProjectId();
  if (pid) projectSelect.value = pid;
}

function renderIssues(issues, inputIdForThisText) {
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

    // 「この論点をログに入れる」＝ Issueを作って、判断フォームに入れる
    const btn = li.querySelector("button[data-add]");
    btn.addEventListener("click", () => {
      // Issueとして保存（AI/ルールの候補）
      const iss = addIssue(store, {
        input_id: inputIdForThisText,
        element: mapElement(it.element),
        category: it.category,
        issue_text: it.issue,
        severity: null,
        evidence: null
      });

      // 判断フォームへセット
      logElement.value = it.element;
      logCategory.value = it.category;
      logIssue.value = it.issue;
      logDecision.value = "要確認";
      logRationale.value = "";

      // 今回のIssue IDをフォームに紐づけたいので、datasetに持たせる
      addLogBtn.dataset.issueId = iss.issue_id;

      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
      persist();
    });

    issuesList.appendChild(li);
  });
}

function renderLogs() {
  const project = getCurrentProject();
  const pid = project?.project_id;
  const logs = store.decisions
    .filter(d => d.project_id === pid)
    .slice()
    .sort((a, b) => String(b.decided_at).localeCompare(String(a.decided_at)));

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

  logs.forEach((d) => {
    const issue = store.issues.find(x => x.issue_id === d.issue_id);
    const elementLabel = unmapElement(issue?.element ?? "overall");
    const category = issue?.category ?? "ethics";
    const issueText = issue?.issue_text ?? "(issue not found)";

    const row = document.createElement("div");
    row.className = "rowd";
    row.innerHTML = `
      <div class="cell">
        <span class="tag">${escapeHtml(elementLabel)}</span>
        <span class="tag">${escapeHtml(category)}</span>
      </div>
      <div class="cell">${escapeHtml(issueText)}</div>
      <div class="cell">${escapeHtml(toJaDecision(d.decision))}</div>
      <div class="cell">${escapeHtml(d.rationale || "")}</div>
      <div class="cell"><button class="ghost" data-del="${escapeHtml(d.decision_id)}">×</button></div>
    `;

    row.querySelector("button[data-del]").addEventListener("click", () => {
      if (!confirm("このログを削除しますか？")) return;
      store.decisions = store.decisions.filter(x => x.decision_id !== d.decision_id);
      persist();
    });

    logsTable.appendChild(row);
  });
}

function renderDebug() {
  if (debug) debug.textContent = JSON.stringify(store, null, 2);
}

function renderAll() {
  renderProjects();
  renderLogs();
  renderDebug();
}

// --- Utils ---
function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// element を enumっぽく
function mapElement(label) {
  const m = {
    "脚本": "script",
    "演出": "direction",
    "音楽": "music",
    "照明": "lighting",
    "映像": "video",
    "全体": "overall"
  };
  return m[label] ?? "other";
}
function unmapElement(key) {
  const m = {
    script: "脚本",
    direction: "演出",
    music: "音楽",
    lighting: "照明",
    video: "映像",
    overall: "全体",
    other: "その他"
  };
  return m[key] ?? "その他";
}

function toDecisionEnum(ja) {
  // UIの「採用/却下/保留/要確認」を enum に
  const m = {
    "採用": "accept",
    "却下": "reject",
    "保留": "hold",
    "要確認": "needs_review"
  };
  return m[ja] ?? "needs_review";
}
function toJaDecision(en) {
  const m = {
    accept: "採用",
    reject: "却下",
    hold: "保留",
    needs_review: "要確認"
  };
  return m[en] ?? "要確認";
}

// --- Events（解析） ---
analyzeBtn.addEventListener("click", () => {
  const project = getCurrentProject();
  if (!project) return alert("案件がありません");

  if (!currentUserId) return alert("先にユーザーを作成してください");

  const text = inputText.value || "";

  // 入力テキストを inputs として保存（根拠）
  const input = addInput(store, {
    project_id: project.project_id,
    text,
    source_type: "other",
    version: 1,
    created_by: currentUserId
  });

  const issues = extractIssues(text);
  renderIssues(issues, input.input_id);
  persist();
});

clearBtn.addEventListener("click", () => {
  inputText.value = "";
  issuesList.innerHTML = "";
});

// --- Events（案件作成：既存UIのボタン） ---
createProjectBtn.addEventListener("click", () => {
  if (!currentUserId) return alert("先にユーザーを作成してください");

  const title = (projectTitle.value || "").trim();
  if (!title) return alert("案件名を入力してください");

  const p = createProject(store, {
    title,
    description: null,
    owner_user_id: currentUserId,
    status: "draft"
  });

  setCurrentProjectId(p.project_id);
  projectTitle.value = "";
  persist();
});

projectSelect.addEventListener("change", () => {
  setCurrentProjectId(projectSelect.value);
  persist();
});

deleteProjectBtn.addEventListener("click", () => {
  const pid = getCurrentProjectId();
  if (!pid) return;

  if (store.projects.length <= 1) return alert("最後の案件は削除できません");
  if (!confirm("この案件を削除しますか？（関連ログも見えなくなります）")) return;

  // 案件削除（※関連データは残す/消すを選べるが、ここでは“消す”）
  store.projects = store.projects.filter(p => p.project_id !== pid);

  // projectに紐づく入力→issue→decisionも消す（整合性）
  const inputIds = new Set(store.inputs.filter(i => i.project_id === pid).map(i => i.input_id));
  const issueIds = new Set(store.issues.filter(iss => inputIds.has(iss.input_id)).map(iss => iss.issue_id));

  store.inputs = store.inputs.filter(i => i.project_id !== pid);
  store.issues = store.issues.filter(iss => !inputIds.has(iss.input_id));
  store.decisions = store.decisions.filter(d => d.project_id !== pid && !issueIds.has(d.issue_id));

  setCurrentProjectId(store.projects[0]?.project_id ?? null);
  persist();
});

// --- Events（ログ追加：Decision保存） ---
addLogBtn.addEventListener("click", () => {
  const project = getCurrentProject();
  if (!project) return alert("案件がありません");
  if (!currentUserId) return alert("先にユーザーを作成してください");

  const issueText = (logIssue.value || "").trim();
  if (!issueText) return alert("論点（issue）を入力してください");

  // 「この論点をログに入れる」を押してない場合、Issueが未作成かも → その場で作る
  let issueId = addLogBtn.dataset.issueId || null;
  if (!issueId) {
    // 直入力の論点を、inputs/issueとして最低限保存
    const input = addInput(store, {
      project_id: project.project_id,
      text: "(手入力ログ)",
      source_type: "other",
      version: 1,
      created_by: currentUserId
    });

    const iss = addIssue(store, {
      input_id: input.input_id,
      element: mapElement(logElement.value),
      category: logCategory.value,
      issue_text: issueText,
      severity: null,
      evidence: null
    });
    issueId = iss.issue_id;
  }

  addDecision(store, {
    issue_id: issueId,
    project_id: project.project_id,
    decision: toDecisionEnum(logDecision.value),
    rationale: (logRationale.value || "").trim(),
    decided_by: currentUserId,
    attachments: []
  });

  // 入力クリア
  logIssue.value = "";
  logRationale.value = "";
  addLogBtn.dataset.issueId = "";

  persist();
});

// --- Events（ログ全削除） ---
clearLogsBtn.addEventListener("click", () => {
  const project = getCurrentProject();
  if (!project) return;

  if (!confirm("この案件のログ（Decision）を全削除しますか？")) return;
  store.decisions = store.decisions.filter(d => d.project_id !== project.project_id);
  persist();
});

// --- Export（この案件だけ） ---
exportBtn.addEventListener("click", () => {
  const project = getCurrentProject();
  if (!project) return;

  // 案件単位で束ねて書き出し
  const pid = project.project_id;
  const inputs = store.inputs.filter(i => i.project_id === pid);
  const inputIds = new Set(inputs.map(i => i.input_id));
  const issues = store.issues.filter(iss => inputIds.has(iss.input_id));
  const issueIds = new Set(issues.map(iss => iss.issue_id));
  const decisions = store.decisions.filter(d => d.project_id === pid || issueIds.has(d.issue_id));
  const tasks = store.tasks?.filter(t => t.project_id === pid) ?? [];
  const references = store.references?.filter(r => r.project_id === pid) ?? [];

  const bundle = { project, inputs, issues, decisions, tasks, references };

  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${project.title || "project"}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// --- JSONストア全部Export（btnExport が存在する場合） ---
if (btnExportAll) {
  btnExportAll.addEventListener("click", () => {
    const text = exportJSON(store);
    const blob = new Blob([text], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ethics-export.json";
    a.click();
  });
}

// --- ユーザー作成（btnUser が存在する場合） ---
if (btnUser) {
  btnUser.addEventListener("click", () => {
    const u = createUser(store, {
      display_name: $("uname")?.value ?? null,
      email: $("uemail")?.value ?? null,
      role: $("urole")?.value ?? "editor"
    });
    currentUserId = u.user_id;
    persist();
  });
}

// --- もう一つの案件作成ボタン（btnProject が存在する場合） ---
if (btnProject) {
  btnProject.addEventListener("click", () => {
    if (!currentUserId) return alert("ユーザー作成が先");
    const p = createProject(store, {
      title: $("ptitle")?.value ?? "新規案件",
      description: $("pdesc")?.value ?? null,
      owner_user_id: currentUserId,
      status: "draft"
    });
    setCurrentProjectId(p.project_id);
    persist();
  });
}

// init
renderAll();
