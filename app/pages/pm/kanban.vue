<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import { useCrmStore } from '~/stores/useCrmStore'
import { useAuthStore } from '~/stores/useAuthStore'
import dayjs from 'dayjs'
import { fmtMoneyM } from '~/utils/money'
import { STAGE_ICONS } from '~/constants/taskCatalog'
import type { CrmProject, DesignStage } from '~/types/crm'

definePageMeta({ layout: 'default', middleware: ['auth', 'role'] })

const auth = useAuthStore()
const crm  = useCrmStore()

const today = dayjs().format('YYYY-MM-DD')

// ── Source projects ────────────────────────────────────────────────────────────
const allProjects = computed(() =>
  auth.currentUser ? crm.projectsByPm(auth.currentUser.id) : crm.projects
)

// ── Filters ────────────────────────────────────────────────────────────────────
const filterSearch    = ref('')
const filterType      = ref('')
const hideCompleted   = ref(false)

type SortMode = 'amount' | 'deadline' | 'progress'
const colSort = ref<SortMode>('amount')

const TYPE_OPTIONS = [
  { value: '', label: 'Все типы' },
  { value: 'residential',    label: 'Жилой' },
  { value: 'commercial',     label: 'Коммерческий' },
  { value: 'educational',    label: 'Образование' },
  { value: 'infrastructure', label: 'Инфраструктура' },
]

const SORT_OPTIONS = [
  { value: 'amount',   label: 'По сумме' },
  { value: 'deadline', label: 'По сроку' },
  { value: 'progress', label: 'По прогрессу' },
]

const filteredProjects = computed(() => {
  let list = allProjects.value
  const q = filterSearch.value.toLowerCase()
  if (q)             list = list.filter(p => p.name.toLowerCase().includes(q) || p.client.toLowerCase().includes(q))
  if (filterType.value) list = list.filter(p => p.type === filterType.value)
  if (hideCompleted.value) list = list.filter(p => p.status !== 'completed')
  return list
})

// ── Stage detection ────────────────────────────────────────────────────────────
const STAGE_ORDER: DesignStage[] = ['sketch', 'working', 'expertise', 'construction']

function getProjectStage(p: CrmProject): DesignStage | 'completed' {
  if (p.status === 'completed') return 'completed'
  for (const stage of STAGE_ORDER) {
    const stageTasks = p.tasks.filter(t => t.stage === stage)
    if (stageTasks.length > 0 && stageTasks.some(t => t.status !== 'done')) return stage
  }
  for (const stage of [...STAGE_ORDER].reverse()) {
    if (p.tasks.some(t => t.stage === stage)) return stage
  }
  return 'sketch'
}

// ── Sort within column ─────────────────────────────────────────────────────────
function progress(p: CrmProject) {
  if (!p.tasks.length) return 0
  return Math.round(p.tasks.filter(t => t.status === 'done').length / p.tasks.length * 100)
}

function nearestDeadline(p: CrmProject): string {
  const dates = p.tasks.filter(t => t.status !== 'done' && t.deadline).map(t => t.deadline!)
  return dates.sort()[0] ?? '9999'
}

function sortProjects(list: CrmProject[]): CrmProject[] {
  return [...list].sort((a, b) => {
    if (colSort.value === 'amount')   return b.contractAmount - a.contractAmount
    if (colSort.value === 'deadline') return nearestDeadline(a).localeCompare(nearestDeadline(b))
    if (colSort.value === 'progress') return progress(b) - progress(a)
    return 0
  })
}

// ── Kanban columns ─────────────────────────────────────────────────────────────
const COLUMNS = [
  { key: 'sketch',       label: 'Эскизный',      icon: STAGE_ICONS['sketch'],       dot: 'bg-violet-400' },
  { key: 'working',      label: 'Рабочий',        icon: STAGE_ICONS['working'],      dot: 'bg-blue-400'   },
  { key: 'expertise',    label: 'Экспертиза',     icon: STAGE_ICONS['expertise'],    dot: 'bg-amber-400'  },
  { key: 'construction', label: 'Строительство',  icon: STAGE_ICONS['construction'], dot: 'bg-orange-400' },
  { key: 'completed',    label: 'Завершён',       icon: 'i-ph-check-circle',         dot: 'bg-green-400'  },
] as const

type ColKey = (typeof COLUMNS)[number]['key']

// Local mutable column data (for drag&drop)
const localColumns = ref<Record<string, CrmProject[]>>({})

