(() => {
  const script = document.currentScript,
    site = script?.dataset.siteId;
  if (!site || !/^site_[\w-]+$/.test(site)) return;
  const service = new URL(script.src).origin;
  // Classic script on third-party pages: a tiny inline catalog instead of importing i18n.js.
  const pageLanguage = document.documentElement.lang || navigator.language || "";
  const ko = /^ko(?:-|$)/i.test(pageLanguage);
  const text = ko
    ? { button: "AI 상담", open: "AI 상담 창 열기", frame: "AI 상담" }
    : { button: "AI chat", open: "Open AI consultation", frame: "AI consultation" };
  if (document.querySelector(`[data-hermes-consult="${site}"]`)) return;
  const host = document.createElement("div");
  host.dataset.hermesConsult = site;
  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = `:host{all:initial;position:fixed;right:24px;bottom:24px;z-index:2147483000;font-family:system-ui,sans-serif}button{border:0;border-radius:28px;background:#2458cd;color:white;padding:16px 23px;font:600 14px system-ui;box-shadow:0 8px 25px #15346630;cursor:pointer}button:focus-visible{outline:3px solid #8eaff7;outline-offset:3px}iframe{display:block;position:absolute;bottom:70px;right:0;width:380px;height:570px;max-height:calc(100dvh - 115px);max-width:calc(100vw - 32px);border:1px solid #dce3ed;border-radius:18px;box-shadow:0 20px 70px #18395430;background:white}iframe[hidden]{display:none}@media(max-width:450px){:host{right:16px;bottom:16px}iframe{width:calc(100vw - 32px)}}`;
  const button = document.createElement("button");
  button.textContent = text.button;
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-label", text.open);
  let frame,
    token = null,
    pending = false;
  function end() {
    if (token) {
      fetch(service + "/public/session/end", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        body: "{}",
        keepalive: true,
      }).catch(() => {});
      token = null;
    }
  }
  button.onclick = () => {
    if (!frame) {
      frame = document.createElement("iframe");
      frame.src =
        service +
        "/frame/" +
        encodeURIComponent(site) +
        "?parent=" +
        encodeURIComponent(location.origin) +
        "&lang=" +
        encodeURIComponent(pageLanguage);
      frame.title = text.frame;
      frame.allow = "microphone";
      frame.setAttribute(
        "sandbox",
        "allow-scripts allow-same-origin allow-forms",
      );
      shadow.append(frame);
    } else if (!frame.hidden) {
      frame.contentWindow.postMessage({ type: "hc:close" }, service);
      end();
      frame.hidden = true;
      button.setAttribute("aria-expanded", "false");
      return;
    }
    frame.hidden = false;
    button.setAttribute("aria-expanded", "true");
  };
  let generation = 0;
  window.addEventListener("message", async (event) => {
    if (
      !frame ||
      event.source !== frame.contentWindow ||
      event.origin !== service
    )
      return;
    const data = event.data;
    // Errors carry a catalog code; the frame shows them in its own language.
    const reply = (result, message, code) =>
      frame.contentWindow.postMessage(
        {
          type: message || code ? "hc:error" : "hc:response",
          requestId: data.requestId,
          result,
          message,
          code,
        },
        service,
      );
    if (data?.type === "hc:request-session") {
      if (pending) {
        reply(null, "", "previousCleanup");
        return;
      }
      pending = true;
      const turn = generation;
      try {
        end();
        const r = await fetch(service + "/public/sites/" + site + "/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ challengeToken: data.challengeToken, pageLanguage, visitorId: (() => {
            try { const key = "hc-visitor-" + site; let id = localStorage.getItem(key);
              if (!id) { id = crypto.randomUUID(); localStorage.setItem(key, id); } return id;
            } catch { return "anonymous"; }
          })() }),
        });
        const result = await r.json();
        if (!r.ok) throw Object.assign(Error(result.error), { code: result.code });
        if (frame.hidden || turn !== generation) {
          fetch(service + "/public/session/end", {
            method: "POST",
            headers: { Authorization: "Bearer " + result.token },
            keepalive: true,
          }).catch(() => {});
          reply(null, "", "cancelled");
          return;
        }
        token = result.token;
        reply(result);
      } catch (e) {
        reply(null, e.message || "error", e.code);
      } finally {
        pending = false;
      }
    }
    if (data?.type === "hc:lead-request") {
      try {
        const r = await fetch(service + "/public/sites/" + site + "/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data.lead),
        });
        const result = await r.json();
        if (!r.ok) throw Object.assign(Error(result.error), { code: result.code });
        reply(result);
      } catch (e) {
        reply(null, e.message || "error", e.code);
      }
    }
    if (data?.type === "hc:end") {
      generation++;
      end();
    }
    if (data?.type === "hc:hide") {
      generation++;
      end();
      frame.hidden = true;
      button.setAttribute("aria-expanded", "false");
      button.focus();
    }
  });
  window.addEventListener("pagehide", end);
  shadow.append(style, button);
  document.body.append(host);
})();
