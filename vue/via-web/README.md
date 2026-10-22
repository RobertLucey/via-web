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

The build writes static introductions into `dist/index.html` and
`dist/diagnostics/index.html` so both routes have headings and descriptions in
their initial responses. Vue replaces these shells when the interactive views
start. The text is shared with the views through `src/content`.

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
