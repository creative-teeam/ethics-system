const STORE_KEY = "stageEthicsDemo_v1";

/* ---------- Utils ---------- */
function uid(){ return Date.now()+"_"+Math.random(); }
function now(){ return new Date().toISOString(); }

function load(){
  return JSON.parse(localStorage.getItem(STORE_KEY) || `{
    "projects": {},
    "current": null
  }`);
}

function save(d){
  localStorage.setItem(STORE_KEY, JSON.stringify(d));
}

/* ---------- Projects ---------- */
function ensureProject(){
  const d = load();
  if(!d.current){
    const id = uid();
    d.projects[id] = {id,title:"デモ案件",logs:[]};
    d.current = id;
    save(d);
  }
  return d;
}

/* ---------- Issue extraction ---------- */
function extract(text){
  const out=[];
  const t=text.toLowerCase();

  if(t.includes("配信")) out.push(["映像","copyright","配信権の確認"]);
  if(t.includes("sns")) out.push(["SNS","sns","SNS利用規約確認"]);
  if(t.includes("衣装")) out.push(["衣装","costume","ロゴ権利確認"]);
  if(t.includes("美術")) out.push(["美術","art","素材ライセンス確認"]);

  if(!out.length) out.push(["全体","ethics","追加情報が必要"]);

  return out;
}

/* ---------- Render Issues ---------- */
function renderIssues(list){
  const ul=document.getElementById("issuesList");
  ul.innerHTML="";
  list.forEach(i=>{
    const li=document.createElement("li");
    li.innerHTML=`<span class="tag">${i[0]}</span>
                  <span class="tag">${i[1]}</span>
                  ${i[2]}`;
    ul.appendChild(li);
  });
}

/* ---------- Logs ---------- */
function addLog(){
  const d=ensureProject();
  const p=d.projects[d.current];

  const issue=document.getElementById("logIssue").value.trim();
  if(!issue) return alert("論点を入力");

  p.logs.unshift({
    id:uid(),
    at:now(),
    element:logElement.value,
    category:logCategory.value,
    issue,
    decision:logDecision.value,
    status:logStatus.value,
    rationale:logRationale.value,
    url:logAttachUrl.value
  });

  save(d);
  renderLogs();
}

function renderLogs(){
  const d=ensureProject();
  const p=d.projects[d.current];
  const box=document.getElementById("logsTable");
  box.innerHTML="";

  const head=document.createElement("div");
  head.className="rowh";
  head.innerHTML="<div>要素</div><div>論点</div><div>判断</div><div>進捗</div><div>URL</div><div></div>";
  box.appendChild(head);

  p.logs.forEach(l=>{
    const r=document.createElement("div");
    r.className="rowd";
    r.innerHTML=`
      <div>${l.element}</div>
      <div>${l.issue}</div>
      <div>${l.decision}</div>
      <div>${l.status}</div>
      <div>${l.url?`<a href="${l.url}" target="_blank">リンク</a>`:""}</div>
      <div><button class="danger">×</button></div>
    `;
    r.querySelector("button").onclick=()=>{
      p.logs=p.logs.filter(x=>x.id!==l.id);
      save(d);
      renderLogs();
    };
    box.appendChild(r);
  });
}

/* ---------- Analyze ---------- */
document.getElementById("analyzeBtn").onclick=()=>{
  const t=document.getElementById("inputText").value;
  renderIssues(extract(t));
};

/* ---------- Buttons ---------- */
document.getElementById("addLogBtn").onclick=addLog;
document.getElementById("clearBtn").onclick=()=>inputText.value="";
document.getElementById("clearLogsBtn").onclick=()=>{
  if(confirm("全削除？")){
    const d=ensureProject();
    d.projects[d.current].logs=[];
    save(d);
    renderLogs();
  }
};

/* ---------- Init ---------- */
ensureProject();
renderLogs();
