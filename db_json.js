import { uuid, nowISO, addAudit } from "./storage.js";
email: email ?? null,
role: role ?? "editor",
created_at: nowISO(),
last_login: null
};
store.users.push(u);
addAudit(store, { entity_type: "user", entity_id: u.user_id, action: "create", actor_user_id: u.user_id, before_json: null, after_json: u });
return u;
}


export function createProject(store, { title, description, owner_user_id, status }) {
const p = {
project_id: uuid(),
title,
description: description ?? null,
owner_user_id,
status: status ?? "draft",
created_at: nowISO(),
updated_at: nowISO()
};
store.projects.push(p);
addAudit(store, { entity_type: "project", entity_id: p.project_id, action: "create", actor_user_id: owner_user_id, before_json: null, after_json: p });
return p;
}


export function addInput(store, data) {
const i = {
input_id: uuid(),
...data,
created_at: nowISO()
};
store.inputs.push(i);
addAudit(store, { entity_type: "input", entity_id: i.input_id, action: "create", actor_user_id: data.created_by, before_json: null, after_json: i });
return i;
}


export function addIssue(store, data) {
const iss = {
issue_id: uuid(),
...data,
created_at: nowISO()
};
store.issues.push(iss);
addAudit(store, { entity_type: "issue", entity_id: iss.issue_id, action: "create", actor_user_id: "system", before_json: null, after_json: iss });
return iss;
}


export function addDecision(store, data) {
const d = {
decision_id: uuid(),
...data,
decided_at: nowISO()
};
store.decisions.push(d);
addAudit(store, { entity_type: "decision", entity_id: d.decision_id, action: "create", actor_user_id: data.decided_by, before_json: null, after_json: d });
return d;
}
