<template>
  <main class="diagnostics">
    <header class="diagnostic-header">
      <router-link to="/">← Road explorer</router-link>
      <h1>Snapping diagnostics</h1>
      <span>One journey at a time</span>
    </header>
    <div class="diagnostic-workspace">
      <aside class="diagnostic-controls">
        <p>
          Adjust matching thresholds and compare the original GPS trace with the
          final snapped journey.
        </p>
        <p v-if="setupError" role="alert">
          {{ setupError }}
          <button @click="loadDefaults">Retry connection</button>
        </p>
        <form @submit.prevent="run">
          <label for="diagnostic-journey">Journey UUID</label>
          <input
            id="diagnostic-journey"
            v-model.trim="journeyUuid"
            required
            maxlength="200"
            placeholder="Paste a journey UUID"
          />
          <button
            type="button"
            :disabled="loadingJourneys"
            @click="loadJourneys"
          >
            {{ loadingJourneys ? "Loading…" : "Browse journeys" }}
          </button>
          <label v-if="journeys.length" for="diagnostic-journeys"
            >Available journeys</label
          >
          <select
            v-if="journeys.length"
            id="diagnostic-journeys"
            v-model="journeyUuid"
          >
            <option value="" disabled>Select a journey</option>
            <option v-for="uuid in journeys" :key="uuid" :value="uuid">
              {{ uuid }}
            </option>
          </select>
          <p v-if="journeyMessage" role="status">{{ journeyMessage }}</p>
          <fieldset :disabled="!defaults || running">
            <legend>GPS filtering</legend>
            <template v-for="field in gpsFields" :key="field.key">
              <label :for="field.key">{{ field.label }}</label>
              <input
                :id="field.key"
                v-model.number="parameters[field.key]"
                type="number"
                :min="field.min"
                :max="field.max"
                :step="field.step"
                required
                :aria-describedby="`${field.key}-help`"
              />
              <small :id="`${field.key}-help`">{{ field.help }}</small>
            </template>
          </fieldset>
          <fieldset :disabled="!defaults || running">
            <legend>LCSS road matching</legend>
            <p class="field-note">
              Distance values below use the matcher's projected metres (Web
              Mercator), not ground distances.
            </p>
            <template v-for="field in matchingFields" :key="field.key">
              <label :for="field.key">{{ field.label }}</label>
              <input
                :id="field.key"
                v-model.number="parameters[field.key]"
                type="number"
                :min="field.min"
                :max="field.max"
                :step="field.step"
                required
                :aria-describedby="`${field.key}-help`"
              />
              <small :id="`${field.key}-help`">{{ field.help }}</small>
            </template>
          </fieldset>
          <fieldset :disabled="!defaults || running">
            <legend>Accept or reject a snap</legend>
            <label class="check-label"
              ><input
                v-model="parameters.match_road_accuracy_check"
                type="checkbox"
              />
              Require snap within reported GPS accuracy</label
            >
            <small>Missing accuracy uses the GPS accuracy limit above.</small>
            <label for="max-snap">Maximum snap distance (ground metres)</label>
            <input
              id="max-snap"
              v-model="parameters.max_snap_distance_metres"
              type="number"
              min="0.1"
              max="1000"
              step="any"
              placeholder="No additional limit"
            />
            <small
              >Optional extra rejection rule after matching. Leave blank to
              disable.</small
            >
          </fieldset>
          <div class="diagnostic-actions">
            <button class="primary" :disabled="!defaults || running">
              {{ running ? "Matching…" : "Run experiment" }}
            </button>
            <button
              type="button"
              :disabled="!defaults || running"
              @click="parameters = { ...defaults }"
            >
              Reset thresholds
            </button>
          </div>
        </form>
        <p v-if="running" role="status">
          Matching can take up to two minutes while the road network loads.
        </p>
        <p v-if="error" role="alert">{{ error }}</p>
        <p v-if="resultWarning" role="status">{{ resultWarning }}</p>
        <section v-if="result" aria-label="Diagnostic results">
          <h2>Results</h2>
          <p>
            Journey {{ result.journey_uuid }} · {{ result.elapsed_seconds }} s
          </p>
          <p v-if="changed" class="changed">
            Inputs have changed. Run again to update the map.
          </p>
          <div class="diagnostic-actions">
            <button :disabled="running" @click="baseline = result">
              Pin as baseline
            </button>
            <button v-if="baseline" @click="baseline = null">
              Clear baseline
            </button>
            <button @click="download">Download results</button>
          </div>
          <p v-if="baseline">Baseline counts: {{ baseline.journey_uuid }}</p>
          <table>
            <thead>
              <tr>
                <th scope="col">Measure</th>
                <th scope="col">Current</th>
                <th v-if="baseline" scope="col">Baseline</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="stat in stats" :key="stat.key">
                <th scope="row">{{ stat.label }}</th>
                <td>{{ result.summary[stat.key] ?? "—" }}</td>
                <td v-if="baseline">{{ baseline.summary[stat.key] ?? "—" }}</td>
              </tr>
            </tbody>
          </table>
          <details>
            <summary>Parameters used</summary>
            <pre>{{ JSON.stringify(result.parameters, null, 2) }}</pre>
            <template v-if="baseline"
              ><h3>Baseline parameters</h3>
              <pre>{{ JSON.stringify(baseline.parameters, null, 2) }}</pre>
            </template>
          </details>
          <p class="field-note">{{ result.note }}</p>
        </section>
      </aside>
      <section class="diagnostic-map-area" aria-label="Snapping comparison map">
        <l-map
          class="diagnostic-map"
          :center="mapCenter"
          v-model:zoom="mapZoom"
          @update:center="mapCenter = [$event.lat, $event.lng]"
          :use-global-leaflet="false"
          @ready="mapReady"
        >
          <l-tile-layer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <l-geo-json
            v-if="result"
            :key="layerVersion"
            :geojson="visibleGeojson"
            :options="geojsonOptions"
          />
        </l-map>
        <details class="diagnostic-legend" :open="!compactMap">
          <summary>Map layers</summary>
          <label v-for="layer in layerLabels" :key="layer.key"
            ><input v-model="layers[layer.key]" type="checkbox" /><span
              class="swatch"
              :class="layer.key"
              :style="{ color: layer.color }"
            ></span
            >{{ layer.label }}</label
          >
          <small
            ><strong>Final result: solid green roads.</strong> These passed this
            experiment’s matching and rejection checks.</small
          >
          <small
            >Enable Raw journey to compare the original GPS fixes with the final
            result.</small
          >
          <small v-if="layers.raw && layers.snapped"
            >Where the journeys overlap, blue dashes sit over the wider green
            final result.</small
          >
          <small v-if="result && result.summary.accepted === 0"
            >No road matches passed the current checks, so there is no final
            snapped result.</small
          >
          <button v-if="result" @click="fitResult">Fit journey</button>
        </details>
        <p v-if="!result" class="diagnostic-map-hint">
          Choose a journey and run an experiment to see its snapping results.
        </p>
      </section>
    </div>
  </main>
