<template>
  <div
    v-if="hasSnapshots"
    class="flex flex-col gap-3"
  >
    <div class="flex flex-wrap gap-2 text-xs md:text-sm">
      <div class="bg-base-100 rounded-box flex items-center gap-2 px-3 py-2 shadow-xs">
        <span class="text-base-content/60">{{ $t('adaptiveGroups') }}</span>
        <span>{{ snapshotList.length }}</span>
      </div>
      <div class="bg-base-100 rounded-box flex items-center gap-2 px-3 py-2 shadow-xs">
        <span class="text-base-content/60">{{ $t('adaptiveProbe') }}</span>
        <span
          class="badge badge-sm"
          :class="anyProbeRunning ? 'badge-success' : 'badge-warning'"
        >
          {{ anyProbeRunning ? $t('adaptiveProbeRunning') : $t('adaptiveProbeIdle') }}
        </span>
        <span class="text-base-content/70">{{ probeModesLabel }}</span>
      </div>
      <div
        v-if="singleSnapshot"
        class="bg-base-100 rounded-box flex items-center gap-2 px-3 py-2 shadow-xs"
      >
        <span class="text-base-content/60">{{ $t('adaptiveTargetScope') }}</span>
        <span>{{ singleSnapshot.targetScope }}</span>
      </div>
      <div class="bg-base-100 rounded-box flex items-center gap-2 px-3 py-2 shadow-xs">
        <span class="text-base-content/60">{{ $t('adaptiveGeneratedAt') }}</span>
        <span>{{ formatTime(latestGeneratedAt) }}</span>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <div
        v-for="item in rateCards"
        :key="item.key"
        class="bg-base-100 rounded-box px-3 py-2 shadow-xs"
      >
        <div class="text-base-content/55 text-xs">{{ item.label }}</div>
        <div class="mt-1 flex items-baseline gap-2">
          <span class="text-lg font-semibold tabular-nums">{{ item.total }}</span>
          <span
            v-if="item.rate > 0"
            class="text-success text-xs tabular-nums"
          >
            +{{ item.rate }}
          </span>
        </div>
      </div>
    </div>

    <div
      v-if="configCapsules.length"
      class="flex flex-wrap items-center gap-1.5"
    >
      <span class="text-base-content/50 mr-1 text-xs">{{ $t('adaptiveConfig') }}</span>
      <span
        v-for="item in configCapsules"
        :key="item"
        class="badge badge-sm badge-ghost rounded-full px-2.5 font-normal"
      >
        {{ item }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  adaptiveHasSnapshots,
  adaptiveSingleSnapshot,
  adaptiveSnapshotList,
  adaptiveTotals,
  adaptiveTotalsRates,
} from '@/store/adaptive'
import dayjs from 'dayjs'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const hasSnapshots = adaptiveHasSnapshots
const snapshotList = adaptiveSnapshotList
const singleSnapshot = adaptiveSingleSnapshot

const formatTime = (value: string) => {
  if (!value) return '-'
  return dayjs(value).format('HH:mm:ss.SSS')
}

const anyProbeRunning = computed(() => snapshotList.value.some((s) => s.probe.running))

const probeModesLabel = computed(() => {
  const modes = [...new Set(snapshotList.value.map((s) => s.probe.mode))]
  return modes.join(' / ') || '-'
})

const latestGeneratedAt = computed(() => {
  let latest = ''
  for (const s of snapshotList.value) {
    if (!latest || s.generatedAt > latest) latest = s.generatedAt
  }
  return latest
})

const configCapsules = computed(() => {
  const single = singleSnapshot.value
  if (single) {
    const config = single.config
    return [
      `probe=${config.probeMode}`,
      `${config.probeIntervalMillis}ms`,
      `timeout=${config.probeTimeoutMillis}ms`,
      `fail=${config.failureThreshold}`,
      `eject=${config.ejectDurationMillis}ms`,
      `slow-start=${config.slowStartDurationMillis}ms`,
      `+${config.increaseStep}/-${config.decreaseStep}`,
      `retries=${config.retries}`,
      `weight=${config.minWeight}-${config.baseWeight}-${config.maxWeight}`,
      `latency-aware=${config.latencyAware ? 'on' : 'off'}`,
      `ewma-α=${config.ewmaAlpha}`,
    ]
  }

  const modes = [...new Set(snapshotList.value.map((s) => s.config.probeMode))]
  return [`groups=${snapshotList.value.length}`, ...modes.map((m) => `probe=${m}`)]
})

const rateCards = computed(() => {
  const totals = adaptiveTotals.value
  const rates = adaptiveTotalsRates.value

  return [
    {
      key: 'tcpSuccess',
      label: t('adaptiveTcpSuccess'),
      total: totals.tcpSuccessesTotal,
      rate: rates.tcpSuccessesTotal,
    },
    {
      key: 'tcpFailure',
      label: t('adaptiveTcpFailure'),
      total: totals.tcpFailuresTotal,
      rate: rates.tcpFailuresTotal,
    },
    {
      key: 'retry',
      label: t('adaptiveRetry'),
      total: totals.retryAttemptsTotal,
      rate: rates.retryAttemptsTotal,
    },
    {
      key: 'probeSuccess',
      label: t('adaptiveProbeSuccess'),
      total: totals.probeSuccessesTotal,
      rate: rates.probeSuccessesTotal,
    },
    {
      key: 'probeFailure',
      label: t('adaptiveProbeFailure'),
      total: totals.probeFailuresTotal,
      rate: rates.probeFailuresTotal,
    },
    {
      key: 'eject',
      label: t('adaptiveEjections'),
      total: totals.ejectionsTotal,
      rate: rates.ejectionsTotal,
    },
  ]
})
</script>
