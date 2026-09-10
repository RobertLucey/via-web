import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
const boundsSource = await readFile(
  new URL("./src/lib/diagnostics.js", import.meta.url),
  "utf8"
);
const { diagnosticBounds, diagnosticLayers } = await import(
  `data:text/javascript;base64,${Buffer.from(boundsSource).toString("base64")}`
);

const source = await readFile(
  new URL("./src/views/ViaDiagnostics.vue", import.meta.url),
  "utf8"
);
const script = source
  .match(/<script>([\s\S]*?)<\/script>/)[1]
  .replace(/^import[\s\S]*?;\n/gm, "")
  .replace("export default", "globalThis.component =");
const axios = {};
const context = vm.createContext({
  axios,
  diagnosticBounds,
  diagnosticLayers,
  process: { env: { VUE_APP_API_URL: "https://api.example.test" } },
  LMap: {},
  LTileLayer: {},
  LGeoJson: {},
  markRaw: (value) => value,
});
vm.runInContext(script, context);
const component = context.component;
function instance() {
  const state = component.data();
  Object.entries(component.methods).forEach(
    ([key, method]) => (state[key] = method.bind(state))
  );
  state.controller = { signal: undefined };
  state.$router = { replace: async () => {} };
  state.$nextTick = async () => {};
  return state;
}

const state = instance();
axios.get = async () => {
  throw { response: { status: 404 } };
};
await state.loadDefaults();
assert.match(state.setupError, /does not have the diagnostics endpoint/);
assert.equal(state.defaults, null);
const defaults = { distance_epsilon: 50, max_snap_distance_metres: null };
axios.get = async () => ({ data: { defaults } });
await state.loadDefaults();
assert.equal(state.setupError, "");
state.parameters.distance_epsilon = 70;
assert.equal(
  state.defaults.distance_epsilon,
  50,
  "Editing inputs must not modify defaults"
);
state.parameters.max_snap_distance_metres = "";
assert.equal(state.normalizedParameters().max_snap_distance_metres, null);
state.parameters.max_snap_distance_metres = "15";
assert.equal(state.normalizedParameters().max_snap_distance_metres, 15);

