// Clash/Mihomo 专属：adaptive-weighted 观测组装层（多组并行订阅）。
import {
  createAdaptiveMetricsWebSocket,
  fetchAdaptiveMetricsAPI,
  type AdaptiveMetricsQuery,
} from '@/api/clash'
import { adaptiveWeightedGroups } from '@/assembly/proxies'
import type {
  AdaptiveMetricsCounters,
  AdaptiveMetricsObservedTarget,
  AdaptiveMetricsSnapshot,
  AdaptiveMetricsTarget,
} from '@/types'
import { debounce } from 'lodash'
import { computed, ref, shallowRef, watch, type WatchStopHandle } from 'vue'

export type AdaptiveTargetRow = AdaptiveMetricsTarget & { group: string }
export type AdaptiveObservedRow = AdaptiveMetricsObservedTarget & { group: string }

export const adaptiveTargetFilter = ref('')
export const adaptiveNodeFilter = ref('')
export const adaptiveSnapshots = shallowRef<Record<string, AdaptiveMetricsSnapshot>>({})
export const adaptiveConnected = ref(false)
export const adaptiveLoading = ref(false)

const previousTotalsByGroup = shallowRef<Record<string, AdaptiveMetricsCounters>>({})

const emptyRates = (): AdaptiveMetricsCounters => ({
  tcpAttemptsTotal: 0,
  tcpSuccessesTotal: 0,
  tcpFailuresTotal: 0,
  tcpCanceledTotal: 0,
  retryAttemptsTotal: 0,
  udpSelectionsTotal: 0,
  probeAttemptsTotal: 0,
  probeSuccessesTotal: 0,
  probeFailuresTotal: 0,
  probeCanceledTotal: 0,
  ejectionsTotal: 0,
  recoveringTransitionsTotal: 0,
  normalTransitionsTotal: 0,
})

export const adaptiveTotals = ref<AdaptiveMetricsCounters>(emptyRates())
export const adaptiveTotalsRates = ref<AdaptiveMetricsCounters>(emptyRates())

type GroupSocket = {
  close: () => void
  stopWatch: WatchStopHandle
}

const sockets = new Map<string, GroupSocket>()
let started = false

const counterKeys = Object.keys(emptyRates()) as (keyof AdaptiveMetricsCounters)[]

const sumCounters = (items: AdaptiveMetricsCounters[]): AdaptiveMetricsCounters => {
  const sum = emptyRates()
  for (const item of items) {
    for (const key of counterKeys) {
      sum[key] += item[key] || 0
    }
  }
  return sum
}

const diffCounters = (
  curr: AdaptiveMetricsCounters,
  prev: AdaptiveMetricsCounters | undefined,
): AdaptiveMetricsCounters => {
  const rates = emptyRates()
  if (!prev) return rates

  for (const key of counterKeys) {
    if (curr[key] < prev[key]) {
      return rates
    }
  }

  for (const key of counterKeys) {
    rates[key] = Math.max(0, curr[key] - prev[key])
  }
  return rates
}

const recomputeAggregates = (updatedGroup: string, groupRate: AdaptiveMetricsCounters) => {
  const snapshots = Object.values(adaptiveSnapshots.value)
  adaptiveTotals.value = sumCounters(snapshots.map((s) => s.totals))

  // 本帧仅更新组贡献增量；其它组本帧为 0
  adaptiveTotalsRates.value = groupRate
  void updatedGroup
  adaptiveConnected.value = snapshots.length > 0
  adaptiveLoading.value = false
}

const applySnapshot = (snapshot: AdaptiveMetricsSnapshot) => {
  const group = snapshot.group
  const prev = previousTotalsByGroup.value[group]
  const groupRate = diffCounters(snapshot.totals, prev)

  adaptiveSnapshots.value = {
    ...adaptiveSnapshots.value,
    [group]: snapshot,
  }
  previousTotalsByGroup.value = {
    ...previousTotalsByGroup.value,
    [group]: { ...snapshot.totals },
  }

  recomputeAggregates(group, groupRate)
}

const buildQuery = (): AdaptiveMetricsQuery => {
  const query: AdaptiveMetricsQuery = { interval: '1000' }
  const target = adaptiveTargetFilter.value.trim()
  const node = adaptiveNodeFilter.value.trim()
  if (target) query.target = target
  if (node) query.node = node
  return query
}

const closeGroupSocket = (group: string) => {
  const sock = sockets.get(group)
  if (!sock) return
  sock.stopWatch()
  sock.close()
  sockets.delete(group)
}

const teardownAllSockets = () => {
  for (const group of [...sockets.keys()]) {
    closeGroupSocket(group)
  }
  adaptiveConnected.value = false
}

