<template>
  <div class="bg-base-100 rounded-box overflow-hidden shadow-xs">
    <button
      type="button"
      class="border-base-200 hover:bg-base-200/40 flex w-full items-center gap-2 border-b px-3 py-2 text-left"
      @click="expanded = !expanded"
    >
      <ChevronRightIcon
        class="text-base-content/50 h-4 w-4 flex-none transition-transform"
        :class="{ 'rotate-90': expanded }"
      />
      <div class="min-w-0 flex-1">
        <div class="truncate font-medium">{{ title }}</div>
        <div
          v-if="showSubtitle"
          class="text-base-content/50 truncate text-xs"
        >
          {{ target.key }}
        </div>
      </div>
      <div class="flex flex-none flex-col items-end gap-0.5">
        <div class="text-base-content/50 text-xs whitespace-nowrap">
          {{ target.nodes.length }} {{ $t('adaptiveNodes') }}
        </div>
        <div class="text-base-content/80 text-xs font-medium whitespace-nowrap">
          {{ group }}
        </div>
      </div>
    </button>

    <div
      v-if="!expanded"
      class="flex flex-wrap gap-1 px-3 py-2"
    >
      <div
        v-for="node in target.nodes"
        :key="node.name"
        class="flex h-4 w-4 items-center justify-center rounded-full transition hover:scale-110"
        :class="dotClass(node)"
        @mouseenter="(e) => showNodeTip(e, node)"
        @click.stop
      >
        <div class="h-2 w-2 rounded-full bg-white/80" />
      </div>
    </div>

    <div
      v-else
      class="overflow-x-auto"
    >
      <table class="table-sm table w-full">
        <thead>
          <tr class="text-base-content/55 text-xs">
            <th>{{ $t('adaptiveNode') }}</th>
            <th>{{ $t('adaptiveState') }}</th>
            <th>{{ $t('adaptiveEffectiveWeight') }}</th>
            <th>{{ $t('adaptiveSlowStart') }}</th>
            <th>{{ $t('adaptiveSuccessRate') }}</th>
            <th>{{ $t('adaptiveLatency') }}</th>
            <th>{{ $t('adaptiveLatencyFactor') }}</th>
            <th>{{ $t('adaptiveFailures') }}</th>
            <th>{{ $t('adaptiveActiveConns') }}</th>
            <th>{{ $t('adaptiveLastError') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="node in target.nodes"
            :key="`${group}:${target.key}:${node.name}`"
            class="hover:bg-base-200/40"
          >
            <td class="font-medium whitespace-nowrap">{{ node.name }}</td>
            <td>
              <span
                class="badge badge-sm"
                :class="stateBadgeClass(node)"
              >
                {{ stateLabel(node) }}
              </span>
            </td>
            <td class="whitespace-nowrap tabular-nums">
              <span>{{ formatWeight(node.effectiveWeight) }}</span>
              <span class="text-base-content/50 ml-1 text-xs">{{ formatShare(node) }}</span>
            </td>
            <td class="min-w-28">
              <div class="flex items-center gap-2">
                <progress
                  class="progress progress-primary h-2 w-16"
                  :value="Math.round(node.slowStartProgress * 100)"
                  max="100"
                />
                <span class="text-xs tabular-nums"
                  >{{ Math.round(node.slowStartProgress * 100) }}%</span
                >
              </div>
            </td>
            <td class="tabular-nums">{{ formatPercent(node.successRateEwma) }}</td>
            <td class="tabular-nums">{{ formatLatency(node.dialLatencyEwmaMillis) }}</td>
            <td class="tabular-nums">{{ formatFactor(node.latencyFactor) }}</td>
            <td class="tabular-nums">{{ node.consecutiveFailures }}</td>
            <td class="tabular-nums">{{ node.activeConnections }}</td>
            <td
              class="text-base-content/60 max-w-64 truncate text-xs"
              :title="node.lastError || ''"
            >
              {{ node.lastError || '-' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { resolveExitNamesForTarget } from '@/assembly/adaptive/exitLookup'
import { proxyMap } from '@/assembly/proxies'
import { useTooltip } from '@/helper/tooltip'
import type { AdaptiveMetricsNode, AdaptiveMetricsTarget } from '@/types'
import { ChevronRightIcon } from '@heroicons/vue/24/outline'
import { useStorage } from '@vueuse/core'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  group: string
  target: AdaptiveMetricsTarget
}>()

const { t } = useI18n()
const { showTip } = useTooltip()

const expandMap = useStorage<Record<string, boolean>>('cache/adaptive-target-expand-map', {})

const expandKey = computed(() => `${props.group}:${props.target.key}`)

const expanded = computed({
  get: () => !!expandMap.value[expandKey.value],
  set: (value: boolean) => {
    expandMap.value = {
      ...expandMap.value,
      [expandKey.value]: value,
    }
  },
})

const exitNames = computed(() =>
  resolveExitNamesForTarget(proxyMap.value, props.group, props.target.key),
)

const title = computed(() => exitNames.value || props.target.key)
const showSubtitle = computed(() => !!exitNames.value)

const weightSum = computed(() =>
  props.target.nodes.reduce((sum, node) => {
    const w = node.effectiveWeight
    return sum + (Number.isFinite(w) && w > 0 ? w : 0)
  }, 0),
)

const stateBadgeClass = (node: AdaptiveMetricsNode) => {
  if (node.state === 'normal') return 'badge-success'
  if (node.state === 'recovering') return 'badge-warning'
  if (node.state === 'ejected' && node.eligible) return 'badge-warning badge-outline'
  if (node.state === 'ejected') return 'badge-error'
  return 'badge-ghost'
}

const stateLabel = (node: AdaptiveMetricsNode) => {
  if (node.state === 'ejected' && node.eligible) return t('adaptiveStateHalfOpen')
  if (node.state === 'ejected') return t('adaptiveStateEjected')
  if (node.state === 'recovering') return t('adaptiveStateRecovering')
  if (node.state === 'normal') return t('adaptiveStateNormal')
  return node.state
}

const dotClass = (node: AdaptiveMetricsNode) => {
  if (node.state === 'normal') return 'bg-success'
  if (node.state === 'recovering') return 'bg-warning'
  if (node.state === 'ejected' && node.eligible) return 'bg-warning/70 ring-1 ring-warning'
  if (node.state === 'ejected') return 'bg-error'
  return 'bg-base-content/30'
}

const formatWeight = (value: number) => {
  if (!Number.isFinite(value)) return '-'
  return value.toFixed(value >= 10 ? 1 : 2)
}

const formatPercent = (value: number) => {
  if (!Number.isFinite(value)) return '-'
  return `${(value * 100).toFixed(1)}%`
}

const formatLatency = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return '-'
  return `${value.toFixed(1)}ms`
}

const formatFactor = (value: number) => {
  if (!Number.isFinite(value)) return '-'
  return value.toFixed(2)
}

const formatShare = (node: AdaptiveMetricsNode) => {
  const sum = weightSum.value
  if (sum <= 0 || !Number.isFinite(node.effectiveWeight) || node.effectiveWeight <= 0) return '-'
  return `${((node.effectiveWeight / sum) * 100).toFixed(1)}%`
}

const showNodeTip = (event: Event, node: AdaptiveMetricsNode) => {
  const tag = document.createElement('div')
  tag.className = 'flex flex-col gap-0.5 text-xs'
  const name = document.createElement('div')
  name.className = 'font-medium'
  name.textContent = node.name
  const meta = document.createElement('div')
  meta.className = 'opacity-80'
  meta.textContent = `${stateLabel(node)} · w=${formatWeight(node.effectiveWeight)} · ${formatShare(node)} · factor=${formatFactor(node.latencyFactor)}`
  tag.append(name, meta)
  showTip(event, tag)
}
</script>
