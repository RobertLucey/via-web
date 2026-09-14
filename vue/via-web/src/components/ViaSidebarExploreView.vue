<template>
  <div class="explore-controls">
    <div
      class="transport-switch metric-switch"
      role="group"
      aria-label="Transport type"
    >
      <button
        :aria-pressed="transportType === 'bike'"
        @click="$store.dispatch('setTransportType', 'bike')"
      >
        Bike
      </button>
      <button
        :aria-pressed="transportType === 'car'"
        @click="$store.dispatch('setTransportType', 'car')"
      >
        Vehicle
      </button>
    </div>
    <div class="metric-switch" role="group" aria-label="Map metric">
      <button
        v-for="metric in ['quality', 'usage', 'speed']"
        :key="metric"
        :aria-pressed="selectedMetric === metric"
        @click="$store.commit('updateSelectedMetric', metric)"
      >
        {{ metric }}
      </button>
    </div>
    <label
      ><input
        type="checkbox"
        :checked="mergeRoadSegments"
        @change="
          $store.commit('updateMergeRoadSegments', $event.target.checked)
        "
      />
      Group by road name</label
    >
    <button
      :aria-expanded="showDetailsTable"
      @click="$store.commit('updateShowDetailsTable', !showDetailsTable)"
    >
      {{ showDetailsTable ? "Hide" : "Show" }} road table
    </button>
  </div>
</template>
<script>
import { mapState } from "vuex";
export default {
  computed: mapState([
    "transportType",
    "selectedMetric",
    "mergeRoadSegments",
    "showDetailsTable",
  ]),
};
</script>
<style scoped src="../styles/ViaSidebarExploreView.css"></style>
