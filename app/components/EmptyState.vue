<script setup lang="ts">
defineProps<{
  icon?: string
  title: string
  description?: string
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center py-16 px-4 text-center">
    <div class="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-4">
      <UIcon :name="icon ?? 'i-ph-inbox'" class="w-7 h-7 text-gray-400 dark:text-white/30" />
    </div>
    <p class="text-sm font-medium text-gray-700 dark:text-white/70">{{ title }}</p>
    <p v-if="description" class="text-xs text-gray-500 dark:text-white/40 mt-1 max-w-xs">{{ description }}</p>
    <div v-if="$slots.default" class="mt-4">
      <slot />
    </div>
  </div>
</template>