watch(filteredProjects, (projects) => {
  const cols: Record<string, CrmProject[]> = {}
  for (const col of COLUMNS) cols[col.key] = []
  for (const p of projects) {
    const stage = getProjectStage(p)
    cols[stage]?.push(p)
  }
  for (const key of Object.keys(cols)) {
    cols[key] = sortProjects(cols[key] ?? [])
  }
  localColumns.value = cols
}, { immediate: true })

watch(colSort, () => {
  for (const key of Object.keys(localColumns.value)) {
    localColumns.value[key] = sortProjects(localColumns.value[key] ?? [])
  }
})

const columns = computed(() =>
  COLUMNS.map(col => ({
    ...col,
    projects: localColumns.value[col.key] ?? [],
    total: (localColumns.value[col.key] ?? []).reduce((s, p) => s + p.contractAmount, 0),
  }))
)

// ── Drag handlers ──────────────────────────────────────────────────────────────
async function onDrop(colKey: ColKey, event: any) {
  const project = event.data as CrmProject
  if (!project?.id) return
  const newStatus = colKey === 'completed' ? 'completed' : project.status === 'completed' ? 'active' : project.status
  if (newStatus !== project.status) {
    await crm.updateProjectStatus(project.id, newStatus as any)
  }
}

// ── Card helpers ───────────────────────────────────────────────────────────────
const TYPE_ICONS: Record<string, string> = {
  residential: 'i-ph-house', commercial: 'i-ph-buildings',
  educational: 'i-ph-graduation-cap', infrastructure: 'i-ph-bank',
}

function overdueCount(p: CrmProject) {
  return p.tasks.filter(t => t.status !== 'done' && !!t.deadline && t.deadline < today).length
}

const STATUS_COLOR: Record<string, string> = {
  active:    'text-green-600 bg-green-50 dark:bg-green-950 border-green-100 dark:border-green-900',
  on_hold:   'text-amber-600 bg-amber-50 dark:bg-amber-950 border-amber-100 dark:border-amber-900',
  completed: 'text-blue-600  bg-blue-50  dark:bg-blue-950  border-blue-100  dark:border-blue-900',
}
const STATUS_LABEL: Record<string, string> = {
  active: 'Активен', on_hold: 'На паузе', completed: 'Завершён',
}

