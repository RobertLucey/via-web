<template>
  <div class="road-table">
    <DataTable
      :value="rows"
      :scrollable="true"
      scrollHeight="flex"
      :rowHover="true"
      @row-click="$emit('select-road', $event.data)"
      sortField="name"
      :sortOrder="1"
    >
      <template #empty>
        <span v-if="$store.state.isLoading">Loading roads…</span>
        <span v-else-if="$store.state.isPreparing"
          >Road data is being prepared. Please check again shortly.</span
        >
        <span v-else
          >No roads in this view. Move the map or search for a road above.</span
        >
      </template>
      <Column field="name" header="Road" sortable
        ><template #body="{ data }"
          ><button class="road-link" @click.stop="$emit('select-road', data)">
            {{ data.name }}
          </button></template
        ></Column
      >
      <Column field="quality" header="Roughness ↓" sortable
        ><template #body="{ data }">{{
          displayValue(data.quality)
        }}</template></Column
      >
      <Column field="usage" header="Observations" sortable
        ><template #body="{ data }">{{
          displayValue(data.usage)
        }}</template></Column
      >
      <Column field="speed" header="Speed (km/h)" sortable
        ><template #body="{ data }">{{
          displayValue(data.speed)
        }}</template></Column
      >
    </DataTable>
  </div>
</template>
<script>
import { roadRows, displayValue } from "../lib/roads";
export default {
  emits: ["select-road"],
  computed: {
    rows() {
      return roadRows(
        this.$store.state.tableDetails || [],
        this.$store.state.mergeRoadSegments
      );
    },
  },
  methods: { displayValue },
};
</script>
<style scoped>
.road-table {
  height: 100%;
  overflow: auto;
}
.road-link {
  border: 0;
  background: transparent;
  color: #155e63;
  text-align: left;
  text-decoration: underline;
}
</style>
