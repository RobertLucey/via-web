import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source = await readFile(
  new URL("./src/lib/roads.js", import.meta.url),
  "utf8"
);
const {
  roadRows,
  roadView,
  searchRoads,
  measurement,
  visibleFeatures,
  displayValue,
} = await import(
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
const outside = feature("Main Road", 100, 10, 100, [
  [5, 5],
  [6, 6],
]);
const viewportFeatures = [...features, outside];
const original = JSON.stringify(viewportFeatures);
const view = roadView(viewportFeatures, bounds, true);
assert.equal(view.features.length, 4, "Only visible segments are rendered");
assert.equal(view.features[0].properties.avg, 20);
assert.equal(view.features[0].properties.speed, 3);
assert.equal(
  view.features[0].properties.count,
  8,
  "Offscreen segments must not contribute to grouped measurements"
);
assert.equal(
  view.features[2].properties.avg,
  null,
  "Unnamed segments remain independent"
);
assert.equal(
  JSON.stringify(viewportFeatures),
  original,
  "Grouping must not change the source data"
);
const movedBounds = {
  getWest: () => 4,
  getEast: () => 7,
  getSouth: () => 4,
  getNorth: () => 7,
};
const movedView = roadView(viewportFeatures, movedBounds, true);
assert.equal(movedView.features.length, 1);
assert.equal(
  movedView.features[0].properties.avg,
  100,
  "Moving the map recalculates groups from raw measurements"
);
const ungroupedView = roadView(viewportFeatures, bounds, false);
assert.equal(
  ungroupedView.features[0],
  features[0],
  "Ungrouped views reuse the original features without copying"
);
assert.equal(ungroupedView.features[0].properties.avg, 10);
assert.equal(
  roadView(viewportFeatures, null, true).features.length,
  0,
  "Do not group the full dataset before map bounds are available"
);
const multi = {
  ...outside,
  geometry: {
    type: "MultiLineString",
    coordinates: [
      [
        [5, 5],
        [6, 6],
      ],
      [
        [-2, 0],
        [2, 0],
      ],
    ],
  },
};
assert.equal(visibleFeatures([multi], bounds).length, 1);
assert.equal(
  visibleFeatures([multi], bounds).length,
  1,
  "Cached bounds must still include crossing multiline roads"
);
const repeatedView = roadView(viewportFeatures, bounds, false);
assert.equal(
  roadView(viewportFeatures, bounds, false),
  repeatedView,
  "Unchanged viewport membership must reuse the map data"
);
assert.equal(
  searchRoads(viewportFeatures, "MAIN")[0].features.length,
  3,
  "Search includes matching offscreen segments"
);
assert.equal(searchRoads(viewportFeatures, " main ")[0].quality, 140 / 3);
assert.equal(searchRoads(viewportFeatures, "unnamed").length, 2);
assert.equal(searchRoads(viewportFeatures, "").length, 0);
assert.equal(searchRoads(viewportFeatures, "road", 1).length, 1);
assert.equal(searchRoads(viewportFeatures, "missing").length, 0);
assert.equal(
  searchRoads(viewportFeatures, "main")[0],
  searchRoads(viewportFeatures, "main")[0],
  "Search reuses summaries for repeated matches"
);
assert.equal(
  searchRoads([outside], "main")[0].quality,
  100,
  "A replacement dataset must have its own search index"
);

// Compare indexed queries with the bounding-box definition, including grid
// boundaries, negative coordinates, long roads, and whole-world views.
const indexedFeatures = Array.from({ length: 1000 }, (_, index) => {
  const x = (index % 50) / 10 - 2.5,
    y = Math.floor(index / 50) / 10 - 1;
  return feature(`Road ${index}`, index, 1, 1, [
    [x, y],
    [x + 0.08, y + 0.12],
  ]);
});
indexedFeatures.push(features[0], multi);
for (const [west, east, south, north] of [
  [-0.1, 0.1, -0.1, 0.1],
  [-2.5, -2.4, -1, -0.9],
  [5, 6, 5, 6],
  [-180, 180, -90, 90],
  [50, 51, 50, 51],
]) {
  const queryBounds = {
    getWest: () => west,
    getEast: () => east,
    getSouth: () => south,
    getNorth: () => north,
  };
  const expected = indexedFeatures.filter((f) => {
    const points =
      f.geometry.type === "MultiLineString"
        ? f.geometry.coordinates.flat()
        : f.geometry.coordinates;
    return (
      Math.max(...points.map((p) => p[0])) >= west &&
      Math.min(...points.map((p) => p[0])) <= east &&
      Math.max(...points.map((p) => p[1])) >= south &&
      Math.min(...points.map((p) => p[1])) <= north
    );
  });
  assert.deepEqual(visibleFeatures(indexedFeatures, queryBounds), expected);
  assert.deepEqual(visibleFeatures(indexedFeatures, queryBounds), expected);
}
const largeGroup = Array.from({ length: 150000 }, () => features[0]);
assert.equal(
  roadRows(largeGroup, true)[0].usage,
  3,
  "Large groups must not overflow the argument stack"
);
console.log(
  "Road grouping, search, spatial index, caching, and measurement checks passed."
);
