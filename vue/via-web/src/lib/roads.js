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
    const values = (field) =>
      features
        .map((f) => measurement(f.properties[field], field === "avg"))
        .filter((v) => v !== null);
    const average = (numbers) =>
      numbers.length
        ? numbers.reduce((a, b) => a + b, 0) / numbers.length
        : null;
    const usage = values("count");
    const speed = average(values("speed"));
    return {
      id: index,
      name,
      quality: average(values("avg")),
      usage: usage.length ? Math.max(...usage) : null,
      speed: speed === null ? null : speed * 3.6,
      features,
    };
  });
}

export function visibleFeatures(features, bounds) {
  if (!bounds) return features;
  return features.filter((feature) => {
    const points = feature.geometry.coordinates.flat(
      feature.geometry.type === "MultiLineString" ? 1 : 0
    );
    const lngs = points.map((p) => p[0]);
    const lats = points.map((p) => p[1]);
    return (
      Math.max(...lngs) >= bounds.getWest() &&
      Math.min(...lngs) <= bounds.getEast() &&
      Math.max(...lats) >= bounds.getSouth() &&
      Math.min(...lats) <= bounds.getNorth()
    );
  });
}

export function displayValue(value) {
  return value === null || value === undefined
    ? "No data"
    : Number(value.toFixed(1)).toLocaleString();
}
