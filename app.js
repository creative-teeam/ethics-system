// app.js（結果が必ず出る版）
import { loadStore, saveStore, exportJSON } from "./storage.js";
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

// JSONストアUI
const btnUser = document.getElementById("btnUser");
const btnProject = document.getElementById("btnProject");
const btnExportAll = document.getElementById("btnExport");
const debug = document.getElementById("debug");

const $ = (id) => document.getElementById(id);

// --- Store ---
let store = loadStore();

// ✅ 重要：ユーザーがいなければ自動で作る（これで解析が止まらない）
let currentUserId = store.users[0]?.user_id ?? null;
if (!currentUserId) {
  const u = createUser(store, { display_name: "デモユーザー", email: null, role: "editor" });
  currentUserId = u.user_id;
}

// ✅ 重要：案件がなければ自動で作る（プルダウンが空にならない）
if (!store.meta) store.meta = { schemaVersion: "1.0.0", exportedAt: null, currentProjectId: null };
if (!store.projects.length) {
  const p = createProject(store, { title: "デモ案件", description: "初期案件", owner_user_id: currentUserId, status: "draft" });
  store.meta.currentProjectId = p.project_id;
} else if (!store.meta.currentProjectId) {
  store.meta.currentProjectId = store.projects[0].project_id;
}

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
  return store.projects.find((p) => p.project_id === pid) ?? null;
}

// --- Rule-based issue extractor ---
function extractIssues(text) {
  const t = (text || "").toLowerCase();
  const issues = [];
  const add = (element, category, issue) => issues.push({ element, category, issue });

  if (text.includes("配信") || text.includes("収録") || t.includes("youtube") || t.includes("tiktok")) {
    add("映像", "copyright", "配信/収録がある場合、上演と配信で必要な許諾（音楽・映像素材・実演/肖像）が分かれる可能性があります。形態ごとに整理してください。");
    add("映像", "privacy", "舞台裏/楽屋/未成年の映り込み等のリスク。撮影範囲・同意取得・公開範囲を設計してください。");
  }
  if (text.includes("既存曲") || text.includes("カバー") || text.includes("BGM") || t.includes("j-pop")) {
    add("音楽", "copyright", "既存曲は『上演』と『配信/録画』で許諾が変わることがあります。使用形態（生演奏/音源）も分けて確認してください。");
  }
  if (text.includes("実在") || text.includes("事件") || text.includes("災害")) {
    add("脚本", "ethics", "実在の事件/災害は再トラウマ化・誤解・誹謗中傷リスク。注意書きや監修を検討してください。");
  }
  if (text.includes("ストロボ") || text.includes("点滅")) {
    add("照明", "safety", "点滅・強い光は体調不良の可能性。注意書き・緩和策・観客導線を検討してください。");
  }
  if (!issues.length) {
    add("全体", "ethics", "顕著な論点は検出できませんでした。『配信有無』『素材の出所』『改変範囲』などを追記すると精度が上がります。");
  }
  return issues;
}

// --- UI render ---
function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function mapElement(label) {
  const m = { 脚本: "script", 演出: "direction", 音楽: "music", 照明: "lighting", 映像: "video", 全体: "overall" };
  return m[label] ?? "other";
}
function unmapElement(key) {
  const m = { script: "脚本", direction: "演出", music: "音楽", lighting: "照明", video: "映像", overall: "全体", other: "その他" };
  return m[key] ?? "その他";
}
function toDecisionEnum(ja) {
  const m = { 採用: "accept", 却下: "reject", 保留: "hold", 要確認: "needs_review" };
  return m[ja] ?? "needs_review";
}
function toJaDecision(en) {
  const m = { accept: "採用", reject: "却下", hold: "保留", needs_review: "要確認" };
  return m[en] ?? "要確認";
}

function renderProjects() {
  if (!projectSelect) return;
  projectSelect.innerHTML = "";
  store.projects.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.project_id;
    opt.textContent = p.title;
    projectSelect.appendChild(opt);
  });
  const pid = getCurrentProjectId();
  if (pid) projectSelect.value = pid;
}

function renderIssues(issues, inputId) {
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
    li.querySelector("button[data-add]").addEventListener("click", () => {
      const iss = addIssue(store, {
        input_id: inputId,
        element: mapElement(it.element),
        category: it.category,
        issue_text: it.issue,
        severity: null,
        evidence: null
      });

      logElement.value = it.element;
      logCategory.value = it.category;
      logIssue.value = it.issue;
      logDecision.value = "要確認";
      logRationale.value = "";
      addLogBtn.dataset.issueId = iss.issue_id;

      persist();
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    });

    issuesList.appendChild(li);
  });
}

