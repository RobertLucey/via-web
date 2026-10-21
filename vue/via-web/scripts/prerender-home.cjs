const fs = require("node:fs");
const path = require("node:path");
const intro = require("../src/content/homeIntro.json");

const htmlFile = path.join(__dirname, "../dist/index.html");
const html = fs.readFileSync(htmlFile, "utf8");
const appMarker = '<div id="app"></div>';
if (html.split(appMarker).length !== 2) {
  throw new Error("Expected one empty #app element in the built HTML");
}

const escapeHtml = (value) =>
  value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[character]));

// Vue replaces this shell when it mounts. The initial response still gives
// crawlers and visitors the same introduction shown by the interactive page.
const shell = `<div id="app"><main class="explorer">
  <header class="topbar">
    <a class="brand" href="/">Via <span>Road insights</span></a>
    <nav aria-label="Information"><a href="/diagnostics">Diagnostics</a><a href="https://github.com/RobertLucey/via-web">Contribute</a></nav>
  </header>
  <section class="home-intro" aria-labelledby="home-title">
    <h1 id="home-title">${escapeHtml(intro.heading)}</h1>
    <p>${escapeHtml(intro.description)}</p>
  </section>
  <p class="prerender-loading">Loading interactive road map…</p>
</main></div>`;

fs.writeFileSync(htmlFile, html.replace(appMarker, shell));
