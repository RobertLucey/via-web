import { createApp } from "vue";
import { createStore } from "vuex";
import { createRouter, createWebHistory } from "vue-router";

import axios from "axios";
import { roadRows, visibleFeatures } from "./lib/roads";

import ViaHomepage from "./views/ViaHomepage.vue";

if (process.env.VUE_APP_LOCAL_WEB_URL) {
  axios.interceptors.request.use((config) => {
    if (config.url) {
      config.url = config.url.replace(
        /^https?:\/\/via-web\.randombits\.host/,
        process.env.VUE_APP_LOCAL_WEB_URL
      );
    }
    return config;
  });
}

function mergeStreetGeoJson(state) {
  if (!state.geojsonResponse) return;
  const features = roadRows(
    state.geojsonResponse.features,
    state.mergeRoadSegments
  ).flatMap((row) =>
    row.features.map((feature) => ({
      ...feature,
      properties: {
        ...feature.properties,
        avg: row.quality,
        count: row.usage,
        speed: row.speed === null ? null : row.speed / 3.6,
      },
    }))
  );
  state.viewGeojson = { type: "FeatureCollection", features };
  state.tableDetails = visibleFeatures(features, state.latLngBounds);
  state.selectedRoad = null;
}

function updateURLHelper(state) {
  const url = new URL(window.location);

  url.searchParams.set("showDetailsTable", state.showDetailsTable);
  url.searchParams.set("selectedMetric", state.selectedMetric);
  url.searchParams.set("transport_type", state.transportType);
  url.searchParams.set("mergeRoadSegments", state.mergeRoadSegments);
  url.searchParams.delete("earliestDate");
  url.searchParams.delete("latestDate");
  url.searchParams.set("lat", state.lat);
  url.searchParams.set("lng", state.lng);
  url.searchParams.set("zoomLevel", state.zoomLevel);

  history.replaceState("", "Via - Road Quality Analysis", url);
}

let latestRoadRequest = 0;

const store = createStore({
  state() {
    return {
      // UI Controllers:
      isLoading: true,
      loadError: null,
      selectedRoad: null,
      showSidebar: null,
      showDetailsTable: null,
      mergeRoadSegments: null,
      selectedMetric: "quality",
      transportType: "bike",

      // Map Details:
      lat: 53.35,
      lng: -6.28,
      zoomLevel: 12,
      latLngBounds: null, // This is the North-West and South-East LatLng.

      // Computed Results:
      geojsonResponse: null, // Used for the map layer.
      viewGeojson: null, // Used for the map layer.
      tableDetails: null, // Filtered version of the response for the table.
    };
  },
  mutations: {
    updateShowSidebar(state, val) {
      // Return true if val is unset or anything not falsey.
      if (val !== undefined && (val == "false" || !val)) {
        state.showSidebar = false;
      } else {
        state.showSidebar = true;
      }
    },
    updateMergeRoadSegments(state, val) {
      if (val == "false" || !val) {
        state.mergeRoadSegments = false;
      } else {
        state.mergeRoadSegments = true;
      }
      updateURLHelper(state);
      // Update map and table together.
      state.geojsonResponse = JSON.parse(JSON.stringify(state.geojsonResponse));
      mergeStreetGeoJson(state);
    },
    updateShowDetailsTable(state, val) {
      if (val == "false" || !val) {
        state.showDetailsTable = false;
      } else {
        state.showDetailsTable = true;
      }
      updateURLHelper(state);
    },
    updateTransportType(state, val) {
      if (!["bike", "car"].includes(val)) return;
      state.transportType = val;
      updateURLHelper(state);
    },
    updateSelectedMetric(state, val) {
      if (!["quality", "usage", "speed"].includes(val)) return;
      state.selectedMetric = val;
      updateURLHelper(state);
    },
    updateMapView(state, { lat, lng, zoom, bounds }) {
      if (Number.isFinite(lat) && Math.abs(lat) <= 90) state.lat = lat;
      if (Number.isFinite(lng) && Math.abs(lng) <= 180) state.lng = lng;
      if (Number.isFinite(zoom))
        state.zoomLevel = Math.max(1, Math.min(20, zoom));
      if (bounds) state.latLngBounds = bounds;
      updateURLHelper(state);
    },
    selectRoad(state, road) {
      state.selectedRoad = road;
    },
    updateGeojson(state, geojsonResponse) {
      state.geojsonResponse = geojsonResponse;
      mergeStreetGeoJson(state);
    },
    updateTableDetails(state, tableDetails) {
      state.tableDetails = tableDetails;
    },
  },
  actions: {
    setTransportType({ commit, state, dispatch }, value) {
      if (!["bike", "car"].includes(value) || value === state.transportType)
        return;
      commit("updateTransportType", value);
      return dispatch("getGeojsonFromAPI");
    },
    async getGeojsonFromAPI({ commit, state, dispatch }) {
      const requestId = ++latestRoadRequest;
      state.selectedRoad = null;
      state.geojsonResponse = null;
      state.viewGeojson = null;
      state.tableDetails = [];
      state.isLoading = true;
      state.loadError = null;
      try {
        const response = await axios.get(
          process.env.VUE_APP_API_URL + "/get_geojson",
          { timeout: 30000, params: { transport_type: state.transportType } }
        );
        if (requestId !== latestRoadRequest) return;
        if (
          response.data?.type !== "FeatureCollection" ||
          !Array.isArray(response.data.features)
        )
          throw new Error("Invalid road data");
        commit("updateGeojson", response.data);
        dispatch("filterTableDetails");
      } catch (error) {
        if (requestId !== latestRoadRequest) return;
        state.loadError =
          "Road data could not be loaded. Check your connection and try again.";
      } finally {
        if (requestId === latestRoadRequest) state.isLoading = false;
      }
    },
    filterTableDetails({ commit, state }) {
      commit(
        "updateTableDetails",
        visibleFeatures(state.viewGeojson?.features || [], state.latLngBounds)
      );
    },
  },
});

const routes = [
  {
    path: "/",
    name: "Home",
    component: ViaHomepage,
    // TODO: This only lets us see the params as route properties, not
    // component props...
    props: true,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes: routes,
});

import App from "./App.vue";

import PrimeVue from "primevue/config";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import InputText from "primevue/inputtext";

import "primevue/resources/themes/saga-blue/theme.css";
import "primevue/resources/primevue.min.css";
import "primeicons/primeicons.css";

const app = createApp(App);

app.use(store);
app.use(router);
app.use(PrimeVue);

app.component("DataTable", DataTable);
app.component("Column", Column);
app.component("InputText", InputText);

app.mount("#app");
