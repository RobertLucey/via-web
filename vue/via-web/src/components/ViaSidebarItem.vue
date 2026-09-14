<template>
  <div class="bg-dark list-group-item list-group-item-action">
    <div
      class="d-flex w-100 justify-content-start align-items-center"
      @click="handleMenuItemClick"
    >
      <!-- Icon -->
      <ViaSidebarItemIcon
        :collapsedIcon="collapsedIcon"
        :expandedIcon="expandedIcon"
        :isCustomIcon="isCustomIcon"
        :isExpanded="isExpanded"
      />

      <!-- Expanded menu text (and subcontent indicator) -->
      <span
        v-if="isExpanded"
        class="mr-3"
        :class="{
          'subcontent-expanded': hasSubContent && shouldShowSlot,
          'subcontent-collapsed': hasSubContent && !shouldShowSlot,
        }"
      >
        {{ expandedText }}
      </span>
    </div>

    <!-- Subcontent -->
    <div
      v-if="isExpanded && hasSubContent && shouldShowSlot"
      class="subcontent"
    >
      <slot />
    </div>
  </div>
</template>

<script>
import ViaSidebarItemIcon from "./ViaSidebarItemIcon.vue";

export default {
  name: "ViaSidebarItem",
  props: {
    collapsedIcon: {
      required: true,
    },
    expandedIcon: {
      default: (props) => props.collapsedIcon,
    },
    isCustomIcon: {
      type: Boolean,
    },
    expandedText: {
      required: true,
    },
    isExpanded: {
      required: true,
    },
    hasSubContent: {
      type: Boolean,
    },
    href: {
      default: "",
    },
  },
  data() {
    return {
      shouldShowSlot: false,
    };
  },
  methods: {
    toggleShowSlot() {
      this.shouldShowSlot = this.hasSubContent && !this.shouldShowSlot;
    },
    handleMenuItemClick() {
      if (this.href != "") {
        window.location.href = this.href;
      }
      if (!this.hasSubContent) {
        return;
      } else {
        this.toggleShowSlot();
      }
    },
  },
  components: {
    ViaSidebarItemIcon,
  },
};
</script>

<style scoped src="../styles/ViaSidebarItem.css"></style>
