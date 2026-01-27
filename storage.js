// storage.js
const STORAGE_KEY = "ethics_system_json_v1";

export function nowISO() {
  return new Date().toISOString();
}

export function uuid() {
  return crypto?.randomUUID ? crypto.randomUUID() : fallbackUUID();
}

function fallbackUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function emptyStore() {
  return {
    meta: { schemaVersion: "1.0.0", exportedAt: null, currentProjectId: null },
    users: [],
    projects: [],
    inputs: [],
    issues: [],
    decisions: [],
    tasks: [],
    references: [],
    audit: []
  };
}

function normalizeStore(s) {
  const base = emptyStore();
  const out = { ...base, ...(s || {}) };

  for (const k of ["users", "projects", "inputs", "issues", "decisions", "tasks", "references", "audit"]) {
    if (!Array.isArray(out[k])) out[k] = [];
  }
  if (!out.meta) out.meta = base.meta;
  if (out.meta.currentProjectId === undefined) out.meta.currentProjectId = null;

  return out;
}

export function loadStore() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return emptyStore();
  try {
    return normalizeStore(JSON.parse(raw));
  } catch {
    return emptyStore();
  }
}

export function saveStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function exportJSON(store) {
  const copy = JSON.parse(JSON.stringify(store));
  copy.meta.exportedAt = nowISO();
  return JSON.stringify(copy, null, 2);
}

export function importJSON(text) {
  return normalizeStore(JSON.parse(text));
}

export function addAudit(store, log) {
  store.audit.unshift({
    audit_id: uuid(),
    ...log,
    created_at: nowISO()
  });
}
