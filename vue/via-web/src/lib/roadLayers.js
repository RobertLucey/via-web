// Retain Leaflet geometry across viewport and metric changes. The factory is
// supplied by the map so every layer uses the same Leaflet instance.
export function createRoadRenderer(map, geoJSON, style, bind) {
  const outlineStyle = (feature) => ({
    ...style(feature),
    color: "#101820",
    weight: 9,
    opacity: 1,
  });
  const outlines = geoJSON(null, {
    pane: "roadOutlines",
    interactive: false,
    style: outlineStyle,
  }).addTo(map);
  const roads = geoJSON(null, { style, onEachFeature: bind }).addTo(map);
  const entries = new Map();
  return {
    sync(features) {
      const visible = new Set(features.map((feature) => feature.geometry));
      for (const [geometry, entry] of entries) {
        if (visible.has(geometry)) continue;
        outlines.removeLayer(entry.outline);
        roads.removeLayer(entry.road);
        entries.delete(geometry);
      }
      for (const feature of features) {
        const entry = entries.get(feature.geometry);
        if (entry) {
          if (entry.feature !== feature) {
            const previous = entry.feature.properties;
            entry.road.feature = feature;
            entry.outline.feature = feature;
            entry.feature = feature;
            if (
              ["avg", "count", "speed"].some(
                (field) => previous[field] !== feature.properties[field]
              )
            ) {
              entry.road.setStyle(style(feature));
              entry.outline.setStyle(outlineStyle(feature));
            }
          }
          continue;
        }
        // addData attaches the feature, style, events and canvas renderer.
        // Capture the new layer without scanning the existing group.
        let outline, road;
        const captureOutline = (event) => {
          outline = event.layer;
        };
        const captureRoad = (event) => {
          road = event.layer;
        };
        outlines.once("layeradd", captureOutline);
        roads.once("layeradd", captureRoad);
        outlines.addData(feature);
        roads.addData(feature);
        entries.set(feature.geometry, { feature, outline, road });
      }
    },
    restyle() {
      roads.setStyle(style);
      outlines.setStyle(outlineStyle);
    },
    destroy() {
      outlines.remove();
      roads.remove();
      entries.clear();
    },
  };
}
