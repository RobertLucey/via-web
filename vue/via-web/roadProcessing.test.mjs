import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const moduleURL = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const read = (name) =>
  readFile(new URL(`./src/lib/${name}.js`, import.meta.url), "utf8");
const roadsURL = moduleURL(await read("roads"));
const engineURL = moduleURL(
  (await read("roadEngine")).replace('"./roads"', JSON.stringify(roadsURL))
);
const { createRoadEngine } = await import(engineURL);
const processorSource = (await read("roadProcessor"))
  .replace(
    'import RoadWorker from "../workers/roads.worker";',
    'const RoadWorker = class { constructor() { throw new Error("Worker blocked"); } };'
  )
  .replace('"./roadEngine"', JSON.stringify(engineURL));
const { createRoadProcessor } = await import(moduleURL(processorSource));
const { createRoadCache, FRESH_AGE, MAX_AGE } = await import(
  moduleURL(await read("roadCache"))
);
const feature = (name, avg, x = 0) => ({
  type: "Feature",
  properties: { name, avg, count: avg, speed: avg / 10 },
  geometry: {
    type: "LineString",
    coordinates: [
      [x, 0],
      [x + 0.01, 0.01],
    ],
  },
});
const data = {
  type: "FeatureCollection",
  features: [
    feature("Main", 10),
    feature("Main", 30),
    feature("Main", 100, 10),
    feature("", 0),
  ],
};
const bounds = { west: -0.1, east: 0.1, south: -0.1, north: 0.1 };
const engine = createRoadEngine();
engine.load(JSON.stringify(data));
const view = engine.view({ bounds, merge: true, table: true });
assert.deepEqual(view.indices, [0, 1, 3]);
assert.deepEqual(view.rows[0].features, [0, 1]);
assert.equal(view.rows[0].quality, 20);
assert.equal(view.rows[0].usage, 30);
assert.equal(view.rows[0].speed, 7.2);
assert.equal(view.rows[1].quality, null);
assert.equal(
  engine.view({ bounds, merge: true, table: true }),
  view,
  "Repeated worker queries reuse summaries and still return complete results for racing requests"
);
assert.equal(
  engine.search("main")[0].features.length,
  3,
  "Global search includes offscreen roads"
);
assert.equal(
  engine.view({ bounds, merge: false, table: false }).rows.length,
  0,
  "Hidden ungrouped tables should not calculate summaries"
);
assert.equal(engine.view({ bounds, merge: false, table: true }).rows.length, 3);
assert.throws(() => engine.load("{}"), /Invalid road data/);
engine.load({ type: "FeatureCollection", features: [feature("New", 5)] });
assert.equal(
  engine.search("main").length,
  0,
  "Replacing a dataset drops previous indexes"
);

const processor = createRoadProcessor(() => {
  throw new Error("Workers disabled");
});
const loaded = await processor.load(JSON.stringify(data));
assert.equal(loaded.data.features.length, 4);
assert.deepEqual(
  (await processor.view({ bounds, merge: true, table: true }, loaded.version))
    .rows[0].features,
  [0, 1]
);
const replacement = await processor.load(
  JSON.stringify({ type: "FeatureCollection", features: [feature("New", 5)] })
);
assert.equal(
  await processor.search("main", loaded.version),
  null,
  "Discard obsolete dataset requests"
);
assert.equal(
  (await processor.search("new", replacement.version))[0].quality,
  5
);
await assert.rejects(processor.load("not json"));
assert.equal(
  (await processor.search("new", replacement.version))[0].quality,
  5,
  "Malformed refreshes must not disable the previously loaded dataset"
);

let worker;
const normal = createRoadProcessor(
  () =>
    (worker = {
      postMessage(message) {
        this.sent.push(message);
      },
      sent: [],
      terminate() {},
    })
);
const loadRequest = normal.load(JSON.stringify(data));
worker.onmessage({ data: { id: worker.sent[0].id, result: data } });
const workerData = await loadRequest;
const queryA = normal.search("main", workerData.version);
const queryB = normal.search("new", workerData.version);
worker.onmessage({
  data: { id: worker.sent[2].id, result: [{ name: "new" }] },
});
worker.onmessage({
  data: { id: worker.sent[1].id, result: [{ name: "main" }] },
});
assert.equal((await queryA)[0].name, "main");
assert.equal(
  (await queryB)[0].name,
  "new",
  "Out-of-order replies go to their own request"
);
const crashQuery = normal.search("main", workerData.version);
worker.onerror();
assert.equal(
  (await crashQuery)[0].name,
  "Main",
  "Worker failures fall back without losing loaded data"
);

let clock = 100000;
const cache = createRoadCache(null, () => clock);
await cache.write("api-A:bike", JSON.stringify(data));
assert.equal((await cache.read("api-A:bike")).fresh, true);
assert.equal(await cache.read("api-A:car"), null);
assert.equal(await cache.read("api-B:bike"), null);
clock += FRESH_AGE + 1;
assert.equal((await cache.read("api-A:bike")).fresh, false);
clock += MAX_AGE;
assert.equal(
  await cache.read("api-A:bike"),
  null,
  "Expired snapshots must not be displayed"
);
await cache.write("api-A:bike", "text");
await cache.remove("api-A:bike");
assert.equal(await cache.read("api-A:bike"), null);
const unavailable = createRoadCache({
  open() {
    throw new Error("Storage denied");
  },
});
await unavailable.write("bike", "data");
assert.equal(
  (await unavailable.read("bike")).text,
  "data",
  "Storage denial must not break the page"
);
console.log(
  "Worker summaries, source indices, reply routing, fallback, cache expiry and isolation checks passed."
);
