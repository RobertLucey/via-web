<template>
  <l-map
    class="road-map"
    :zoom="zoomLevel"
    :center="[lat, lng]"
    @ready="mapReady"
    @moveend="updateView"
    @zoomend="updateView"
  >
    <l-tile-layer
      url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      attribution='Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    />
    <l-geo-json
      v-if="map && viewGeojson"
      :key="`outline-${layerKey}`"
      pane="roadOutlines"
      :geojson="viewGeojson"
      :options="outlineOptions"
    />
    <l-geo-json
      v-if="viewGeojson"
      :key="layerKey"
      :geojson="viewGeojson"
      :options="options"
    />
    <l-geo-json
      v-if="map && selectedRoad"
      pane="roadSelection"
      :geojson="selection"
      :options="highlightOptions"
    />
  </l-map>
</template>
<script>
import "leaflet/dist/leaflet.css";
import { markRaw } from "vue";
import { LMap, LTileLayer, LGeoJson } from "@vue-leaflet/vue-leaflet";
import { mapState } from "vuex";
import { measurement, roadRows } from "../lib/roads";
export default {
  components: { LMap, LTileLayer, LGeoJson },
  data: () => ({
    map: null,
    layerKey: 0,
    resizeObserver: null,
    highlightOptions: {
      style: { color: "#ffffff", weight: 13, opacity: 1 },
      interactive: false,
    },
  }),
  computed: {
    ...mapState([
      "lat",
      "lng",
      "zoomLevel",
      "viewGeojson",
      "selectedMetric",
      "transportType",
      "selectedRoad",
      "mergeRoadSegments",
    ]),
    selection() {
      return {
        type: "FeatureCollection",
        features: this.selectedRoad.features,
      };
    },
    options() {
      return { style: this.styleRoad, onEachFeature: this.bindRoad };
    },
    outlineOptions() {
      return {
        interactive: false,
        style: (feature) => ({
          ...this.styleRoad(feature),
          color: "#101820",
          weight: 9,
          opacity: 1,
        }),
      };
    },
  },
  watch: {
    selectedMetric() {
      this.layerKey++;
    },
    transportType() {
      this.layerKey++;
    },
    viewGeojson() {
      this.layerKey++;
    },
  },
  beforeUnmount() {
    this.resizeObserver?.disconnect();
  },
  methods: {
    mapReady(map) {
      // Keep outlines below every coloured segment, including after updates.
      const outlinePane = map.createPane("roadOutlines");
      outlinePane.style.zIndex = 399;
      outlinePane.style.pointerEvents = "none";
      const selectionPane = map.createPane("roadSelection");
      selectionPane.style.zIndex = 398;
      selectionPane.style.pointerEvents = "none";
      this.map = markRaw(map);
      this.resizeObserver = new ResizeObserver(() => map.invalidateSize());
      this.resizeObserver.observe(map.getContainer());
      this.updateView();
    },
    updateView() {
      if (!this.map) return;
      const center = this.map.getCenter();
      this.$store.commit("updateMapView", {
        lat: center.lat,
        lng: center.lng,
        zoom: this.map.getZoom(),
        bounds: this.map.getBounds(),
      });
      this.$store.dispatch("filterTableDetails");
    },
    styleRoad(feature) {
      const field = { quality: "avg", usage: "count", speed: "speed" }[
        this.selectedMetric
      ];
      const value = measurement(feature.properties[field], field === "avg");
      const isVehicle = this.transportType === "car";
      const max = {
        quality: isVehicle ? 30 : 50,
        usage: 10,
        // GeoJSON speed measurements are in metres per second.
        speed: isVehicle ? 100 / 3.6 : 10,
      }[this.selectedMetric];
      const ratio = value === null ? 0 : Math.max(0, Math.min(1, value / max));
      const colors = ["#d73027", "#fc8d59", "#fee08b", "#91cf60", "#1a9850"];
      if (this.selectedMetric === "quality") colors.reverse();
      return {
        color: value === null ? "#87939c" : colors[Math.round(ratio * 4)],
        weight: 6,
        opacity: 1,
        dashArray: value === null ? "4 6" : null,
      };
    },
    bindRoad(feature, layer) {
      const label = document.createElement("span");
      label.textContent = feature.properties.name || "Unnamed road";
      layer.bindTooltip(label);
      layer.on("click", () => {
        const features =
          this.mergeRoadSegments && feature.properties.name
            ? this.viewGeojson.features.filter(
                (f) => f.properties.name === feature.properties.name
              )
            : [feature];
        this.$store.commit(
          "selectRoad",
          roadRows(features, this.mergeRoadSegments)[0]
        );
      });
    },
    async highlightSegment(road) {
      this.$store.commit("selectRoad", road);
      const points = road.features
        .flatMap((f) =>
          f.geometry.coordinates.flat(
            f.geometry.type === "MultiLineString" ? 1 : 0
          )
        )
        .map((p) => [p[1], p[0]]);
      await this.$nextTick();
      if (points.length && this.map) {
        const container = this.map.getContainer();
        const details = container.parentElement.querySelector(".road-details");
        const mobile = window.matchMedia("(max-width: 700px)").matches;
        const bottom =
          mobile && details
            ? Math.min(details.offsetHeight + 16, container.clientHeight * 0.7)
            : 40;
        this.map.fitBounds(points, {
          paddingTopLeft: [30, 30],
          paddingBottomRight: [mobile ? 30 : 360, bottom],
          maxZoom: 17,
        });
      }
    },
  },
};
</script>

<style scoped>
.road-map {
  background: #16191d;
}

/* Darken only the basemap: measurement colours and controls stay unchanged. */
.road-map :deep(.leaflet-tile-pane) {
  filter: grayscale(1) invert(1) brightness(0.65) contrast(0.9);
}
</style>
