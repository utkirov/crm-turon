<script setup lang="ts">
defineProps<{
  icon: string
  iconColor?: string
  iconBg?: string
  label: string
  value: string
  delta?: string
  deltaPositive?: boolean
  loading?: boolean
}>()
</script>

<template>
  <div class="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-5 stat-card">
    <div class="flex items-start justify-between mb-3">
      <div
        class="w-10 h-10 rounded-xl flex items-center justify-center"
        :class="iconBg ?? 'bg-blue-100 dark:bg-blue-500/20'"
      >
        <UIcon :name="icon" class="w-5 h-5" :class="iconColor ?? 'text-blue-600 dark:text-blue-400'" />
      </div>
      <span
        v-if="delta"
        class="text-xs font-medium px-2 py-0.5 rounded-full"
        :class="deltaPositive
          ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
          : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'"
      >
        {{ delta }}
      </span>
    </div>
    <div v-if="loading" class="skeleton h-6 w-24 rounded mb-1" />
    <p v-else class="text-xl font-bold text-gray-900 dark:text-white leading-tight">{{ value }}</p>
    <p class="text-xs text-gray-500 dark:text-white/50 mt-1">{{ label }}</p>
  </div>
</template>
