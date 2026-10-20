export function measurement(value, quality = false) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && (!quality || number !== 0) ? number : null;
}

export function roadRows(features = [], merge = false) {
  const groups = new Map();
  features.forEach((feature, index) => {
    const name = feature.properties.name || "Unnamed road";
    const key = merge && feature.properties.name ? name : index;
    if (!groups.has(key)) groups.set(key, { name, features: [] });
    groups.get(key).features.push(feature);
  });
  return [...groups.values()].map(({ name, features }, index) => {
    let qualitySum = 0,
      qualityCount = 0,
      speedSum = 0,
      speedCount = 0;
    let usage = null;
    for (const feature of features) {
      const quality = measurement(feature.properties.avg, true);
      const speed = measurement(feature.properties.speed);
      const count = measurement(feature.properties.count);
      if (quality !== null) {
        qualitySum += quality;
        qualityCount++;
      }
      if (speed !== null) {
        speedSum += speed;
        speedCount++;
      }
      if (count !== null)
        usage = usage === null ? count : Math.max(usage, count);
    }
    return {
      id: index,
      name,
      quality: qualityCount ? qualitySum / qualityCount : null,
      usage,
      speed: speedCount ? (speedSum / speedCount) * 3.6 : null,
      features,
    };
  });
}

export function visibleFeatures(features, bounds) {
  if (!bounds) return features;
  const west = bounds.getWest();
  const east = bounds.getEast();
  const south = bounds.getSouth();
  const north = bounds.getNorth();
  const intersects = (feature) => {
    const box = featureBounds(feature);
    return (
      box.east >= west &&
      box.west <= east &&
      box.north >= south &&
      box.south <= north
    );
  };
  const minX = Math.floor(west / CELL_SIZE),
    maxX = Math.floor(east / CELL_SIZE);
  const minY = Math.floor(south / CELL_SIZE),
    maxY = Math.floor(north / CELL_SIZE);
  // A world-scale view is cheaper to scan than to enumerate empty grid cells.
  if ((maxX - minX + 1) * (maxY - minY + 1) > 4096)
    return features.filter(intersects);
  const { cells, overflow } = spatialIndex(features);
  const candidates = new Set(overflow);
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      const entries = cells.get(`${x}:${y}`);
      if (entries) for (const index of entries) candidates.add(index);
    }
  }
  // Preserve source order for table rows and overlapping road segments.
  return [...candidates]
    .sort((a, b) => a - b)
    .map((index) => features[index])
    .filter(intersects);
}

const CELL_SIZE = 0.05;
const spatialCache = new WeakMap();
function spatialIndex(features) {
  if (spatialCache.has(features)) return spatialCache.get(features);
  const cells = new Map(),
    overflow = [];
  features.forEach((feature, index) => {
    const box = featureBounds(feature);
    const minX = Math.floor(box.west / CELL_SIZE),
      maxX = Math.floor(box.east / CELL_SIZE);
    const minY = Math.floor(box.south / CELL_SIZE),
      maxY = Math.floor(box.north / CELL_SIZE);
    if ((maxX - minX + 1) * (maxY - minY + 1) > 64) {
      overflow.push(index);
      return;
    }
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const key = `${x}:${y}`;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(index);
      }
    }
  });
  const index = { cells, overflow };
  spatialCache.set(features, index);
  return index;
}

// GeoJSON geometry is immutable. Reuse its extent on subsequent map moves.
const boundsCache = new WeakMap();
function featureBounds(feature) {
  if (boundsCache.has(feature)) return boundsCache.get(feature);
  const box = {
    west: Infinity,
    east: -Infinity,
    south: Infinity,
    north: -Infinity,
  };
  const lines =
    feature.geometry.type === "MultiLineString"
      ? feature.geometry.coordinates
      : [feature.geometry.coordinates];
  for (const line of lines) {
    for (const [lng, lat] of line) {
      box.west = Math.min(box.west, lng);
      box.east = Math.max(box.east, lng);
      box.south = Math.min(box.south, lat);
      box.north = Math.max(box.north, lat);
    }
  }
  boundsCache.set(feature, box);
  return box;
}

const viewCache = new WeakMap();
export function roadView(features = [], bounds, merge = false) {
  // Wait for the map's initial bounds rather than grouping the whole dataset.
  const visible = bounds ? visibleFeatures(features, bounds) : [];
  const previous = viewCache.get(features);
  if (
    previous &&
    previous.merge === merge &&
    previous.visible.length === visible.length &&
    visible.every((feature, index) => feature === previous.visible[index])
  )
    return previous.view;
  const grouped = merge
    ? roadRows(visible, true).flatMap((row) =>
        row.features.map((feature) => ({
          ...feature,
          properties: {
            ...feature.properties,
            avg: row.quality,
            count: row.usage,
            speed: row.speed === null ? null : row.speed / 3.6,
          },
        }))
      )
    : visible;
  const view = { type: "FeatureCollection", features: grouped };
  viewCache.set(features, { merge, visible, view });
  return view;
}

const searchCache = new WeakMap();
export function searchRoads(features, query, limit = 8) {
  const term = query.trim().toLowerCase();
  if (!term || limit <= 0) return [];
  if (!searchCache.has(features)) {
    const groups = new Map();
    features.forEach((feature, index) => {
      const name = feature.properties.name || "Unnamed road";
      const key = feature.properties.name || index;
      if (!groups.has(key))
        groups.set(key, {
          name,
          term: name.toLowerCase(),
          features: [],
          id: index,
        });
      groups.get(key).features.push(feature);
    });
    searchCache.set(features, [...groups.values()]);
  }
  const results = [];
  for (const group of searchCache.get(features)) {
    if (!group.term.includes(term)) continue;
    if (!group.row)
      group.row = { ...roadRows(group.features, true)[0], id: group.id };
    results.push(group.row);
    if (results.length === limit) break;
  }
  return results;
}

const numberFormatter = new Intl.NumberFormat();
export function displayValue(value) {
  return value === null || value === undefined
    ? "No data"
    : numberFormatter.format(Number(value.toFixed(1)));
}
