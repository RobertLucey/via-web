export function diagnosticLayers(geojson, visible) {
  const roads = geojson.features.filter((f) => f.properties?.kind === "road");
  const raw = geojson.features.filter(
    (f) => f.properties?.kind === "raw" && f.geometry?.type === "Point"
  );
  const tagged = (feature, displayLayer) => ({
    ...feature,
    properties: { ...feature.properties, displayLayer },
  });
  const features = [];
  // Keep the wider final road beneath the thin raw trace, so both stay visible
  // even where the GPS coordinates and snapped geometry coincide exactly.
  if (visible.snapped)
    features.push(
      ...roads
        .filter((f) => f.properties.status === "accepted")
        .map((f) => tagged(f, "snapped"))
    );
  if (visible.raw) {
    // These are original fixes in recording order, before sampling or filtering.
    if (raw.length > 1)
      features.push({
        type: "Feature",
        properties: {
          displayLayer: "raw",
          description: "Original GPS fixes connected in recording order",
        },
        geometry: {
          type: "LineString",
          coordinates: raw.map((f) => f.geometry.coordinates),
        },
      });
    features.push(...raw.map((f) => tagged(f, "raw")));
  }
  return { type: "FeatureCollection", features };
}

// Plain bounds avoid mixing objects from Leaflet's UMD and ESM modules.
export function diagnosticBounds(geojson) {
  let south = Infinity,
    west = Infinity,
    north = -Infinity,
    east = -Infinity;
  function coordinates(value) {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === "number") {
      const [lng, lat] = value;
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
      south = Math.min(south, lat);
      north = Math.max(north, lat);
      west = Math.min(west, lng);
      east = Math.max(east, lng);
    } else {
      value.forEach(coordinates);
    }
  }
  function geometry(value) {
    if (!value) return;
    if (value.type === "GeometryCollection")
      value.geometries?.forEach(geometry);
    else coordinates(value.coordinates);
  }
  geojson.features.forEach((feature) => geometry(feature.geometry));
  return Number.isFinite(south)
    ? [
        [south, west],
        [north, east],
      ]
    : null;
}