function renderLogs() {
  if (!logsTable) return;
  const pid = getCurrentProjectId();
  const logs = store.decisions
    .filter((d) => d.project_id === pid)
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

  if (!logs.length) {
    const empty = document.createElement("div");
    empty.className = "rowd";
    empty.innerHTML = `<div class="cell" style="grid-column:1/-1;color:#666;">まだログがありません。</div>`;
    logsTable.appendChild(empty);
    return;
  }

  logs.forEach((d) => {
    const issue = store.issues.find((x) => x.issue_id === d.issue_id);
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
      store.decisions = store.decisions.filter((x) => x.decision_id !== d.decision_id);
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

// --- Events ---
analyzeBtn?.addEventListener("click", () => {
  const project = getCurrentProject();
  if (!project) return alert("案件がありません");

  const text = inputText.value || "";
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

clearBtn?.addEventListener("click", () => {
  inputText.value = "";
  issuesList.innerHTML = "";
});

createProjectBtn?.addEventListener("click", () => {
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

projectSelect?.addEventListener("change", () => {
  setCurrentProjectId(projectSelect.value);
  persist();
});

deleteProjectBtn?.addEventListener("click", () => {
  const pid = getCurrentProjectId();
  if (!pid) return;
  if (store.projects.length <= 1) return alert("最後の案件は削除できません");
  if (!confirm("この案件を削除しますか？")) return;

  // 関連データも削除
  const inputIds = new Set(store.inputs.filter((i) => i.project_id === pid).map((i) => i.input_id));
  const issueIds = new Set(store.issues.filter((iss) => inputIds.has(iss.input_id)).map((iss) => iss.issue_id));

  store.projects = store.projects.filter((p) => p.project_id !== pid);
  store.inputs = store.inputs.filter((i) => i.project_id !== pid);
  store.issues = store.issues.filter((iss) => !inputIds.has(iss.input_id));
  store.decisions = store.decisions.filter((d) => d.project_id !== pid && !issueIds.has(d.issue_id));

  setCurrentProjectId(store.projects[0]?.project_id ?? null);
  persist();
});

addLogBtn?.addEventListener("click", () => {
  const project = getCurrentProject();
  if (!project) return alert("案件がありません");

  const issueText = (logIssue.value || "").trim();
  if (!issueText) return alert("論点（issue）を入力してください");

  let issueId = addLogBtn.dataset.issueId || null;

  if (!issueId) {
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

  logIssue.value = "";
  logRationale.value = "";
  addLogBtn.dataset.issueId = "";
  persist();
});

clearLogsBtn?.addEventListener("click", () => {
  const pid = getCurrentProjectId();
  if (!pid) return;
  if (!confirm("この案件のログを全削除しますか？")) return;
  store.decisions = store.decisions.filter((d) => d.project_id !== pid);
  persist();
});

exportBtn?.addEventListener("click", () => {
  const project = getCurrentProject();
  if (!project) return;

  const pid = project.project_id;
  const inputs = store.inputs.filter((i) => i.project_id === pid);
  const inputIds = new Set(inputs.map((i) => i.input_id));
  const issues = store.issues.filter((iss) => inputIds.has(iss.input_id));
  const issueIds = new Set(issues.map((iss) => iss.issue_id));
  const decisions = store.decisions.filter((d) => d.project_id === pid || issueIds.has(d.issue_id));
  const bundle = { project, inputs, issues, decisions };

  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${project.title || "project"}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// 全体Export
btnExportAll?.addEventListener("click", () => {
  const text = exportJSON(store);
  const blob = new Blob([text], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "ethics-export.json";
  a.click();
});

// ユーザー作成（任意：押せば増える）
btnUser?.addEventListener("click", () => {
  const u = createUser(store, {
    display_name: $("uname")?.value ?? null,
    email: $("uemail")?.value ?? null,
    role: $("urole")?.value ?? "editor"
  });
  currentUserId = u.user_id;
  persist();
});

// 追加案件作成（任意）
btnProject?.addEventListener("click", () => {
  const p = createProject(store, {
    title: $("ptitle")?.value ?? "新規案件",
    description: $("pdesc")?.value ?? null,
    owner_user_id: currentUserId,
    status: "draft"
  });
  setCurrentProjectId(p.project_id);
  persist();
});

// init
persist();
