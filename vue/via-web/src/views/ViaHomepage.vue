<template>
  <main class="explorer">
    <header class="topbar">
      <a class="brand" href="/">Via <span>Road insights</span></a>
      <nav aria-label="Information"><button :aria-expanded="showAbout" @click="showAbout = !showAbout">About</button><a href="https://github.com/RobertLucey/via-web">Contribute</a></nav>
    </header>
    <section v-if="showAbout" class="about-panel">
      <button class="close-button" aria-label="Close about" @click="showAbout = false">×</button>
      <h2>Explore the roads you travel</h2>
      <p>Via combines measurements from bike and vehicle journeys to show road roughness, recorded usage, and speed. These measurements describe recorded journeys; they are not a road safety rating.</p>
      <p><a href="https://github.com/RobertLucey/via-app/releases/latest">Get the Via app</a> to contribute measurements, or <a href="mailto:viaroadsdeveloper@gmail.com">get in touch</a>.</p>
      <ViaSidebarExamplesView />
    </section>
    <section class="toolbar" aria-label="Explore roads">
      <ViaSidebarExploreView />
      <div class="road-search">
        <label class="sr-only" for="road-search">Search recorded roads</label>
        <input id="road-search" type="search" v-model="search" placeholder="Search recorded roads…" autocomplete="off" @keydown.esc="search = ''" />
        <ul v-if="search.trim()" class="search-results" aria-label="Matching roads">
          <li v-for="road in searchResults" :key="road.id"><button @click="selectRoad(road); search = ''">{{ road.name }}</button></li>
          <li v-if="!searchResults.length">{{ isLoading ? 'Loading roads…' : 'No matching recorded roads.' }}</li>
        </ul>
      </div>
    </section>
    <div class="workspace">
      <section class="map-area" aria-label="Road measurements map">
        <ViaMap ref="map" />
        <div class="map-status" role="status" v-if="isLoading">Loading {{ transportType === 'bike' ? 'bike' : 'vehicle' }} measurements…</div>
        <div class="map-status error" role="alert" v-else-if="loadError">{{ loadError }} <button @click="$store.dispatch('getGeojsonFromAPI')">Retry</button></div>
        <div class="map-status" role="status" v-else-if="!tableDetails?.length">No {{ transportType === 'bike' ? 'bike' : 'vehicle' }} measurements in this area. Zoom out or search for a road.</div>
        <aside class="legend" aria-label="Map legend">
          <strong>{{ legend.title }}</strong>
          <div class="legend-gradient" :class="{ 'roughness-gradient': selectedMetric === 'quality' }"></div>
          <div class="legend-labels"><span>{{ legend.low }}</span><span>{{ legend.high }}</span></div>
          <p>{{ legend.description }}</p>
          <span class="missing-swatch"></span> No data
        </aside>
        <aside v-if="selectedRoad" class="road-details" aria-label="Selected road details">
          <button class="close-button" aria-label="Close road details" @click="$store.commit('selectRoad', null)">×</button>
          <span class="eyebrow">{{ selectedRoad.features.length > 1 ? 'Road summary' : 'Road segment' }}</span>
          <h2>{{ selectedRoad.name }}</h2>
          <dl><div><dt>Roughness</dt><dd>{{ displayValue(selectedRoad.quality) }}</dd></div><div><dt>Observations</dt><dd>{{ displayValue(selectedRoad.usage) }}</dd></div><div><dt>Speed (km/h)</dt><dd>{{ displayValue(selectedRoad.speed) }}</dd></div></dl>
          <p>Lower roughness means a smoother journey. {{ selectedRoad.features.length > 1 ? 'Grouped roads use average roughness and speed, and the highest segment observation count.' : 'Values describe this recorded segment.' }}</p>
        </aside>
      </section>
      <section v-if="showDetailsTable" class="table-panel" aria-label="Roads in map view">
        <div class="table-heading"><strong>Roads in view</strong><span>Click a road to locate it · Lower roughness is smoother</span><button aria-label="Close road table" @click="$store.commit('updateShowDetailsTable', false)">×</button></div>
        <ViaDetailTables @select-road="selectRoad" />
      </section>
    </div>
  </main>
