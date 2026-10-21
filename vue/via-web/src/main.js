import { createApp, markRaw } from "vue";
import { createStore } from "vuex";
import { createRouter, createWebHistory } from "vue-router";

import axios from "axios";
import { roadProcessor } from "./lib/roadProcessor";
import { roadCache } from "./lib/roadCache";

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

const hydrateRows = (rows, features) =>
  rows.map((row) => ({
    ...row,
    features: row.features.map((index) => features[index]),
  }));
let lastView = null;
let latestViewRequest = 0;
let latestSearchRequest = 0;

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
let cancelRoadRequest = null;

const store = createStore({
  state() {
    return {
      // UI Controllers:
      isLoading: true,
      isPreparing: false,
      loadError: null,
      dataNotice: null,
      roadTableRows: [],
      roadSearchResults: [],
      roadSearchQuery: "",
      roadDataVersion: 0,
      selectedRoad: null,
      showSidebar: null,
      showDetailsTable: null,
      mergeRoadSegments: null,
      selectedMetric: "quality",
      transportType: "bike",

      // Map Details:
      lat: 53.35,
      lng: -6.28,
      zoomLevel: 14,
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
      state.selectedRoad = null;
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
      state.selectedRoad = road ? markRaw(road) : null;
    },
    updateGeojson(state, { data, version }) {
      // Road data is immutable; avoid reactive proxies for every coordinate.
      state.geojsonResponse = markRaw(data);
      state.roadDataVersion = version;
    },
    updateRoadView(state, result) {
      const source = state.geojsonResponse.features;
      const rows = hydrateRows(result.rows, source);
      const same =
        lastView &&
        lastView.source === source &&
        lastView.merge === result.merge &&
        lastView.indices.length === result.indices.length &&
        result.indices.every(
          (index, position) => lastView.indices[position] === index
        );
      if (!same) {
        const features = result.merge
          ? rows.flatMap((row) =>
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
          : result.indices.map((index) => source[index]);
        state.viewGeojson = markRaw({ type: "FeatureCollection", features });
        state.tableDetails = markRaw(features);
        lastView = { source, merge: result.merge, indices: result.indices };
      }
      state.roadTableRows = markRaw(rows);
    },
  },
  actions: {
    setTransportType({ commit, state, dispatch }, value) {
      if (!["bike", "car"].includes(value) || value === state.transportType)
        return;
      commit("updateTransportType", value);
      return dispatch("getGeojsonFromAPI");
    },
    async getGeojsonFromAPI(
      { commit, state, dispatch },
      { force = false } = {}
    ) {
      const requestId = ++latestRoadRequest;
      if (cancelRoadRequest) cancelRoadRequest();
      const cancellation = axios.CancelToken.source();
      cancelRoadRequest = cancellation.cancel;
      state.selectedRoad = null;
      state.geojsonResponse = null;
      state.viewGeojson = null;
      state.tableDetails = [];
      state.roadTableRows = [];
      state.roadSearchResults = [];
      state.isLoading = true;
      state.isPreparing = false;
      state.loadError = null;
      state.dataNotice = null;
      const endpoint = process.env.VUE_APP_API_URL + "/get_geojson";
      const transport = state.transportType;
      const cacheKey = `${endpoint}:${
        process.env.VUE_APP_LOCAL_WEB_URL || ""
      }:${transport}`;
      let hasSavedData = false;
      async function display(input) {
        const result = await roadProcessor.load(input);
        if (requestId !== latestRoadRequest || !result.data) return false;
        commit("updateGeojson", result);
        await dispatch("filterTableDetails");
        if (requestId !== latestRoadRequest) return false;
        await dispatch("searchRoads", state.roadSearchQuery);
        if (requestId !== latestRoadRequest) return false;
        state.isLoading = false;
        return true;
      }
      try {
        const cached = await roadCache.read(cacheKey);
        if (requestId !== latestRoadRequest) return;
        if (cached) {
          try {
            hasSavedData = await display(cached.text);
          } catch (error) {
            await roadCache.remove(cacheKey);
          }
          if (requestId !== latestRoadRequest) return;
          if (hasSavedData && cached.fresh && !force) return;
          if (hasSavedData)
            state.dataNotice =
              "Showing saved measurements while checking for updates.";
        }
        const response = await axios.get(endpoint, {
          timeout: 30000,
          params: { transport_type: transport },
          responseType: "text",
          transformResponse: [(data) => data],
          cancelToken: cancellation.token,
        });
        if (requestId !== latestRoadRequest) return;
        if (response.status === 202) {
          if (hasSavedData)
            state.dataNotice =
              "Showing saved measurements. Updated road data is being prepared.";
          else state.isPreparing = true;
          return;
        }
        if (!(await display(response.data))) return;
        state.dataNotice = null;
        // Browser storage is best effort; it must never delay displaying roads.
        void roadCache.write(cacheKey, response.data);
      } catch (error) {
        if (requestId !== latestRoadRequest) return;
        if (hasSavedData)
          state.dataNotice =
            "Showing saved measurements. New measurements could not be checked.";
        else
          state.loadError =
            "Road data could not be loaded. Check your connection and try again.";
      } finally {
        if (requestId === latestRoadRequest) {
          state.isLoading = false;
          cancelRoadRequest = null;
        }
      }
    },
    async filterTableDetails({ commit, state }) {
      if (!state.geojsonResponse) return;
      const request = ++latestViewRequest;
      const version = state.roadDataVersion;
      const bounds = state.latLngBounds;
      const result = await roadProcessor.view(
        {
          bounds: bounds
            ? {
                west: bounds.getWest(),
                east: bounds.getEast(),
                south: bounds.getSouth(),
                north: bounds.getNorth(),
              }
            : null,
          merge: state.mergeRoadSegments,
          table: state.showDetailsTable,
        },
        version
      );
      if (
        result &&
        request === latestViewRequest &&
        version === state.roadDataVersion &&
        state.geojsonResponse
      )
        commit("updateRoadView", result);
    },
    async searchRoads({ state }, query) {
      state.roadSearchQuery = query;
      state.roadSearchResults = [];
      const request = ++latestSearchRequest;
      if (!state.geojsonResponse || !query.trim()) return;
      const version = state.roadDataVersion;
      const rows = await roadProcessor.search(query, version);
      if (
        rows &&
        request === latestSearchRequest &&
        version === state.roadDataVersion &&
        state.geojsonResponse
      )
        state.roadSearchResults = markRaw(
          hydrateRows(rows, state.geojsonResponse.features)
        );
    },
  },
});

store.subscribe(({ type }) => {
  if (["updateMergeRoadSegments", "updateShowDetailsTable"].includes(type))
    void store.dispatch("filterTableDetails");
});

const routes = [
  {
    path: "/diagnostics",
    name: "Diagnostics",
    component: () => import("./views/ViaDiagnostics.vue"),
  },
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

const app = createApp(App);

app.use(store);
app.use(router);
app.use(PrimeVue);

app.mount("#app");
