import { applyI18n, pickLocale } from "./i18n.js";
const params = new URLSearchParams(location.search);
// ?lang=ko|en previews the widget as a page in that language; the widget reads <html lang>.
let saved = null;
try {
  saved = localStorage.getItem("hc-admin-locale");
} catch {}
applyI18n(pickLocale(params.get("lang") || saved || navigator.language));
const site = params.get("site");
if (site) {
  const script = document.createElement("script");
  script.src = "/widget.js";
  script.dataset.siteId = site;
  document.body.append(script);
}
