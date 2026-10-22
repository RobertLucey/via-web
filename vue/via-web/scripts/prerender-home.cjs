const fs = require("node:fs");
const path = require("node:path");
const intro = require("../src/content/homeIntro.json");
const diagnosticsIntro = require("../src/content/diagnosticsIntro.json");

const distDir = path.join(__dirname, "../dist");
const htmlFile = path.join(distDir, "index.html");
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

const titleTag = /<title>[^<]*<\/title>/;
const descriptionTag = /<meta\s+name="description"\s+content="[^"]*"\s*\/?\s*>/;
if (!titleTag.test(html) || !descriptionTag.test(html)) {
  throw new Error("Expected title and description in the built HTML");
}

const diagnosticsShell = `<div id="app"><main class="diagnostics">
  <header class="diagnostic-header">
    <a href="/">← Road explorer</a>
    <h1>${escapeHtml(diagnosticsIntro.heading)}</h1>
    <span>One journey at a time</span>
  </header>
  <div class="diagnostic-workspace"><aside class="diagnostic-controls">
    <p>${escapeHtml(diagnosticsIntro.description)}</p>
    <p class="prerender-loading">Loading snapping diagnostics…</p>
  </aside></div>
</main></div>`;

const diagnosticsHtml = html
  .replace(titleTag, `<title>${escapeHtml(diagnosticsIntro.title)}</title>`)
  .replace(
    descriptionTag,
    `<meta name="description" content="${escapeHtml(
      diagnosticsIntro.description
    )}">`
  )
  .replace(appMarker, diagnosticsShell);

const diagnosticsDir = path.join(distDir, "diagnostics");
fs.mkdirSync(diagnosticsDir, { recursive: true });
fs.writeFileSync(path.join(diagnosticsDir, "index.html"), diagnosticsHtml);
