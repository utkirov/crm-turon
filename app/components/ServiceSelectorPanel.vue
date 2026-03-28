<script setup lang="ts">
import {
  STAGES, STAGE_SHORT_LABELS, STAGE_ICONS,
  ROLE_LABELS, ROLE_ICONS,
  getTasksByStageAndRole, getRolesForStage,
} from '~/constants/taskCatalog'
import type { DesignStage, StageRole } from '~/types/crm'

// Shared logic extracted from pm/create.vue step 2 — reused in pm/projects.vue "add services"

interface SelectedTask { deadline: string }

const activeStage = ref<DesignStage>('sketch')
const activeRole  = ref<StageRole | null>(null)

// { catalogTaskId → { deadline: string } }
const selectedTasks = reactive<Record<string, SelectedTask>>({})

watch(activeStage, () => { activeRole.value = null })

const rolesForActiveStage = computed(() => getRolesForStage(activeStage.value))

const tasksForActiveSelection = computed(() => {
  if (!activeRole.value) return []
  return getTasksByStageAndRole(activeStage.value).get(activeRole.value) ?? []
})

function selectedCountForRole(stage: DesignStage, role: StageRole): number {
  return (getTasksByStageAndRole(stage).get(role) ?? []).filter(t => !!selectedTasks[t.id]).length
}

function selectedCountForStage(stage: DesignStage): number {
  let total = 0
  for (const role of getRolesForStage(stage)) {
    total += selectedCountForRole(stage, role)
  }
  return total
}

function toggleTask(taskId: string) {
  if (selectedTasks[taskId]) {
    delete selectedTasks[taskId]
  } else {
    selectedTasks[taskId] = { deadline: '' }
  }
}

function reset() {
  for (const key of Object.keys(selectedTasks)) delete selectedTasks[key]
  activeStage.value = 'sketch'
  activeRole.value  = null
}

// Expose for parent
defineExpose({ selectedTasks, reset })
</script>

<template>
  <div class="flex gap-3 min-h-72 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden p-4">

    <!-- Col 1: Stage selector -->
    <div class="w-44 shrink-0">
      <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 px-1">1. Этап ПСД</p>
      <div class="space-y-1">
        <button
          v-for="stage in STAGES" :key="stage"
          @click="activeStage = stage"
          class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-sm transition-colors"
          :class="activeStage === stage
            ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-medium border border-blue-200 dark:border-blue-800'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'"
        >
          <UIcon :name="STAGE_ICONS[stage]" class="w-4 h-4 shrink-0" />
          <span class="flex-1 leading-tight text-xs">{{ STAGE_SHORT_LABELS[stage] }}</span>
          <span v-if="selectedCountForStage(stage) > 0"
            class="text-xs font-semibold text-blue-600 dark:text-blue-400 shrink-0">
            {{ selectedCountForStage(stage) }}
          </span>
        </button>
      </div>
    </div>

    <!-- Divider -->
    <div class="w-px bg-slate-200 dark:bg-slate-700 self-stretch" />

    <!-- Col 2: Role selector -->
    <div class="w-40 shrink-0">
      <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 px-1">2. Специалист</p>
      <div v-if="rolesForActiveStage.length === 0" class="px-2 py-3 text-xs text-slate-400 italic">
        Нет задач в этом этапе
      </div>
      <div v-else class="space-y-1">
        <button
          v-for="role in rolesForActiveStage" :key="role"
          @click="activeRole = role"
          class="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-left text-sm transition-colors"
          :class="activeRole === role
            ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-medium border border-indigo-200 dark:border-indigo-800'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'"
        >
          <UIcon :name="ROLE_ICONS[role]" class="w-4 h-4 shrink-0 text-slate-400" />
          <span class="flex-1 text-xs leading-tight">{{ ROLE_LABELS[role] }}</span>
          <span v-if="selectedCountForRole(activeStage, role) > 0"
            class="text-xs font-semibold text-indigo-600 dark:text-indigo-400 shrink-0">
            {{ selectedCountForRole(activeStage, role) }}
          </span>
        </button>
      </div>
    </div>

    <!-- Divider -->
    <div class="w-px bg-slate-200 dark:bg-slate-700 self-stretch" />

    <!-- Col 3: Tasks -->
    <div class="flex-1 min-w-0">
      <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 px-1">3. Задачи</p>

      <div v-if="!activeRole" class="flex flex-col items-center justify-center py-10 text-slate-400">
        <UIcon name="i-ph-arrow-left" class="w-6 h-6 mb-2 opacity-40" />
        <p class="text-sm">Выберите специалиста</p>
      </div>

      <div v-else class="space-y-1.5">
        <div v-if="tasksForActiveSelection.length === 0" class="px-2 py-3 text-xs text-slate-400 italic">
          Нет задач для этого специалиста
        </div>
        <div
          v-for="task in tasksForActiveSelection" :key="task.id"
          class="flex items-start gap-3 px-3 py-2.5 rounded-xl border transition-colors cursor-pointer"
          :class="selectedTasks[task.id]
            ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800'
            : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'"
          @click="toggleTask(task.id)"
        >
          <UCheckbox
            :model-value="!!selectedTasks[task.id]"
            @update:model-value="toggleTask(task.id)"
            @click.stop
            class="mt-0.5 shrink-0"
          />
          <div class="flex-1 min-w-0">
            <p class="text-sm text-slate-700 dark:text-slate-300 leading-snug">{{ task.name }}</p>
            <p v-if="task.defaultDays && !selectedTasks[task.id]" class="text-xs text-slate-400 mt-0.5">
              {{ task.defaultDays }} дн.
            </p>
          </div>
          <div v-if="selectedTasks[task.id]" class="flex items-center gap-1.5 shrink-0" @click.stop>
            <UIcon name="i-ph-calendar" class="w-3.5 h-3.5 text-slate-400" />
            <UInput type="date" v-model="selectedTasks[task.id].deadline" size="xs" class="w-36" />
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Summary bar -->
  <div v-if="Object.keys(selectedTasks).length > 0"
    class="mt-3 px-4 py-2.5 bg-blue-50 dark:bg-blue-950 rounded-xl flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
    <UIcon name="i-ph-check-circle" class="w-4 h-4 shrink-0" />
    Выбрано <strong class="mx-1">{{ Object.keys(selectedTasks).length }}</strong> задач
  </div>
</template>
