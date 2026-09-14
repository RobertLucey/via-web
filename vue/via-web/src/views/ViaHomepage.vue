<template>
  <main class="explorer">
    <header class="topbar">
      <a class="brand" href="/">Via <span>Road insights</span></a>
      <nav aria-label="Information">
        <router-link to="/diagnostics">Diagnostics</router-link>
        <button :aria-expanded="showAbout" @click="showAbout = !showAbout">
          About</button
        ><a href="https://github.com/RobertLucey/via-web">Contribute</a>
      </nav>
    </header>
    <section v-if="showAbout" class="about-panel">
      <button
        class="close-button"
        aria-label="Close about"
        @click="showAbout = false"
      >
        ×
      </button>
      <h2>Explore the roads you travel</h2>
      <p>
        Via combines measurements from bike and vehicle journeys to show road
        roughness, recorded usage, and speed. These measurements describe
        recorded journeys; they are not a road safety rating.
      </p>
      <p>
        <a href="https://github.com/RobertLucey/via-app/releases/latest"
          >Get the Via app</a
        >
        to contribute measurements, or
        <a href="mailto:viaroadsdeveloper@gmail.com">get in touch</a>.
      </p>
      <ViaSidebarExamplesView />
    </section>
    <section class="toolbar" aria-label="Explore roads">
      <ViaSidebarExploreView />
      <div class="road-search">
        <label class="sr-only" for="road-search">Search recorded roads</label>
        <input
          id="road-search"
          type="search"
          v-model="search"
          placeholder="Search recorded roads…"
          autocomplete="off"
          @keydown.esc="search = ''"
        />
        <ul
          v-if="search.trim()"
          class="search-results"
          aria-label="Matching roads"
        >
          <li v-for="road in searchResults" :key="road.id">
            <button
              @click="
                selectRoad(road);
                search = '';
              "
            >
              {{ road.name }}
            </button>
          </li>
          <li v-if="!searchResults.length">
            {{
              isLoading
                ? "Loading roads…"
                : isPreparing
                ? "Road data is being prepared…"
                : "No matching recorded roads."
            }}
          </li>
        </ul>
      </div>
    </section>
    <div class="workspace">
      <section class="map-area" aria-label="Road measurements map">
        <ViaMap ref="map" />
        <div class="map-status" role="status" v-if="isLoading">
          Loading
          {{ transportType === "bike" ? "bike" : "vehicle" }} measurements…
        </div>
        <div class="map-status" role="status" v-else-if="isPreparing">
          Road data is being prepared. Please check again shortly.
          <button @click="$store.dispatch('getGeojsonFromAPI')">
            Check again
          </button>
        </div>
        <div class="map-status error" role="alert" v-else-if="loadError">
          {{ loadError }}
          <button @click="$store.dispatch('getGeojsonFromAPI')">Retry</button>
        </div>
        <div class="map-status" role="status" v-else-if="!tableDetails?.length">
          No {{ transportType === "bike" ? "bike" : "vehicle" }} measurements in
          this area. Zoom out or search for a road.
        </div>
        <aside class="legend" aria-label="Map legend">
          <strong>{{ legend.title }}</strong>
          <div
            class="legend-gradient"
            :class="{ 'roughness-gradient': selectedMetric === 'quality' }"
          ></div>
          <div class="legend-labels">
            <span>{{ legend.low }}</span
            ><span>{{ legend.high }}</span>
          </div>
          <p>{{ legend.description }}</p>
          <span class="missing-swatch"></span> No data
        </aside>
        <aside
          v-if="selectedRoad"
          class="road-details"
          aria-label="Selected road details"
        >
          <button
            class="close-button"
            aria-label="Close road details"
            @click="$store.commit('selectRoad', null)"
          >
            ×
          </button>
          <span class="eyebrow">{{
            selectedRoad.features.length > 1 ? "Road summary" : "Road segment"
          }}</span>
          <h2>{{ selectedRoad.name }}</h2>
          <dl>
            <div>
              <dt>Roughness</dt>
              <dd>{{ displayValue(selectedRoad.quality) }}</dd>
            </div>
            <div>
              <dt>Observations</dt>
              <dd>{{ displayValue(selectedRoad.usage) }}</dd>
            </div>
            <div>
              <dt>Speed (km/h)</dt>
              <dd>{{ displayValue(selectedRoad.speed) }}</dd>
            </div>
          </dl>
          <p>
            Lower roughness means a smoother journey.
            {{
              selectedRoad.features.length > 1
                ? "Grouped roads use average roughness and speed, and the highest segment observation count."
                : "Values describe this recorded segment."
            }}
          </p>
        </aside>
      </section>
      <section
        v-if="showDetailsTable"
        class="table-panel"
        aria-label="Roads in map view"
      >
        <div class="table-heading">
          <strong>Roads in view</strong
          ><span>Click a road to locate it · Lower roughness is smoother</span
          ><button
            aria-label="Close road table"
            @click="$store.commit('updateShowDetailsTable', false)"
          >
            ×
          </button>
        </div>
        <ViaDetailTables @select-road="selectRoad" />
      </section>
    </div>
  </main>
