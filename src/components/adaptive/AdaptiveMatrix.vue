<template>
  <div class="flex flex-col gap-3">
    <div
      v-if="!targetRows.length"
      class="bg-base-100 text-base-content/60 rounded-box px-4 py-8 text-center shadow-xs"
    >
      {{ emptyHint }}
    </div>

    <AdaptiveTargetCard
      v-for="row in targetRows"
      :key="`${row.group}:${row.key}`"
      :group="row.group"
      :target="row"
    />

    <div
      v-if="observedRows.length"
      class="bg-base-100 rounded-box px-3 py-2 shadow-xs"
    >
      <div class="mb-2 text-sm font-medium">{{ $t('adaptiveObservedTargets') }}</div>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="item in observedRows"
          :key="`${item.group}:${item.key}`"
          class="badge badge-sm gap-1"
          :class="item.probeEligible ? 'badge-outline' : 'badge-ghost'"
          :title="observedTitle(item)"
        >
          <span class="opacity-70">{{ item.group }}</span>
          <span>{{ observedLabel(item) }}</span>
          <span
            v-if="!item.probeEligible"
            class="opacity-60"
            >· {{ $t('adaptiveProbeIneligible') }}</span
          >
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import AdaptiveTargetCard from '@/components/adaptive/AdaptiveTargetCard.vue'
import { resolveExitNamesForTarget } from '@/assembly/adaptive/exitLookup'
import { proxyMap } from '@/assembly/proxies'
import {
  adaptiveHasSnapshots,
  adaptiveObservedRows,
  adaptiveTargetRows,
  type AdaptiveObservedRow,
} from '@/store/adaptive'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const targetRows = adaptiveTargetRows
const observedRows = adaptiveObservedRows

const emptyHint = computed(() => {
  if (!adaptiveHasSnapshots.value) return t('adaptiveWaiting')
  const hasObserved = observedRows.value.length > 0
  if (hasObserved && !targetRows.value.length) {
    return t('adaptiveColdStart')
  }
  return t('noData')
})

const observedLabel = (item: AdaptiveObservedRow) => {
  return resolveExitNamesForTarget(proxyMap.value, item.group, item.key) || item.key
}

const observedTitle = (item: AdaptiveObservedRow) => {
  const names = resolveExitNamesForTarget(proxyMap.value, item.group, item.key)
  if (!names) return `${item.group}\n${item.lastSeen}`
  return `${item.group}\n${item.key}\n${item.lastSeen}`
}
</script>
