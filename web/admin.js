import { applyI18n, pickLocale, relayError, t } from "./i18n.js";
const $ = (s) => document.querySelector(s);
let locale = (() => {
  try {
    return localStorage.getItem("hc-admin-locale") || pickLocale(navigator.language);
  } catch {
    return pickLocale(navigator.language);
  }
})();
const T = (key, ...values) => t(locale, key, ...values);
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
  if (!r.ok) throw relayError(locale, data);
  return data;
}
function note(text) {
  $("#notice").textContent = text;
}
function defaults() {
  return {
    name: T("defaultSiteName"),
    greeting: T("greetingPlaceholder"),
    origins: [location.origin],
    engine: "api",
    language: "auto",
    rules: T("defaultRules"),
    knowledge: "",
    maxSeconds: 180,
    maxConcurrent: 2,
    dailySeconds: 1800,
  };
}
function data() {
  const f = $("#site-form");
  const c = {};
  for (const key of ["name", "greeting", "engine", "language", "rules", "knowledge"])
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
    ? T("hermesConnected")
    : T("hermesDisconnected");
  $("#connection").classList.toggle("online", !!site?.online);
  const c = site?.capabilities ?? {};
  $("#capabilities").textContent = site?.online
    ? T(
        "capabilities",
        T(c.hermes ? "ready" : "notReady"),
        T(c.api ? "keySet" : "keyMissing"),
        T(c.subscription ? "enabled" : "disabled"),
        c.demo ? T("demoConnector") : "",
      )
    : T("pairHint");
}
function select(site) {
  current = site;
  $("#editor").hidden = false;
  $("#page-title").textContent = site.draft.name;
  // Sites saved before the language setting existed default to "auto".
  for (const [key, value] of Object.entries({ language: "auto", ...site.draft })) {
    const input = $("#site-form").elements[key];
    if (input) input.value = Array.isArray(value) ? value.join("\n") : value;
  }
  $("#revision").textContent = site.revision
    ? T("revision", site.revision)
    : T("neverPublished");
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
function renderAuth() {
  $("#auth-title").textContent = T(mode === "login" ? "loginTitle" : "registerTitle");
  $("#auth-submit").textContent = T(mode === "login" ? "login" : "register");
  $("#auth-toggle").textContent = T(mode === "login" ? "toRegister" : "toLogin");
  $("#password").autocomplete =
    mode === "login" ? "current-password" : "new-password";
}
function setLocale(next) {
  locale = next;
  try {
    localStorage.setItem("hc-admin-locale", next);
  } catch {}
  applyI18n(locale);
  renderAuth();
  // Each toggle offers the other language, named in that language.
  document
    .querySelectorAll(".locale-toggle")
    .forEach((b) => (b.textContent = locale === "ko" ? "English" : "한국어"));
  if (current) select(current);
}
document
  .querySelectorAll(".locale-toggle")
  .forEach((b) => (b.onclick = () => setLocale(locale === "ko" ? "en" : "ko")));
$("#auth-toggle").onclick = () => {
  mode = mode === "login" ? "register" : "login";
  renderAuth();
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
    note(T("siteCreated"));
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
      ? T("published")
      : T("draftSaved"),
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
    note(T("knowledgeLimit"));
    return;
  }
  const text = await file.text();
  if (text.length > 40000) {
    note(T("knowledgeLimit"));
    return;
  }
  $("#knowledge").value = text;
  note(T("fileLoaded"));
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
    note(T("pairValid"));
  } catch (e) {
    note(e.message);
  }
};
$("#disconnect").onclick = async () => {
  if (!confirm(T("confirmDisconnect"))) return;
  await api(`/api/sites/${current.id}/disconnect`, {});
  showConnection(null);
  note(T("disconnected"));
};
$("#copy-snippet").onclick = async () => {
  try {
    await navigator.clipboard.writeText($("#snippet").textContent);
    note(T("snippetCopied"));
  } catch {
    note(T("copyBlocked"));
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
    p.textContent = T("noLeads");
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
    active: T("stActive"),
    ended: T("stEnded"),
    expired: T("stExpired"),
    interrupted: T("stInterrupted"),
    disconnected: T("stDisconnected"),
    reconnected: T("stReconnected"),
  };
  for (const s of r.sessions) {
    const tr = document.createElement("tr");
    for (const value of [
      new Date(s.started).toLocaleString(),
      s.engine === "api" ? "API" : T("subscriptionShort"),
      T("seconds", s.used),
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
setLocale(locale);
enter().catch(() => {});
