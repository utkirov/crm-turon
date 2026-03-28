<script setup lang="ts">
import type { CrmProject } from '~/types/crm'
import { fmtMoneyM, fmtMoney } from '~/utils/money'
import { isOverdue, daysUntil } from '~/utils/date'

const props = defineProps<{
  project: CrmProject
  compact?: boolean
}>()

const TYPE_ICONS: Record<string, string> = {
  residential:    'i-ph-buildings',
  commercial:     'i-ph-building-office',
  educational:    'i-ph-graduation-cap',
  infrastructure: 'i-ph-road-horizon',
}

const TYPE_LABELS: Record<string, string> = {
  residential:    'Жилой',
  commercial:     'Коммерческий',
  educational:    'Образование',
  infrastructure: 'Инфраструктура',
}

const progress = computed(() => {
  const tasks = props.project.tasks
  if (!tasks.length) return 0
  const done = tasks.filter(t => t.status === 'done').length
  return Math.round(done / tasks.length * 100)
})

const overdueCount = computed(() => {
  return props.project.tasks.filter(t =>
    t.status !== 'done' && isOverdue(t.deadline)
  ).length
})

const taskCount = computed(() => props.project.tasks.length)

const statusConfig: Record<string, { label: string; color: string }> = {
  active:    { label: 'Активен',   color: 'success' },
  on_hold:   { label: 'На паузе', color: 'warning' },
  completed: { label: 'Завершён', color: 'neutral' },
}
</script>

<template>
  <div
    class="kanban-card bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-4 cursor-pointer group transition-all duration-200 hover:border-blue-400/50 dark:hover:border-blue-400/30 hover:shadow-lg"
    @click="navigateTo('/pm/projects?id=' + project.id)"
  >
    <!-- Header -->
    <div class="flex items-start gap-2 mb-3">
      <div class="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center shrink-0 group-hover:bg-blue-200 dark:group-hover:bg-blue-500/30 transition-colors">
        <UIcon :name="TYPE_ICONS[project.type] ?? 'i-ph-buildings'" class="w-4 h-4 text-blue-600 dark:text-blue-400" />
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2 leading-snug">{{ project.name }}</p>
        <p class="text-xs text-gray-500 dark:text-white/40 truncate mt-0.5">{{ project.client }}</p>
      </div>
    </div>

    <!-- Progress -->
    <div class="mb-3">
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs text-gray-500 dark:text-white/40">Прогресс</span>
        <span class="text-xs font-medium text-gray-700 dark:text-white/70">{{ progress }}%</span>
      </div>
      <div class="h-1.5 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
        <div
          class="h-full rounded-full transition-all duration-500"
          :class="progress >= 100 ? 'bg-green-500' : 'bg-blue-500'"
          :style="{ width: progress + '%' }"
        />
      </div>
    </div>

    <!-- Footer -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="text-xs font-semibold text-gray-800 dark:text-white/80">{{ fmtMoneyM(project.contractAmount) }}</span>
        <span v-if="overdueCount > 0" class="flex items-center gap-1 text-xs text-red-500">
          <UIcon name="i-ph-clock-countdown" class="w-3.5 h-3.5" />
          {{ overdueCount }}
        </span>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="text-xs text-gray-400 dark:text-white/30">{{ taskCount }} задач</span>
        <UBadge :color="(statusConfig[project.status]?.color ?? 'neutral') as any" size="xs" variant="subtle">
          {{ statusConfig[project.status]?.label ?? project.status }}
        </UBadge>
      </div>
    </div>
  </div>
</template>