const connectGroup = (group: string) => {
  closeGroupSocket(group)
  if (!started || !group) return

  const ws = createAdaptiveMetricsWebSocket(group, buildQuery())
  const stopWatch = watch(
    ws.data,
    (data) => {
      if (!data) return
      applySnapshot(data)
    },
    { immediate: true },
  )

  sockets.set(group, {
    close: ws.close,
    stopWatch,
  })
}

const syncSocketsToGroups = () => {
  const groups = adaptiveWeightedGroups.value
  const wanted = new Set(groups)

  for (const group of [...sockets.keys()]) {
    if (!wanted.has(group)) {
      closeGroupSocket(group)
      const nextSnapshots = { ...adaptiveSnapshots.value }
      delete nextSnapshots[group]
      adaptiveSnapshots.value = nextSnapshots
      const nextPrev = { ...previousTotalsByGroup.value }
      delete nextPrev[group]
      previousTotalsByGroup.value = nextPrev
    }
  }

  for (const group of groups) {
    if (!sockets.has(group)) {
      connectGroup(group)
    }
  }

  if (!groups.length) {
    adaptiveSnapshots.value = {}
    previousTotalsByGroup.value = {}
    adaptiveTotals.value = emptyRates()
    adaptiveTotalsRates.value = emptyRates()
    adaptiveConnected.value = false
  }
}

const reconnectAll = () => {
  if (!started) return
  previousTotalsByGroup.value = {}
  const groups = [...adaptiveWeightedGroups.value]
  teardownAllSockets()
  for (const group of groups) {
    connectGroup(group)
  }
}

const reconnectAllDebounced = debounce(reconnectAll, 400)

export const stopAdaptive = () => {
  started = false
  reconnectAllDebounced.cancel()
  teardownAllSockets()
  adaptiveSnapshots.value = {}
  previousTotalsByGroup.value = {}
  adaptiveTotals.value = emptyRates()
  adaptiveTotalsRates.value = emptyRates()
  adaptiveLoading.value = false
}

export const refreshAdaptiveOnce = async () => {
  const groups = adaptiveWeightedGroups.value
  if (!groups.length) return
  adaptiveLoading.value = true
  try {
    await Promise.all(
      groups.map(async (group) => {
        const { data } = await fetchAdaptiveMetricsAPI(group, buildQuery())
        applySnapshot(data)
      }),
    )
  } catch {
    adaptiveLoading.value = false
  }
}

export const initAdaptive = () => {
  if (!adaptiveWeightedGroups.value.length) {
    stopAdaptive()
    return
  }

  started = true
  previousTotalsByGroup.value = {}
  adaptiveLoading.value = true
  syncSocketsToGroups()
}

export const restartAdaptive = () => {
  if (!started) {
    initAdaptive()
    return
  }
  if (!adaptiveWeightedGroups.value.length) {
    stopAdaptive()
    return
  }
  reconnectAll()
}

watch(adaptiveWeightedGroups, (groups) => {
  if (!started) return
  if (!groups.length) {
    stopAdaptive()
    return
  }
  syncSocketsToGroups()
})

watch([adaptiveTargetFilter, adaptiveNodeFilter], () => {
  if (!started) return
  reconnectAllDebounced()
})

export const adaptiveSnapshotList = computed(() => Object.values(adaptiveSnapshots.value))

export const adaptiveHasSnapshots = computed(() => adaptiveSnapshotList.value.length > 0)

export const adaptiveTargetRows = computed<AdaptiveTargetRow[]>(() => {
  const rows: AdaptiveTargetRow[] = []
  for (const snapshot of adaptiveSnapshotList.value) {
    for (const target of snapshot.targets) {
      rows.push({ ...target, group: snapshot.group })
    }
  }
  rows.sort((a, b) => {
    const g = a.group.localeCompare(b.group)
    if (g !== 0) return g
    return a.key.localeCompare(b.key)
  })
  return rows
})

export const adaptiveObservedRows = computed<AdaptiveObservedRow[]>(() => {
  const rows: AdaptiveObservedRow[] = []
  for (const snapshot of adaptiveSnapshotList.value) {
    for (const item of snapshot.observedTargets) {
      rows.push({ ...item, group: snapshot.group })
    }
  }
  rows.sort((a, b) => {
    const g = a.group.localeCompare(b.group)
    if (g !== 0) return g
    return a.key.localeCompare(b.key)
  })
  return rows
})

/** 单组时返回该快照；多组时返回 null（Summary 走汇总模式）。 */
export const adaptiveSingleSnapshot = computed(() => {
  const list = adaptiveSnapshotList.value
  return list.length === 1 ? list[0] : null
})
