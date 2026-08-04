<template>
  <div class="relative size-full overflow-x-hidden">
    <AdaptiveCtrl />
    <div
      class="flex flex-col gap-3 p-3"
      :style="padding"
    >
      <AdaptiveSummary />
      <AdaptiveMatrix />
    </div>
  </div>
</template>

<script setup lang="ts">
import AdaptiveCtrl from '@/components/adaptive/AdaptiveCtrl.vue'
import AdaptiveMatrix from '@/components/adaptive/AdaptiveMatrix.vue'
import AdaptiveSummary from '@/components/adaptive/AdaptiveSummary.vue'
import { usePaddingForViews } from '@/composables/paddingViews'
import { initAdaptive, stopAdaptive } from '@/store/adaptive'
import { onMounted, onUnmounted } from 'vue'

const { padding } = usePaddingForViews({
  offsetTop: 12,
  offsetBottom: 8,
})

onMounted(() => {
  initAdaptive()
})

onUnmounted(() => {
  stopAdaptive()
})
</script>
