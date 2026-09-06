import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source = await readFile(
  new URL("./src/lib/roads.js", import.meta.url),
  "utf8"
);
const { roadRows, measurement, visibleFeatures, displayValue } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
);
const feature = (
  name,
  avg,
  speed,
  count,
  coordinates = [
    [-2, 0],
    [2, 0],
  ]
) => ({
  type: "Feature",
  properties: { name, avg, speed, count },
  geometry: { type: "LineString", coordinates },
});
const features = [
  feature("Main Road", 10, 2, 3),
  feature("Main Road", 30, 4, 8),
  feature("", 0, null, null),
  feature("", null, null, null),
];
assert.equal(roadRows(features, false).length, 4);
const grouped = roadRows(features, true);
assert.equal(grouped.length, 3, "Unnamed segments must remain separate");
assert.equal(grouped[0].quality, 20);
assert.equal(grouped[0].speed, 10.8);
assert.equal(grouped[0].usage, 8);
assert.equal(grouped[1].quality, null);
assert.equal(grouped[1].speed, null);
assert.equal(measurement(null), null);
assert.equal(measurement(""), null);
assert.equal(measurement("bad"), null);
assert.equal(measurement(0), 0);
assert.equal(displayValue(null), "No data");
assert.equal(
  typeof grouped[0].speed,
  "number",
  "Sorting values must stay numeric"
);
const bounds = {
  getWest: () => -1,
  getEast: () => 1,
  getSouth: () => -1,
  getNorth: () => 1,
};
assert.equal(
  visibleFeatures([features[0]], bounds).length,
  1,
  "Include roads crossing the viewport with endpoints outside"
);
assert.equal(
  visibleFeatures(
    [
      feature("Outside", 1, 1, 1, [
        [5, 5],
        [6, 6],
      ]),
    ],
    bounds
  ).length,
  0
);
console.log(
  "Road grouping, missing values, numeric values, and viewport checks passed."
);
