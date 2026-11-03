const site = new URLSearchParams(location.search).get("site");
if (site) {
  const script = document.createElement("script");
  script.src = "/widget.js";
  script.dataset.siteId = site;
  document.body.append(script);
}