</template>

<script>
import axios from "axios";
import { markRaw } from "vue";
// Use the same Leaflet instance as Vue Leaflet's map and GeoJSON renderer.
import { circleMarker } from "leaflet/dist/leaflet-src.esm";
import { diagnosticBounds, diagnosticLayers } from "../lib/diagnostics";
import { LMap, LTileLayer, LGeoJson } from "@vue-leaflet/vue-leaflet";
import "leaflet/dist/leaflet.css";

const api = process.env.VUE_APP_API_URL;
const gpsFields = [
  {
    key: "max_gps_accuracy_metres",
    label: "Maximum GPS uncertainty (m)",
    min: 0.1,
    max: 500,
    step: "any",
    help: "Discard fixes with worse reported accuracy. Removed intervals split the trace.",
  },
  {
    key: "gps_include_ratio",
    label: "GPS sampling stride",
    min: 1,
    max: 20,
    step: 1,
    help: "1 keeps every fix; 3 samples every third fix.",
  },
];
const matchingFields = [
  {
    key: "distance_epsilon",
    label: "Distance epsilon",
    min: 0.1,
    max: 1000,
    step: "any",
    help: "Distance tolerance used to score candidate road paths.",
  },
  {
    key: "similarity_cutoff",
    label: "Similarity cutoff",
    min: 0.01,
    max: 1,
    step: "any",
    help: "Score at which the matcher stops refining a segment (0–1).",
  },
  {
    key: "cutting_threshold",
    label: "Cutting threshold",
    min: 0.1,
    max: 1000,
    step: "any",
    help: "Threshold used when splitting the trace into matching segments.",
  },
  {
    key: "distance_threshold",
    label: "Maximum matching distance",
    min: 0.1,
    max: 10000,
    step: "any",
    help: "Matches beyond this distance are left unmatched.",
  },
];
const stats = [
  ["raw_fixes", "Raw GPS fixes"],
  ["gps_accuracy_rejected", "Fixes filtered by accuracy"],
  ["processed_points", "Processed GPS points"],
  ["intervals", "Matched intervals assessed"],
  ["accepted", "Accepted"],
  ["unmatched", "Unmatched"],
  ["accuracy_rejected", "Rejected: GPS accuracy"],
  ["distance_rejected", "Rejected: snap limit"],
  ["distinct_accepted_edges", "Accepted road edges"],
  ["mean_snap_distance_metres", "Mean candidate snap (m)"],
  ["max_snap_distance_metres", "Largest candidate snap (m)"],
].map(([key, label]) => ({ key, label }));
const layerLabels = [
  { key: "raw", label: "Raw journey", color: "#38bdf8" },
  { key: "snapped", label: "Snapped journey — final result", color: "#4ade80" },
];
function requestError(error) {
  const detail = error.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((item) => item.msg).join("; ");
  return "Could not complete the request. Check the API connection and try again.";
}
export default {
  components: { LMap, LTileLayer, LGeoJson },
  data: () => ({
    journeyUuid: "",
    journeys: [],
    loadingJourneys: false,
    journeyMessage: "",
    parameters: {},
    defaults: null,
    setupError: "",
    error: "",
    resultWarning: "",
    running: false,
    result: null,
    baseline: null,
    map: null,
    mapCenter: [53.35, -6.28],
    mapZoom: 12,
    observer: null,
    controller: null,
    layerVersion: 0,
    compactMap: false,
    gpsFields,
    matchingFields,
    stats,
    layerLabels,
    layers: {
      raw: false,
      snapped: true,
    },
  }),
  computed: {
    changed() {
      return (
        this.result &&
        (this.journeyUuid !== this.result.journey_uuid ||
          JSON.stringify(this.normalizedParameters()) !==
            JSON.stringify(this.result.parameters))
      );
    },
    visibleGeojson() {
      return diagnosticLayers(this.result.geojson, this.layers);
    },
    geojsonOptions() {
      return {
        style: this.featureStyle,
        pointToLayer: (feature, latlng) =>
          circleMarker(latlng, {
            ...this.featureStyle(feature),
            radius: feature.properties.kind === "raw" ? 3 : 5,
            fillOpacity: 1,
            weight: 1,
          }),
        onEachFeature: (feature, layer) => {
          const popup = document.createElement("pre");
          popup.textContent = Object.entries(feature.properties)
            .map(([key, value]) => `${key}: ${value ?? "unknown"}`)
            .join("\n");
          layer.bindPopup(popup);
        },
      };
    },
  },
  watch: {
    layers: {
      deep: true,
      handler() {
        this.layerVersion++;
      },
    },
    result() {
      this.layerVersion++;
    },
  },
  mounted() {
    this.compactMap = window.matchMedia("(max-width: 750px)").matches;
    this.controller = markRaw(new AbortController());
    this.journeyUuid =
      typeof this.$route.query.journey === "string"
        ? this.$route.query.journey
        : "";
    this.loadDefaults();
  },
  beforeUnmount() {
    this.controller?.abort();
    this.observer?.disconnect();
  },
  methods: {
    async loadDefaults() {
      this.setupError = "";
      try {
        const { data } = await axios.get(`${api}/diagnostics/parameters`, {
          timeout: 15000,
          signal: this.controller.signal,
        });
        if (!data.defaults) throw new Error("Invalid diagnostic configuration");
        this.defaults = data.defaults;
        this.parameters = { ...data.defaults };
      } catch (error) {
        this.setupError =
          error.response?.status === 404
            ? "This API does not have the diagnostics endpoint. Run the updated Via API and point VUE_APP_API_URL to it."
            : requestError(error);
      }
    },
    async loadJourneys() {
      this.loadingJourneys = true;
      this.journeyMessage = "";
      try {
        const { data } = await axios.get(`${api}/get_journey_uuids`, {
          timeout: 15000,
          signal: this.controller.signal,
        });
        if (!Array.isArray(data)) throw new Error("Invalid journey list");
        this.journeys = data.filter((id) => typeof id === "string");
        if (!this.journeys.length)
          this.journeyMessage = "No journeys are available.";
      } catch (error) {
        this.journeyMessage = requestError(error);
      } finally {
        this.loadingJourneys = false;
      }
    },
    normalizedParameters() {
      const parameters = { ...this.parameters };
      parameters.max_snap_distance_metres =
        parameters.max_snap_distance_metres === "" ||
        parameters.max_snap_distance_metres == null
          ? null
          : Number(parameters.max_snap_distance_metres);
      return parameters;
    },
    async run() {
      if (this.running) return;
      this.running = true;
      this.error = "";
      this.resultWarning = "";
      let data;
      try {
        const response = await axios.post(
          `${api}/diagnostics/match`,
          {
            journey_uuid: this.journeyUuid,
            parameters: this.normalizedParameters(),
          },
          { timeout: 130000, signal: this.controller.signal }
        );
        data = response.data;
      } catch (error) {
        this.error = requestError(error);
        this.running = false;
        return;
      }
      try {
        if (
          data?.geojson?.type !== "FeatureCollection" ||
          !Array.isArray(data.geojson.features) ||
          !data.summary ||
          !data.parameters
        ) {
          this.error =
            "The API responded, but the diagnostic result is missing GeoJSON, summary, or parameters. Check that the frontend and API use the same diagnostic version.";
          return;
        }
        this.result = data;
        await this.$nextTick();
        this.fitResult();
        try {
          await this.$router.replace({ query: { journey: data.journey_uuid } });
        } catch {
          this.resultWarning =
            "Results loaded, but the journey link could not be updated.";
        }
      } catch (error) {
        this.resultWarning = `Results received, but the display could not be updated: ${
          error.message || "unknown display error"
        }. You can still download the results.`;
      } finally {
        this.running = false;
      }
    },
    featureStyle(feature) {
      const { displayLayer } = feature.properties;
      const color = {
        raw: "#38bdf8",
        snapped: "#4ade80",
      }[displayLayer];
      return {
        color,
        fillColor: color,
        weight: displayLayer === "snapped" ? 9 : 3,
        opacity: 1,
        dashArray: displayLayer === "snapped" ? null : "5 5",
      };
    },
    mapReady(map) {
      this.map = markRaw(map);
      this.observer = new ResizeObserver(() => map.invalidateSize());
      this.observer.observe(map.getContainer());
      if (this.result) this.fitResult();
    },
    fitResult() {
      if (!this.map || !this.result) return;
      try {
        const bounds = diagnosticBounds(this.result.geojson);
        if (bounds)
          this.map.fitBounds(bounds, {
            padding: [35, 35],
            maxZoom: 17,
            animate: false,
          });
      } catch (error) {
        this.resultWarning = `Results loaded, but the map could not zoom to the journey: ${
          error.message || "unknown map error"
        }. You can still pan the map or download the results.`;
      }
    },
    download() {
      const url = URL.createObjectURL(
        new Blob(
          [
            JSON.stringify(
              { current: this.result, baseline: this.baseline },
              null,
              2
            ),
          ],
          { type: "application/json" }
        )
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "via-snapping-diagnostics.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  },
};
</script>

<style scoped>
.diagnostics {
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  color: #243b45;
  background: #f4f7f7;
}
.diagnostic-header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
  padding: 14px 20px;
  border-bottom: 1px solid #ccd8db;
  background: white;
}
h1 {
  font-size: 21px;
  margin: 0;
}
h2 {
  font-size: 19px;
  margin-top: 20px;
}
h3 {
  font-size: 16px;
}
a {
  color: #155e63;
}
.diagnostic-workspace {
  display: flex;
  flex: 1;
  min-height: 0;
}
.diagnostic-controls {
  width: 370px;
  flex-shrink: 0;
  padding: 18px;
  overflow-y: auto;
  background: white;
}
.diagnostic-controls p {
  font-size: 13px;
}
fieldset {
  border: 1px solid #ccd8db;
  padding: 12px;
  margin: 18px 0;
  border-radius: 8px;
}
legend {
  font-size: 15px;
  font-weight: 600;
  width: auto;
  padding: 0 6px;
}
label {
  display: block;
  margin: 10px 0 4px;
  font-size: 13px;
  font-weight: 600;
}
input:not([type="checkbox"]),
select {
  width: 100%;
  border: 1px solid #a9bec4;
  padding: 8px;
  border-radius: 6px;
  font: inherit;
}
small {
  display: block;
  color: #51666f;
  margin-top: 4px;
  font-size: 12px;
}
.check-label {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
button {
  border: 1px solid #a9bec4;
  border-radius: 6px;
  background: white;
  color: #243b45;
  padding: 8px 12px;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  margin-top: 8px;
}
button:disabled {
  opacity: 0.55;
  cursor: default;
}
.primary {
  background: #155e63;
  color: white;
}
.diagnostic-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
:where(input, select, button, a, summary):focus-visible {
  outline: 3px solid #007e87;
  outline-offset: 2px;
}
[role="alert"] {
  padding: 10px;
  background: #fff0eb;
  border-left: 3px solid #b4422c;
}
.changed {
  color: #805100;
  background: #fff4d7;
  padding: 8px;
}
.field-note {
  color: #51666f;
  font-size: 12px;
}
table {
  width: 100%;
  font-size: 12px;
  margin: 16px 0;
}
th,
td {
  padding: 6px 3px;
  border-bottom: 1px solid #dde5e7;
  text-align: left;
}
pre {
  font-size: 11px;
  overflow: auto;
}
summary {
  cursor: pointer;
  font-size: 13px;
}
.diagnostic-map-area {
  position: relative;
  flex: 1;
  min-width: 0;
}
.diagnostic-map {
  background: #16191d;
}
.diagnostic-map :deep(.leaflet-tile-pane) {
  filter: grayscale(1) invert(1) brightness(0.65) contrast(0.9);
}
.diagnostic-legend {
  position: absolute;
  right: 12px;
  top: 12px;
  z-index: 1000;
  padding: 12px;
  border-radius: 8px;
  background: white;
  max-width: 230px;
  box-shadow: 0 2px 12px #0004;
}
.diagnostic-legend label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 400;
}
.swatch {
  display: inline-block;
  width: 16px;
  flex-shrink: 0;
  border-top: 3px dashed currentColor;
}
.swatch.snapped {
  border-top: 4px solid currentColor;
}
.diagnostic-map-hint {
  position: absolute;
  bottom: 24px;
  left: 12px;
  right: 12px;
  z-index: 1000;
  padding: 12px;
  border-radius: 8px;
  background: white;
  font-size: 13px;
}
@media (max-width: 750px) {
  .diagnostics {
    height: auto;
    min-height: 100dvh;
  }
  .diagnostic-workspace {
    flex-direction: column;
  }
  .diagnostic-controls {
    width: 100%;
    overflow: visible;
  }
  .diagnostic-map-area {
    order: -1;
    flex: none;
    height: 65vh;
    min-height: 420px;
  }
  .diagnostic-header span {
    display: none;
  }
}
</style>
