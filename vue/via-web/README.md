# via-web

## Project setup

```
npm install
```

### Compiles and hot-reloads for development

```
npm run serve
```

### Compiles and minifies for production

```
npm run build
```

The build also writes the homepage introduction into `dist/index.html` so its
heading and explanation are present in the initial response. Vue replaces this
static shell when the interactive map starts. The text is shared with the Vue
homepage through `src/content/homeIntro.json`.

### Lints and fixes files

```
npm run lint
```

### Runs regression checks

```
npm test
```

### Road data and browser caching

Road JSON parsing, spatial indexing, grouping, table summaries, and search run
in a Web Worker. Viewport replies contain source indices and summaries rather
than copying geometry on each pan. Browsers that cannot start a worker use the
same processing functions on the main thread.

Successful downloads are cached in IndexedDB, separately for each API address
and transport type. Snapshots up to five minutes old can be reused without a
download. Older snapshots are shown while checking for updates, with a notice
if the API is unavailable or still preparing data. Snapshots older than 24 hours
are not displayed. **Refresh measurements** always checks the API. If browser
storage is unavailable or full, caching falls back to memory for the current page.

### Customize configuration

See [Configuration Reference](https://cli.vuejs.org/config/).