</template>
<script>
import { mapState } from "vuex";
import ViaMap from "../components/ViaMap.vue";
import ViaDetailTables from "../components/ViaDetailTables.vue";
import ViaSidebarExploreView from "../components/ViaSidebarExploreView.vue";
import ViaSidebarExamplesView from "../components/ViaSidebarExamplesView.vue";
import { roadRows, displayValue } from "../lib/roads";
export default {
  components: {
    ViaMap,
    ViaDetailTables,
    ViaSidebarExploreView,
    ViaSidebarExamplesView,
  },
  data: () => ({ search: "", showAbout: false }),
  computed: {
    ...mapState([
      "transportType",
      "isLoading",
      "isPreparing",
      "loadError",
      "tableDetails",
      "showDetailsTable",
      "selectedRoad",
      "selectedMetric",
      "mergeRoadSegments",
    ]),
    searchableRoads() {
      return roadRows(this.$store.state.viewGeojson?.features || [], true);
    },
    searchResults() {
      return this.searchableRoads
        .filter((road) =>
          road.name.toLowerCase().includes(this.search.trim().toLowerCase())
        )
        .slice(0, 8);
    },
    legend() {
      return {
        quality: {
          title: "Road roughness",
          low: "0 · Smoother",
          high: this.transportType === "car" ? "30+ · Rougher" : "50+ · Rougher",
          description: "Lower measured roughness means a smoother journey.",
        },
        usage: {
          title: "Recorded usage",
          low: "0 observations",
          high: "10+",
          description: "Recorded observations, not total traffic.",
        },
        speed: {
          title: "Recorded speed",
          low: "0 km/h",
          high: this.transportType === "car" ? "100+ km/h" : "36+ km/h",
          description: "Average recorded speed, not a safety rating.",
        },
      }[this.selectedMetric];
    },
  },
  methods: {
    displayValue,
    selectRoad(road) {
      this.$refs.map.highlightSegment(road);
    },
  },
  created() {
    const query = { ...this.$route.query };
    this.$store.commit("updateTransportType", query.transport_type || "bike");
    this.$store.commit("updateShowDetailsTable", query.showDetailsTable);
    this.$store.commit("updateMergeRoadSegments", query.mergeRoadSegments);
    this.$store.commit(
      "updateSelectedMetric",
      query.selectedMetric || "quality"
    );
    this.$store.commit("updateMapView", {
      lat: parseFloat(query.lat),
      lng: parseFloat(query.lng),
      zoom: parseInt(query.zoomLevel),
    });
    this.$store.dispatch("getGeojsonFromAPI");
  },
};
</script>
<style src="../styles/ViaHomepage.css"></style>