</template>
<script>
import { mapState } from 'vuex';
import ViaMap from '../components/ViaMap.vue';
import ViaDetailTables from '../components/ViaDetailTables.vue';
import ViaSidebarExploreView from '../components/ViaSidebarExploreView.vue';
import ViaSidebarExamplesView from '../components/ViaSidebarExamplesView.vue';
import { roadRows, displayValue } from '../lib/roads';
export default {
  components: { ViaMap, ViaDetailTables, ViaSidebarExploreView, ViaSidebarExamplesView },
  data: () => ({ search: '', showAbout: false }),
  computed: {
    ...mapState(['transportType', 'isLoading', 'loadError', 'tableDetails', 'showDetailsTable', 'selectedRoad', 'selectedMetric', 'mergeRoadSegments']),
    searchableRoads() { return roadRows(this.$store.state.viewGeojson?.features || [], true); },
    searchResults() { return this.searchableRoads.filter(road => road.name.toLowerCase().includes(this.search.trim().toLowerCase())).slice(0, 8); },
    legend() {
      return {
        quality: { title: 'Road roughness', low: '0 · Smoother', high: '50+ · Rougher', description: 'Lower measured roughness means a smoother journey.' },
        usage: { title: 'Recorded usage', low: '0 observations', high: '10+', description: 'Recorded observations, not total traffic.' },
        speed: { title: 'Recorded speed', low: '0 km/h', high: '36+ km/h', description: 'Average recorded speed, not a safety rating.' }
      }[this.selectedMetric];
    }
  },
  methods: {
    displayValue,
    selectRoad(road) { this.$refs.map.highlightSegment(road); }
  },
  created() {
    const query = { ...this.$route.query };
    this.$store.commit('updateTransportType', query.transport_type || 'bike');
    this.$store.commit('updateShowDetailsTable', query.showDetailsTable);
    this.$store.commit('updateMergeRoadSegments', query.mergeRoadSegments);
    this.$store.commit('updateSelectedMetric', query.selectedMetric || 'quality');
    this.$store.commit('updateMapView', { lat: parseFloat(query.lat), lng: parseFloat(query.lng), zoom: parseInt(query.zoomLevel) });
    this.$store.dispatch('getGeojsonFromAPI');
  }
};
</script>
<style>
html, body, #app { margin: 0; height: 100%; }
* { box-sizing: border-box; }
.explorer { height: 100vh; height: 100dvh; display: flex; flex-direction: column; background: #f4f7f7; color: #243b45; }
.explorer button { cursor: pointer; border: 1px solid #ccd8db; border-radius: 7px; background: white; padding: 8px 12px; color: #243b45; font: inherit; }
.explorer button:hover { background: #edf4f4; }
.explorer button:focus-visible, .explorer a:focus-visible, .explorer input:focus-visible { outline: 3px solid #007e87; outline-offset: 2px; }
.topbar { display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; border-bottom: 1px solid #dde5e7; background: white; }
.brand { color: #155e63; font-size: 25px; font-weight: 800; text-decoration: none; }
.brand span { font-size: 14px; font-weight: 400; color: #51666f; margin-left: 12px; }
.topbar nav { display: flex; align-items: center; gap: 16px; }
.topbar a { color: #155e63; }
.toolbar { display: flex; justify-content: space-between; gap: 14px; padding: 12px 20px; flex-wrap: wrap; background: white; z-index: 1100; }
.road-search { position: relative; flex: 0 1 320px; }
.road-search input { width: 100%; border: 1px solid #bcccd1; border-radius: 7px; padding: 9px 12px; }
.search-results { position: absolute; top: 100%; width: 100%; list-style: none; padding: 6px; margin: 4px 0; background: white; box-shadow: 0 6px 24px #243b4533; border-radius: 8px; max-height: 300px; overflow: auto; }
.search-results button { width: 100%; border: 0; text-align: left; }
.workspace { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.map-area { position: relative; flex: 1; min-height: 180px; }
.map-status { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); z-index: 1000; background: white; padding: 12px 18px; border-radius: 8px; box-shadow: 0 2px 12px #243b4522; max-width: calc(100% - 110px); }
.error { border-left: 4px solid #aa4036; }
.legend, .road-details { position: absolute; z-index: 1000; background: white; box-shadow: 0 3px 18px #243b4533; border-radius: 10px; padding: 16px; }
.legend { bottom: 28px; left: 12px; width: 255px; font-size: 12px; }
.legend strong { font-size: 14px; }
.legend-gradient { height: 8px; border-radius: 4px; margin: 10px 0 5px; background: linear-gradient(to right, #d73027, #fc8d59, #fee08b, #91cf60, #1a9850); }
.legend-gradient.roughness-gradient { background: linear-gradient(to right, #1a9850, #91cf60, #fee08b, #fc8d59, #d73027); }
.legend-labels { display: flex; justify-content: space-between; }
.legend p { margin: 8px 0; }
.missing-swatch { display: inline-block; width: 22px; border-top: 3px dashed #87939c; margin-right: 5px; vertical-align: middle; }
.road-details { right: 12px; bottom: 28px; width: 330px; max-width: calc(100% - 24px); }
.road-details h2, .about-panel h2 { font-size: 21px; margin: 5px 24px 16px 0; }
.eyebrow { font-size: 12px; color: #617880; }
.close-button { position: absolute; right: 8px; top: 8px; }
.road-details dl { display: flex; gap: 18px; margin: 0; }
.road-details dt { font-size: 12px; font-weight: 400; }
.road-details dd { font-size: 20px; font-weight: 600; }
.road-details p { font-size: 12px; margin: 8px 0 0; }
.table-panel { height: 32vh; min-height: 140px; display: flex; flex-direction: column; background: white; }
.table-heading { display: flex; align-items: center; gap: 16px; padding: 8px 16px; }
.table-heading span { font-size: 12px; flex: 1; }
.table-heading button { margin-left: auto; }
.about-panel { position: absolute; top: 65px; right: 12px; width: 430px; max-width: calc(100% - 24px); max-height: 75vh; overflow: auto; z-index: 1200; padding: 24px; background: white; box-shadow: 0 4px 30px #243b4544; border-radius: 12px; }
@media (max-width: 700px) {
  .topbar { padding: 8px 12px; }
  .brand span { display: none; }
  .toolbar { padding: 8px 12px; gap: 8px; }
  .explore-controls { width: 100%; gap: 8px !important; }
  .explore-controls label { font-size: 12px !important; }
  .explorer button { padding: 7px 10px; font-size: 13px; min-height: 40px; }
  .road-search { flex: 1 1 100%; }
  .legend { width: 210px; padding: 10px; bottom: 24px; font-size: 11px; }
  .legend p { display: none; }
  .road-details { bottom: 0; left: 0; right: 0; width: 100%; max-width: 100%; border-radius: 14px 14px 0 0; padding: 14px; }
  .map-area:has(.road-details) .legend { display: none; }
  .table-heading span { display: none; }
  .map-status { font-size: 13px; }
}
</style>
