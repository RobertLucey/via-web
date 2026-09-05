<template>
  <div id="inputs_container">
    <form id="pull_journeys_form">
      <label for="selectedMetric"> Focus Metric </label>
      <select
        v-model="selectedMetric"
        :style="{
          'margin-left': '10px',
        }"
      >
        <option value="quality">Quality</option>
        <option value="usage">Usage</option>
        <option value="speed">Speed</option>
      </select>

      <label for="mergeRoadSegments"> Merge Data By Road Name </label>
      <input
        type="checkbox"
        v-model="mergeRoadSegments"
        :style="{
          'margin-left': '10px',
        }"
      />

      <label for="showDetailsTable"> Show Details Table </label>
      <input
        type="checkbox"
        v-model="showDetailsTable"
        :style="{
          'margin-left': '10px',
        }"
      />
    </form>
  </div>
</template>

<script>
import { mapState } from "vuex";

export default {
  name: "ViaSidebarExploreView",
  data() {
    return {};
  },
  computed: {
    ...mapState(["mergeRoadSegments", "showDetailsTable"]),
    mergeRoadSegments: {
      get() {
        return this.$store.state.mergeRoadSegments;
      },
      set(val) {
        this.$store.commit("updateMergeRoadSegments", val);
      },
    },
    showDetailsTable: {
      get() {
        return this.$store.state.showDetailsTable;
      },
      set(val) {
        this.$store.commit("updateShowDetailsTable", val);
        this.$store.dispatch("filterTableDetails");
      },
    },
    selectedMetric: {
      get() {
        return this.$store.state.selectedMetric;
      },
      set(val) {
        this.$store.commit("updateSelectedMetric", val);
      },
    },
  },
  methods: {},
  mounted() {},
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
.journeyRadioButton {
  margin-left: 0.5rem;
}
</style>
