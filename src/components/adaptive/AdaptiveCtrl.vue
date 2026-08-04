<template>
  <CtrlsBar>
    <div class="flex flex-col gap-2 p-2 md:flex-row md:items-center md:gap-3">
      <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <TextInput
          v-model="adaptiveTargetFilter"
          class="w-44 md:w-56"
          clearable
          :placeholder="$t('adaptiveTargetFilter')"
        />
        <TextInput
          v-model="adaptiveNodeFilter"
          class="w-36 md:w-44"
          clearable
          :placeholder="$t('adaptiveNodeFilter')"
        />
      </div>

      <div class="flex items-center gap-2">
        <span
          class="badge badge-sm gap-1"
          :class="adaptiveConnected ? 'badge-success' : 'badge-ghost'"
        >
          <span
            class="inline-block size-1.5 rounded-full"
            :class="adaptiveConnected ? 'bg-success-content' : 'bg-base-content/40'"
          />
          {{ adaptiveConnected ? $t('adaptiveLive') : $t('adaptiveConnecting') }}
        </span>
        <button
          class="btn btn-sm btn-ghost"
          :class="{ 'btn-disabled': adaptiveLoading }"
          :title="$t('refresh')"
          @click="onRefresh"
        >
          <ArrowPathIcon
            class="h-4 w-4"
            :class="{ 'animate-spin': adaptiveLoading }"
          />
        </button>
      </div>
    </div>
  </CtrlsBar>
</template>

<script setup lang="ts">
import CtrlsBar from '@/components/common/CtrlsBar.vue'
import TextInput from '@/components/common/TextInput.vue'
import { fetchProxies } from '@/assembly/proxies'
import {
  adaptiveConnected,
  adaptiveLoading,
  adaptiveNodeFilter,
  adaptiveTargetFilter,
  refreshAdaptiveOnce,
} from '@/store/adaptive'
import { ArrowPathIcon } from '@heroicons/vue/24/outline'

const onRefresh = async () => {
  await fetchProxies()
  await refreshAdaptiveOnce()
}
</script>
