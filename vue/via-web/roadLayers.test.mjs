import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source = await readFile(
  new URL("./src/lib/roadLayers.js", import.meta.url),
  "utf8"
);
const { createRoadRenderer } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
);
const groups = [];
let created = 0;
function geoJSON(data, options) {
  const layers = new Set();
  let onAdd;
  const group = {
    options,
    layers,
    addTo() {
      return this;
    },
    once(event, handler) {
      onAdd = handler;
    },
    addData(feature) {
      const layer = {
        feature,
        styles: [],
        setStyle(style) {
          this.styles.push(style);
        },
      };
      created++;
      layers.add(layer);
      options.onEachFeature?.(feature, layer);
      onAdd({ layer });
    },
    removeLayer(layer) {
      layers.delete(layer);
    },
    setStyle(style) {
      for (const layer of layers) layer.setStyle(style(layer.feature));
    },
    remove() {
      layers.clear();
    },
  };
  groups.push(group);
  return group;
}
const style = (feature) => ({ color: feature.properties.avg });
const bind = (feature, layer) => {
  layer.click = () => layer.feature.properties.avg;
};
const renderer = createRoadRenderer({}, geoJSON, style, bind);
const a = { geometry: {}, properties: { avg: 10 } };
const b = { geometry: {}, properties: { avg: 20 } };
renderer.sync([a, b]);
assert.equal(created, 4);
const roadA = [...groups[1].layers][0];
renderer.sync([a, b]);
assert.equal(created, 4, "Unchanged roads must retain both Leaflet layers");
const updated = { ...a, properties: { avg: 30 } };
renderer.sync([updated]);
assert.equal(created, 4, "Grouped measurement changes must reuse geometry");
assert.equal(groups[0].layers.size, 1);
assert.equal(groups[1].layers.size, 1);
assert.equal(
  roadA.click(),
  30,
  "Retained click handlers must use current values"
);
assert.deepEqual(roadA.styles, [{ color: 30 }]);
renderer.restyle();
assert.equal(created, 4, "Metric changes must only restyle roads");
renderer.sync([updated, b]);
assert.equal(created, 6, "Only newly visible roads should create layers");
renderer.sync([]);
assert.equal(groups[0].layers.size, 0);
assert.equal(groups[1].layers.size, 0);
renderer.destroy();
console.log(
  "Road layer reuse, selection values, restyling and removal checks passed."
);