// ── Mobile active column ───────────────────────────────────────────────────────
const mobileCol = ref<ColKey>('sketch')
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">

    <!-- Header -->
    <header class="flex items-center justify-between px-6 py-3 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 flex-shrink-0 gap-4 flex-wrap">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 bg-gradient-to-br from-blue-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
          <UIcon name="i-ph-kanban" class="text-white w-5 h-5" />
        </div>
        <div>
          <h1 class="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Kanban проектов</h1>
          <p class="text-xs text-slate-400">{{ filteredProjects.length }} из {{ allProjects.length }} проектов</p>
        </div>
      </div>

      <!-- Filters toolbar -->
      <div class="flex items-center gap-2 flex-wrap">
        <UInput
          v-model="filterSearch"
          icon="i-ph-magnifying-glass"
          placeholder="Поиск..."
          size="sm"
          class="w-44"
        />
        <USelect
          v-model="filterType"
          :items="TYPE_OPTIONS"
          value-key="value"
          label-key="label"
          size="sm"
          class="w-40"
        />
        <USelect
          v-model="colSort"
          :items="SORT_OPTIONS"
          value-key="value"
          label-key="label"
          size="sm"
          class="w-36"
        />
        <UButton
          :variant="hideCompleted ? 'solid' : 'ghost'"
          :color="hideCompleted ? 'primary' : 'neutral'"
          size="sm"
          icon="i-ph-eye-slash"
          @click="hideCompleted = !hideCompleted"
        >
          Завершённые
        </UButton>
        <UButton to="/pm/create" icon="i-ph-plus" size="sm" color="primary" variant="soft">
          Новый проект
        </UButton>
      </div>
    </header>

    <!-- Mobile column tabs -->
    <div class="md:hidden flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
      <button
        v-for="col in columns"
        :key="col.key"
        class="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors"
        :class="mobileCol === col.key
          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
          : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'"
        @click="mobileCol = col.key as ColKey"
      >
        <div class="w-1.5 h-1.5 rounded-full" :class="col.dot" />
        {{ col.label }}
        <span class="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1 rounded-full text-[10px]">
          {{ col.projects.length }}
        </span>
      </button>
    </div>

    <!-- Loading skeleton -->
    <div v-if="crm._loading" class="flex-1 overflow-x-auto overflow-y-hidden">
      <div class="flex h-full gap-3 p-4 min-w-max">
        <div v-for="col in COLUMNS" :key="col.key" class="flex flex-col w-64 shrink-0 gap-2">
          <div class="skeleton h-6 w-32 rounded-lg mb-1" />
          <div v-for="i in 3" :key="i" class="skeleton h-28 rounded-2xl" />
        </div>
      </div>
    </div>

    <!-- Board -->
    <div v-else class="flex-1 overflow-x-auto overflow-y-hidden">
      <div
        class="flex h-full gap-3 p-4"
        :class="'min-w-max md:min-w-0'"
        style="scroll-snap-type: x mandatory;"
      >
        <div
          v-for="col in columns"
          :key="col.key"
          class="flex flex-col shrink-0 w-64"
          :class="{ 'hidden md:flex': mobileCol !== col.key }"
          style="scroll-snap-align: start;"
        >
          <!-- Column header -->
          <div class="flex items-center gap-2 mb-2 px-1">
            <div class="w-2.5 h-2.5 rounded-full shrink-0" :class="col.dot" />
            <UIcon :name="col.icon" class="w-4 h-4 text-slate-400" />
            <span class="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
              {{ col.label }}
            </span>
            <span class="ml-auto text-xs font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full">
              {{ col.projects.length }}
            </span>
          </div>
          <!-- Column total -->
          <div v-if="col.projects.length > 0" class="px-1 mb-2">
            <p class="text-[11px] text-slate-400">Итого: <span class="font-semibold text-slate-600 dark:text-slate-300">{{ fmtMoneyM(col.total) }}</span></p>
          </div>

          <!-- Draggable cards -->
          <VueDraggable
            v-model="localColumns[col.key]!"
            group="projects"
            class="flex-1 overflow-y-auto space-y-2.5 pr-0.5 min-h-[80px]"
            ghost-class="opacity-40"
            chosen-class="scale-[1.02] shadow-xl"
            drag-class="cursor-grabbing"
            @add="(e: any) => onDrop(col.key, e)"
          >
            <button
              v-for="p in localColumns[col.key]"
              :key="p.id"
              class="w-full text-left bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 shadow-sm hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800 transition-all group cursor-grab active:cursor-grabbing"
              @click="navigateTo(`/pm/projects?id=${p.id}`)"
            >
              <!-- Project name -->
              <div class="flex items-start gap-2 mb-2">
                <div class="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 group-hover:bg-blue-50 dark:group-hover:bg-blue-950 transition-colors">
                  <UIcon :name="TYPE_ICONS[p.type] ?? 'i-ph-buildings'" class="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-500" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-tight line-clamp-2">
                    {{ p.name }}
                  </p>
                  <p class="text-xs text-slate-400 truncate mt-0.5">{{ p.client }}</p>
                </div>
              </div>

              <!-- Progress bar -->
              <div v-if="p.tasks.length > 0" class="mb-2">
                <div class="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>{{ p.tasks.filter((t: any) => t.status === 'done').length }}/{{ p.tasks.length }} задач</span>
                  <span>{{ progress(p) }}%</span>
                </div>
                <div class="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all"
                    :class="progress(p) === 100 ? 'bg-green-500' : 'bg-blue-500'"
                    :style="{ width: progress(p) + '%' }"
                  />
                </div>
              </div>

              <!-- Footer row -->
              <div class="flex items-center justify-between gap-1.5 mt-2">
                <span class="text-xs font-medium text-slate-500">
                  {{ fmtMoneyM(p.contractAmount) }}
                </span>
                <div class="flex items-center gap-1.5">
                  <div v-if="overdueCount(p) > 0" class="flex items-center gap-0.5">
                    <UIcon name="i-ph-warning" class="w-3 h-3 text-red-500" />
                    <span class="text-xs text-red-500 font-medium">{{ overdueCount(p) }}</span>
                  </div>
                  <span
                    class="text-xs font-medium px-1.5 py-0.5 rounded-md border"
                    :class="STATUS_COLOR[p.status]"
                  >
                    {{ STATUS_LABEL[p.status] }}
                  </span>
                </div>
              </div>
            </button>

            <!-- Empty column -->
            <div
              v-if="(localColumns[col.key] ?? []).length === 0"
              class="flex flex-col items-center justify-center py-8 text-slate-300 dark:text-slate-600 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl"
            >
              <UIcon :name="col.icon" class="w-7 h-7 mb-2" />
              <p class="text-xs">Нет проектов</p>
            </div>
          </VueDraggable>
        </div>
      </div>
    </div>

  </div>
</template>