state.journeyUuid = "journey-1";
let resolveRun;
let calls = 0;
axios.post = async (url, body) => {
  calls++;
  assert.equal(url, "https://api.example.test/diagnostics/match");
  assert.equal(body.parameters.max_snap_distance_metres, 15);
  return new Promise((resolve) => (resolveRun = resolve));
};
const pending = state.run();
await state.run();
assert.equal(calls, 1, "Prevent overlapping runs");
assert.equal(state.running, true);
const first = {
  journey_uuid: "journey-1",
  parameters: state.normalizedParameters(),
  summary: { accepted: 2 },
  geojson: {
    type: "FeatureCollection",
    features: [
      {
        properties: { kind: "raw" },
        geometry: { type: "Point", coordinates: [-6.2, 53.3] },
      },
      { properties: { kind: "road", status: "accepted" } },
    ],
  },
};
resolveRun({ data: first });
await pending;
assert.equal(state.running, false);
assert.equal(state.result, first);
assert.equal(
  component.computed.visibleGeojson.call(state).features.length,
  1,
  "Only the final snapped result is displayed by default"
);
assert.equal(state.layerLabels.length, 2);
const layerInput = {
  features: [
    {
      properties: { kind: "raw", sample: 0 },
      geometry: { type: "Point", coordinates: [1, 2] },
    },
    {
      properties: { kind: "raw", sample: 2, status: "gps_accuracy_rejected" },
      geometry: { type: "Point", coordinates: [3, 4] },
    },
    { properties: { kind: "trace" } },
    { properties: { kind: "connector" } },
    { properties: { kind: "match" } },
    { properties: { kind: "road", status: "accepted" } },
    { properties: { kind: "road", status: "distance_rejected" } },
  ],
};
const finalOnly = diagnosticLayers(layerInput, { snapped: true }).features;
assert.equal(finalOnly.length, 1);
assert.equal(finalOnly[0].properties.status, "accepted");
assert.equal(finalOnly[0].properties.displayLayer, "snapped");
assert.equal(
  diagnosticLayers(layerInput, { candidates: true }).features.length,
  0
);
const original = diagnosticLayers(layerInput, { raw: true }).features;
assert.deepEqual(
  original[0].geometry.coordinates,
  [
    [1, 2],
    [3, 4],
  ],
  "Raw journey retains fixes rejected by filtering"
);
assert.equal(original.length, 3);
assert.equal(diagnosticLayers(layerInput, {}).features.length, 0);
state.layers.raw = true;
const combined = diagnosticLayers(layerInput, state.layers).features;
const drawOrder = combined.map((feature) => feature.properties.displayLayer);
assert.equal(drawOrder.includes("candidates"), false);
assert.ok(
  drawOrder.indexOf("raw") > drawOrder.lastIndexOf("snapped"),
  "Raw trace must remain visible above coincident snapped geometry"
);
assert.ok(
  state.featureStyle({ properties: { displayLayer: "snapped" } }).weight >
    state.featureStyle({ properties: { displayLayer: "raw" } }).weight,
  "Final road remains visible around the thinner raw trace"
);
assert.deepEqual(Object.keys(state.layers).sort(), ["raw", "snapped"]);
state.layers.raw = false;
assert.equal(
  state.layers.snapped,
  true,
  "Toggling raw must not turn off snapped"
);
state.layers.raw = true;
state.layers.snapped = false;
assert.equal(state.layers.raw, true, "Toggling snapped must not turn off raw");
state.layers.snapped = true;
state.baseline = state.result;
axios.post = async () => {
  throw {
    response: {
      status: 504,
      data: { detail: "Matching exceeded two minutes." },
    },
  };
};
await state.run();
assert.equal(state.running, false);
assert.match(state.error, /two minutes/);
assert.equal(
  state.result,
  first,
  "A failed experiment must preserve the last map"
);
axios.post = async () => ({ data: { ...first, summary: { accepted: 1 } } });
await state.run();
assert.equal(
  state.baseline.summary.accepted,
  2,
  "Later runs must not overwrite the pinned baseline"
);
assert.equal(state.result.summary.accepted, 1);
state.parameters.distance_epsilon = 90;
assert.equal(component.computed.changed.call(state), true);

const geometry = {
  type: "FeatureCollection",
  features: [
    { geometry: { type: "Point", coordinates: [-6.2, 53.3] } },
    {
      geometry: {
        type: "MultiLineString",
        coordinates: [
          [
            [-6.1, 53.4],
            [-6.3, 53.2],
          ],
        ],
      },
    },
    { geometry: null },
  ],
};
assert.deepEqual(diagnosticBounds(geometry), [
  [53.2, -6.3],
  [53.4, -6.1],
]);
assert.equal(diagnosticBounds({ features: [] }), null);
let fitted;
state.map = {
  fitBounds: (bounds) => {
    fitted = bounds;
  },
};
axios.post = async () => ({
  status: 200,
  data: { ...first, geojson: geometry },
});
await state.run();
assert.deepEqual(fitted, [
  [53.2, -6.3],
  [53.4, -6.1],
]);
assert.equal(state.error, "");
assert.equal(state.resultWarning, "");
state.map.fitBounds = () => {
  throw new Error("Map is not ready");
};
await state.run();
assert.equal(
  state.error,
  "",
  "A display error after HTTP 200 must not be reported as an API failure"
);
assert.match(state.resultWarning, /map could not zoom/);
assert.equal(state.result.geojson, geometry);
assert.equal(state.running, false);
state.map = null;
state.$router.replace = async () => {
  throw new Error("History is unavailable");
};
await state.run();
assert.equal(state.error, "");
assert.match(state.resultWarning, /link could not be updated/);
axios.post = async () => ({
  status: 200,
  data: { message: "unexpected response" },
});
await state.run();
assert.match(state.error, /API responded/);
assert.doesNotMatch(state.error, /connection/);
assert.equal(state.running, false);
console.log(
  "Diagnostic API setup, parameters, run lifecycle, layer visibility, and baseline checks passed."
);
