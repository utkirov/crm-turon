<script setup lang="ts">
withDefaults(defineProps<{ n?: number; cols?: number }>(), { n: 5, cols: 4 })
</script>

<template>
  <div class="space-y-2 w-full">
    <div
      v-for="i in n"
      :key="i"
      class="flex gap-3 items-center p-3 rounded-xl bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10"
    >
      <div class="skeleton w-8 h-8 rounded-lg shrink-0" />
      <div class="flex-1 flex gap-3">
        <div
          v-for="c in cols"
          :key="c"
          class="skeleton h-4 rounded"
          :class="c === 1 ? 'flex-[2]' : 'flex-1'"
          :style="{ opacity: 1 - (c - 1) * 0.15 }"
        />
      </div>
    </div>
  </div>
</template>
