const $ = (s) => document.querySelector(s);
let mode = "login",
  current = null,
  sites = [];
async function api(path, body, method = body ? "POST" : "GET") {
  const r = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.error ?? "요청 실패");
  return data;
}
function note(text) {
  $("#notice").textContent = text;
}
function defaults() {
  return {
    name: "새 상담원",
    greeting: "안녕하세요. AI 상담원입니다. 무엇을 도와드릴까요?",
    origins: [location.origin],
    engine: "api",
    rules:
      "자료에 없는 내용은 모른다고 답하고 문의 남기기를 안내합니다. 견적이나 일정을 확정하지 않습니다.",
    knowledge: "",
    maxSeconds: 180,
    maxConcurrent: 2,
    dailySeconds: 1800,
  };
}
function data() {
  const f = $("#site-form");
  const c = {};
  for (const key of ["name", "greeting", "engine", "rules", "knowledge"])
    c[key] = f.elements[key].value;
  c.origins = f.elements.origins.value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const key of ["maxSeconds", "maxConcurrent", "dailySeconds"])
    c[key] = Number(f.elements[key].value);
  return c;
}
function showConnection(site) {
  $("#connection").textContent = site?.online
    ? "헤르메스 연결됨"
    : "헤르메스 미연결";
  $("#connection").classList.toggle("online", !!site?.online);
  const c = site?.capabilities ?? {};
  $("#capabilities").textContent = site?.online
    ? `자료 상담 ${c.hermes ? "준비됨" : "미준비"} / API 음성 ${c.api ? "키 설정됨" : "미설정"} / 구독 음성 ${c.subscription ? "활성화됨" : "비활성"}${c.demo ? " / 데모 커넥터" : ""}`
    : "연결 코드를 발급하고 제공자 서버에서 커넥터를 실행하세요.";
}
function select(site) {
  current = site;
  $("#editor").hidden = false;
  $("#page-title").textContent = site.draft.name;
  for (const [key, value] of Object.entries(site.draft)) {
    const input = $("#site-form").elements[key];
    if (input) input.value = Array.isArray(value) ? value.join("\n") : value;
  }
  $("#revision").textContent = site.revision
    ? `게시 버전 ${site.revision} · 수정은 초안에 저장됩니다`
    : "아직 게시하지 않았습니다";
  $("#snippet").textContent =
    `<script src="${location.origin}/widget.js" data-site-id="${site.id}" async></script>`;
  $("#connector-command").textContent =
    `hermes consult --relay ${location.origin}`;
  $("#preview").href = `/demo.html?site=${encodeURIComponent(site.id)}`;
  $("#pair-code").textContent = "";
  showConnection(site);
  renderSites();
}
function renderSites() {
  const nav = $("#sites");
  nav.replaceChildren();
  for (const s of sites) {
    const b = document.createElement("button");
    b.textContent = s.draft.name;
    b.className = s.id === current?.id ? "selected" : "";
    b.onclick = () => select(s);
    nav.append(b);
  }
}
async function refresh() {
  sites = await api("/api/sites");
  renderSites();
}
async function enter() {
  const me = await api("/api/me");
  $("#account").textContent = me.email;
  $("#auth").hidden = true;
  $("#workspace").hidden = false;
  await refresh();
  if (sites.length) select(sites[0]);
}
$("#auth-toggle").onclick = () => {
  mode = mode === "login" ? "register" : "login";
  $("#auth-title").textContent =
    mode === "login" ? "상담 관리에 로그인" : "제공자 계정 만들기";
  $("#auth-submit").textContent = mode === "login" ? "로그인" : "계정 만들기";
  $("#auth-toggle").textContent =
    mode === "login" ? "처음이라면 계정 만들기" : "이미 계정이 있어요";
  $("#password").autocomplete =
    mode === "login" ? "current-password" : "new-password";
  $("#auth-error").textContent = "";
};
$("#auth-form").onsubmit = async (e) => {
  e.preventDefault();
  const b = $("#auth-submit");
  b.disabled = true;
  try {
    await api(`/api/${mode}`, {
      email: $("#email").value,
      password: $("#password").value,
    });
    $("#password").value = "";
    await enter();
  } catch (err) {
    $("#auth-error").textContent = err.message;
  } finally {
    b.disabled = false;
  }
};
$("#logout").onclick = async () => {
  await api("/api/logout", {});
  location.reload();
};
$("#new-site").onclick = async () => {
  try {
    const s = await api("/api/sites", defaults());
    await refresh();
    select(s);
    note("새 상담원이 만들어졌습니다. 자료와 규칙을 입력한 뒤 게시하세요.");
  } catch (e) {
    note(e.message);
  }
};
async function save(publish = false) {
  if (!current || !$("#site-form").reportValidity()) return;
  await api(`/api/sites/${current.id}`, data(), "PUT");
  if (publish) await api(`/api/sites/${current.id}/publish`, {});
  const id = current.id;
  await refresh();
  select(sites.find((s) => s.id === id));
  note(
    publish
      ? "게시했습니다. 새 상담부터 이 설정을 사용합니다."
      : "초안을 저장했습니다. 운영 상담에는 아직 반영되지 않았습니다.",
  );
}
$("#site-form").onsubmit = (e) => {
  e.preventDefault();
  save().catch((e) => note(e.message));
};
$("#publish").onclick = () => save(true).catch((e) => note(e.message));
$("#upload").onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 160000) {
    note("자료는 최대 40,000자까지 입력할 수 있습니다.");
    return;
  }
  const text = await file.text();
  if (text.length > 40000) {
    note("자료는 최대 40,000자까지 입력할 수 있습니다.");
    return;
  }
  $("#knowledge").value = text;
  note("파일을 초안에 불러왔습니다. 저장 또는 게시하세요.");
};
document.querySelectorAll("[data-tab]").forEach(
  (b) =>
    (b.onclick = () => {
      document.querySelectorAll("[data-tab]").forEach((t) => {
        t.classList.toggle("active", t === b);
        t.setAttribute("aria-selected", String(t === b));
      });
      document
        .querySelectorAll(".tab-panel")
        .forEach((p) => (p.hidden = p.id !== b.dataset.tab));
      if (b.dataset.tab === "activity")
        activity().catch((e) => note(e.message));
    }),
);
$("#pair").onclick = async () => {
  try {
    const r = await api(`/api/sites/${current.id}/pair`, {});
    $("#pair-code").textContent = r.code;
    note(
      "연결 코드는 5분 동안 유효합니다. 서버를 재시작하면 새 코드로 다시 연결하세요.",
    );
  } catch (e) {
    note(e.message);
  }
};
$("#disconnect").onclick = async () => {
  if (!confirm("진행 중인 상담을 종료하고 헤르메스 연결을 해제할까요?")) return;
  await api(`/api/sites/${current.id}/disconnect`, {});
  showConnection(null);
  note("연결을 해제했습니다.");
};
$("#copy-snippet").onclick = async () => {
  try {
    await navigator.clipboard.writeText($("#snippet").textContent);
    note("설치 코드를 복사했습니다.");
  } catch {
    note(
      "브라우저가 복사를 허용하지 않았습니다. 코드를 직접 선택해 복사하세요.",
    );
  }
};
async function activity() {
  if (!current) return;
  const r = await api(`/api/sites/${current.id}/activity`);
  const leads = $("#leads");
  leads.replaceChildren();
  if (!r.leads.length) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = "아직 접수된 문의가 없습니다.";
    leads.append(p);
  }
  for (const item of r.leads) {
    const box = document.createElement("div");
    box.className = "lead";
    for (const text of [
      item.name + " · " + item.contact,
      item.message,
      new Date(item.created).toLocaleString(),
    ]) {
      const p = document.createElement("p");
      p.textContent = text;
      box.append(p);
    }
    leads.append(box);
  }
  const rows = $("#sessions");
  rows.replaceChildren();
  const statuses = {
    active: "진행 중",
    ended: "종료",
    expired: "시간 만료",
    interrupted: "연결 중단",
    disconnected: "연결 해제",
    reconnected: "재연결",
  };
  for (const s of r.sessions) {
    const tr = document.createElement("tr");
    for (const value of [
      new Date(s.started).toLocaleString(),
      s.engine === "api" ? "API" : "구독",
      s.used + "초",
      statuses[s.status] ?? s.status,
    ]) {
      const td = document.createElement("td");
      td.textContent = value;
      tr.append(td);
    }
    rows.append(tr);
  }
}
$("#refresh-activity").onclick = () => activity().catch((e) => note(e.message));
setInterval(async () => {
  if (!current) return;
  try {
    const s = await api(`/api/sites/${current.id}`);
    showConnection(s);
  } catch {}
}, 10000);
enter().catch(() => {});
