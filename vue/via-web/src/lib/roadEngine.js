import { visibleFeatures, roadRows, searchRoads } from "./roads";

// Keep the full dataset and its indexes in the worker. Replies reference source
// indices so map movements never copy road geometry across threads.
export function createRoadEngine() {
  let data = null;
  let identifiers = new WeakMap();
  let previousView = null;
  const encode = (row) => ({
    ...row,
    features: row.features.map((feature) => identifiers.get(feature)),
  });
  return {
    load(input) {
      const next = typeof input === "string" ? JSON.parse(input) : input;
      if (next?.type !== "FeatureCollection" || !Array.isArray(next.features))
        throw new Error("Invalid road data");
      data = next;
      identifiers = new WeakMap();
      data.features.forEach((feature, index) =>
        identifiers.set(feature, index)
      );
      previousView = null;
      return data;
    },
    view({ bounds, merge, table }) {
      if (!data || !bounds) return { indices: [], rows: [], merge };
      const leafletBounds = {
        getWest: () => bounds.west,
        getEast: () => bounds.east,
        getSouth: () => bounds.south,
        getNorth: () => bounds.north,
      };
      const visible = visibleFeatures(data.features, leafletBounds);
      const indices = visible.map((feature) => identifiers.get(feature));
      if (
        previousView &&
        previousView.merge === merge &&
        previousView.table === table &&
        previousView.indices.length === indices.length &&
        indices.every(
          (index, position) => previousView.indices[position] === index
        )
      )
        return previousView.result;
      const result = {
        indices,
        merge,
        rows: merge || table ? roadRows(visible, merge).map(encode) : [],
      };
      previousView = { indices, merge, table, result };
      return result;
    },
    search(query) {
      return data ? searchRoads(data.features, query).map(encode) : [];
    },
  };
}
