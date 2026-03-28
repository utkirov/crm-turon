<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import { useAuthStore } from '~/stores/useAuthStore'
import { useCrmStore } from '~/stores/useCrmStore'
import { STAGE_SHORT_LABELS, STAGE_ICONS, ROLE_LABELS, ROLE_ICONS } from '~/constants/taskCatalog'
import dayjs from 'dayjs'
import { fmtDate, daysUntil as calcDaysUntil, isOverdue } from '~/utils/date'
import type { ChangeRequest, CrmProject, DesignStage, StageRole } from '~/types/crm'

// Type-safe wrappers for VueDraggable slot where task is any
const stageIcon  = (s: any) => STAGE_ICONS[s as DesignStage]  ?? 'i-ph-circle'
const stageLabel = (s: any) => STAGE_SHORT_LABELS[s as DesignStage] ?? s
const roleIcon   = (r: any) => ROLE_ICONS[r as StageRole]     ?? 'i-ph-circle'
const roleLabel  = (r: any) => ROLE_LABELS[r as StageRole]    ?? r

definePageMeta({ layout: 'default', middleware: ['auth', 'role'] })

const auth = useAuthStore()
const crm  = useCrmStore()

const staffId = computed(() => auth.currentUser?.id ?? '')
const today   = dayjs().format('YYYY-MM-DD')

// ── Project filter ─────────────────────────────────────────────────────────────
const selectedProjectId = ref<string | null>(null)

// ── Task filter tab ────────────────────────────────────────────────────────────
type FilterMode = 'all' | 'month' | 'overdue'
const filterMode = ref<FilterMode>('all')

const allMyTasks = computed(() => crm.tasksByStaff(staffId.value))

const myProjects = computed(() => {
  const map = new Map<string, { project: CrmProject; count: number }>()
  for (const { project } of allMyTasks.value) {
    if (!map.has(project.id)) map.set(project.id, { project, count: 0 })
    map.get(project.id)!.count++
  }
  return Array.from(map.values())
})

const filteredByProject = computed(() =>
  selectedProjectId.value
    ? allMyTasks.value.filter(({ project }) => project.id === selectedProjectId.value)
    : allMyTasks.value
)

const currentMonth = today.substring(0, 7)

const filteredTasks = computed(() => {
  if (filterMode.value === 'month')   return filteredByProject.value.filter(x => x.task.deadline?.startsWith(currentMonth))
  if (filterMode.value === 'overdue') return filteredByProject.value.filter(x => x.task.status !== 'done' && isOverdue(x.task.deadline))
  return filteredByProject.value
})

// ── Kanban columns ─────────────────────────────────────────────────────────────
const todoTasks       = computed(() => filteredTasks.value.filter(x => x.task.status === 'todo'))
const inProgressTasks = computed(() => filteredTasks.value.filter(x => x.task.status === 'in_progress'))
const doneTasks       = computed(() => filteredTasks.value.filter(x => x.task.status === 'done'))

// Mutable arrays for drag&drop
const localTodo       = ref([...todoTasks.value])
const localInProgress = ref([...inProgressTasks.value])
const localDone       = ref([...doneTasks.value])

watch([todoTasks, inProgressTasks, doneTasks], () => {
  localTodo.value       = [...todoTasks.value]
  localInProgress.value = [...inProgressTasks.value]
  localDone.value       = [...doneTasks.value]
})

const overdueCount = computed(() =>
  allMyTasks.value.filter(({ task }) => task.status !== 'done' && isOverdue(task.deadline)).length
)

// Column overdue counts
const todoOverdue       = computed(() => localTodo.value.filter(x => isOverdue(x.task.deadline)).length)
const inProgressOverdue = computed(() => localInProgress.value.filter(x => isOverdue(x.task.deadline)).length)

// ── Drag handlers ──────────────────────────────────────────────────────────────
async function onDropToCol(newStatus: 'todo' | 'in_progress' | 'done', event: any) {
  const item = event.data as { project: CrmProject; task: { id: string; status: string } } | undefined
  if (!item?.task) return
  if (item.task.status === newStatus) return
  await crm.updateTaskStatus(item.project.id, item.task.id, newStatus)
}

// ── Status helpers ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  todo:        { label: 'В очереди', color: 'neutral', icon: 'i-ph-circle' },
  in_progress: { label: 'В работе',  color: 'blue',    icon: 'i-ph-spinner' },
  done:        { label: 'Готово',    color: 'green',   icon: 'i-ph-check-circle' },
}

function advanceStatus(projectId: string, taskId: string, newStatus: string) {
  crm.updateTaskStatus(projectId, taskId, newStatus as any)
}

// ── Urgency badge ──────────────────────────────────────────────────────────────
function isUrgent(deadline?: string | null, status?: string) {
  if (status === 'done' || !deadline) return false
  const days = calcDaysUntil(deadline)
  return days !== null && days <= 2
}

// ── Notes ──────────────────────────────────────────────────────────────────────
const noteDraft = reactive<Record<string, string>>({})
const showNote  = reactive<Record<string, boolean>>({})

function toggleNote(taskId: string, currentNote?: string) {
  showNote[taskId] = !showNote[taskId]
  if (showNote[taskId] && noteDraft[taskId] === undefined)
    noteDraft[taskId] = currentNote ?? ''
}
function saveNote(projectId: string, taskId: string) {
  crm.updateTaskNote(projectId, taskId, noteDraft[taskId] ?? '')
  showNote[taskId] = false
}

// ── Change requests ────────────────────────────────────────────────────────────
const pendingChanges = computed(() => crm.pendingChangeRequests(staffId.value))
const rejectComment  = reactive<Record<string, string>>({})
const showRejectForm = reactive<Record<string, boolean>>({})

function acceptChange(requestId: string) { crm.approveChange(requestId, staffId.value) }
function toggleRejectForm(requestId: string) { showRejectForm[requestId] = !showRejectForm[requestId] }
function rejectChange(requestId: string) {
  crm.rejectChange(requestId, staffId.value, rejectComment[requestId])
  showRejectForm[requestId] = false
}

function changeLabel(changes: Record<string, { from: unknown; to: unknown }>) {
  return Object.entries(changes).map(([key, val]) => {
    const name = key === 'staffId' ? 'исполнитель' : key === 'deadline' ? 'дедлайн' : key === 'price' ? 'цена' : key
    return `${name}: ${val.from ?? '—'} → ${val.to ?? '—'}`
  }).join(', ')
}

function changeContext(req: ChangeRequest): { projectName: string; taskName: string } | null {
  for (const p of crm.projects) {
    const t = p.tasks.find(tt => tt.id === req.taskId)
    if (t) return { projectName: p.name, taskName: crm.taskMap[t.taskId]?.name ?? t.taskId }
  }
  return null
}

// ── Propose change ─────────────────────────────────────────────────────────────
const proposeModal = reactive({ open: false, projectId: '', taskId: '', reason: '', deadlineTo: '' })

function openProposeModal(projectId: string, taskId: string) {
  Object.assign(proposeModal, { open: true, projectId, taskId, reason: '', deadlineTo: '' })
}

function submitPropose() {
  if (!proposeModal.reason.trim()) return
  const task = crm.projects.find(p => p.id === proposeModal.projectId)?.tasks.find(t => t.id === proposeModal.taskId)
  if (!task) return
  crm.proposeChange(
    proposeModal.projectId, proposeModal.taskId, 'task_change', proposeModal.reason,
    { deadline: { from: task.deadline ?? null, to: proposeModal.deadlineTo || null } },
    staffId.value,
  )
  proposeModal.open = false
}

const FILTER_TABS = [
  { value: 'all',     label: 'Все' },
  { value: 'month',   label: 'Этот месяц' },
  { value: 'overdue', label: 'Просроченные' },
]
</script>

<template>
  <div>
  <div class="flex flex-col h-full overflow-hidden">
    <!-- Header -->
    <header class="flex items-center justify-between px-8 py-3 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 flex-shrink-0 flex-wrap gap-3">
      <div class="flex items-center gap-3">
        <div class="relative">
          <UAvatar :text="auth.currentUser?.initials" size="sm" />
          <span class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-white dark:border-slate-900" />
        </div>
        <div>
          <h1 class="text-lg font-bold text-slate-900 dark:text-white tracking-tight">{{ auth.currentUser?.name }}</h1>
          <p class="text-xs text-slate-400">{{ auth.currentUser?.specialization }}</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <!-- Filter tabs -->
        <div class="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <button
            v-for="tab in FILTER_TABS"
            :key="tab.value"
            class="px-3 py-1.5 text-xs font-medium transition-colors"
            :class="filterMode === tab.value
              ? 'bg-blue-500 text-white'
              : 'bg-white dark:bg-slate-900 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'"
            @click="filterMode = tab.value as FilterMode"
          >
            {{ tab.label }}
          </button>
        </div>
        <UBadge v-if="pendingChanges.length > 0" color="warning" variant="solid" size="sm" icon="i-ph-git-pull-request">
          {{ pendingChanges.length }} запрос{{ pendingChanges.length > 1 ? 'а' : '' }}
        </UBadge>
        <UBadge v-if="overdueCount > 0" color="error" variant="solid" size="sm" icon="i-ph-warning">
          {{ overdueCount }} просроч.
        </UBadge>
        <UBadge color="secondary" variant="soft" icon="i-ph-pencil-ruler" size="sm">Сотрудник</UBadge>
      </div>
    </header>

    <div class="flex-1 overflow-hidden flex">

      <!-- Left panel: projects -->
      <div class="w-52 shrink-0 border-r border-slate-200/80 dark:border-slate-800 overflow-y-auto p-4 bg-white dark:bg-slate-900/80">
        <p class="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.15em] px-2 mb-3">Проекты</p>
        <button
          class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors mb-1"
          :class="!selectedProjectId ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-medium' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'"
          @click="selectedProjectId = null"
        >
          <UIcon name="i-ph-grid-four" class="w-4 h-4 shrink-0" />
          <span class="flex-1 text-left text-xs">Все проекты</span>
          <span class="text-xs font-semibold">{{ allMyTasks.length }}</span>
        </button>
        <EmptyState v-if="myProjects.length === 0" icon="i-ph-tray" title="Нет задач" class="py-4" />
        <button
          v-for="{ project, count } in myProjects"
          :key="project.id"
          class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
          :class="selectedProjectId === project.id ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-medium' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'"
          @click="selectedProjectId = project.id"
        >
          <span class="w-2 h-2 rounded-full shrink-0" :class="project.status === 'active' ? 'bg-green-400' : 'bg-slate-300'" />
          <span class="flex-1 text-left text-xs leading-tight truncate">{{ project.name }}</span>
          <span class="text-xs font-semibold">{{ count }}</span>
        </button>
      </div>

      <!-- Kanban board -->
      <div class="flex-1 overflow-hidden flex flex-col bg-slate-50/50 dark:bg-slate-950/50">

        <!-- Change requests -->
        <div v-if="pendingChanges.length > 0" class="px-6 pt-5 pb-0">
          <div class="flex items-center gap-2 mb-3">
            <UIcon name="i-ph-git-pull-request" class="w-5 h-5 text-orange-500" />
            <h2 class="text-sm font-semibold text-slate-800 dark:text-slate-200">Запросы на изменение</h2>
            <UBadge color="warning" variant="solid" size="xs">{{ pendingChanges.length }}</UBadge>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mb-4">
            <UCard v-for="req in pendingChanges" :key="req.id" :ui="{ body: 'p-4' }" class="border-l-4 border-l-orange-400">
              <div class="flex items-start justify-between gap-3">
                <div class="flex-1 min-w-0">
                  <template v-if="changeContext(req)">
                    <p class="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-0.5">{{ changeContext(req)!.taskName }}</p>
                    <p class="text-xs text-slate-400 mb-1.5">{{ changeContext(req)!.projectName }}</p>
                  </template>
                  <UBadge color="warning" variant="soft" size="xs" icon="i-ph-git-pull-request" class="mb-1">
                    {{ req.type === 'task_change' ? 'Изменение задачи' : 'Изменение цены' }}
                  </UBadge>
                  <p class="text-xs text-slate-600 dark:text-slate-400">{{ changeLabel(req.changes) }}</p>
                  <p class="text-xs text-slate-500 mt-0.5"><span class="font-medium">Причина:</span> {{ req.reason }}</p>
                </div>
                <div class="flex flex-col gap-1.5 shrink-0">
                  <UButton size="sm" color="success" variant="soft" icon="i-ph-check" @click="acceptChange(req.id)">Принять</UButton>
                  <UButton size="sm" color="error" variant="ghost" icon="i-ph-x" @click="toggleRejectForm(req.id)">Отклонить</UButton>
                </div>
              </div>
              <div v-if="showRejectForm[req.id]" class="mt-3 flex gap-2">
                <UInput v-model="rejectComment[req.id]" placeholder="Комментарий" size="sm" class="flex-1" />
                <UButton size="sm" color="error" @click="rejectChange(req.id)">Подтвердить</UButton>
              </div>
            </UCard>
          </div>
          <USeparator class="mb-0" />
        </div>

        <!-- Kanban columns -->
        <div class="flex-1 overflow-x-auto overflow-y-hidden">
          <div class="flex gap-4 p-6 h-full min-w-[700px]">

            <!-- Column: В очереди -->
            <div class="flex-1 min-w-0 flex flex-col">
              <div class="flex items-center gap-2 mb-3 px-1">
                <div class="w-2.5 h-2.5 rounded-full bg-slate-400" />
                <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">В очереди</span>
                <span class="ml-auto text-xs bg-slate-200 dark:bg-slate-800 text-slate-500 font-semibold px-2 py-0.5 rounded-full">{{ localTodo.length }}</span>
                <span v-if="todoOverdue > 0" class="text-xs text-red-500 font-medium">{{ todoOverdue }} просроч.</span>
              </div>
              <VueDraggable
                v-model="localTodo"
                group="tasks"
                class="flex-1 overflow-y-auto space-y-3 pr-1 min-h-[60px]"
                ghost-class="opacity-40"
                @add="(e: any) => onDropToCol('todo', e)"
              >
                <div v-for="{ project, task } in localTodo" :key="task.id">
                  <div
                    class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 transition-all hover:shadow-md cursor-grab active:cursor-grabbing"
                    :class="task.status !== 'done' && isOverdue(task.deadline) ? 'border-l-4 border-l-red-400' : ''"
                  >
                    <div class="flex items-center gap-1.5 mb-2 flex-wrap">
                      <div class="flex items-center gap-1 text-xs text-slate-400">
                        <UIcon :name="stageIcon(task.stage)" class="w-3 h-3" />
                        {{ stageLabel(task.stage) }}
                      </div>
                      <div class="flex items-center gap-1 text-xs text-slate-400">
                        <UIcon :name="roleIcon(task.role)" class="w-3 h-3" />
                        {{ roleLabel(task.role) }}
                      </div>
                      <UBadge v-if="isUrgent(task.deadline, task.status)" color="error" variant="solid" size="xs" class="ml-auto">
                        Срочно
                      </UBadge>
                      <span v-else-if="!selectedProjectId" class="text-xs text-slate-300 dark:text-slate-600 ml-auto truncate max-w-24">{{ project.name }}</span>
                    </div>
                    <p class="font-semibold text-sm text-slate-800 dark:text-slate-200 mb-2 leading-snug">
                      {{ crm.taskMap[task.taskId]?.name ?? task.taskId }}
                    </p>
                    <div v-if="task.deadline" class="flex items-center gap-1.5 mb-2">
                      <UIcon name="i-ph-calendar" class="w-3.5 h-3.5 shrink-0"
                        :class="isOverdue(task.deadline) ? 'text-red-500' : 'text-slate-400'" />
                      <span class="text-xs" :class="isOverdue(task.deadline) ? 'text-red-500 font-semibold' : 'text-slate-500'">
                        {{ fmtDate(task.deadline) }}
                        <span v-if="isOverdue(task.deadline)"> — просрочено</span>
                        <span v-else-if="calcDaysUntil(task.deadline) !== null && calcDaysUntil(task.deadline)! <= 7" class="text-amber-500">
                          — {{ calcDaysUntil(task.deadline) }} дн.
                        </span>
                      </span>
                    </div>
                    <!-- Note -->
                    <div class="mb-3">
                      <button class="flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-500 transition-colors" @click="toggleNote(task.id, task.note)">
                        <UIcon :name="task.note ? 'i-ph-chat-text-fill' : 'i-ph-chat-text'" class="w-3.5 h-3.5" :class="task.note ? 'text-blue-400' : ''" />
                        <span v-if="task.note">{{ task.note.substring(0, 35) }}{{ task.note.length > 35 ? '...' : '' }}</span>
                        <span v-else class="text-slate-300">Заметка</span>
                      </button>
                      <div v-if="showNote[task.id]" class="mt-2 flex gap-2">
                        <UInput v-model="noteDraft[task.id]" placeholder="Заметка..." size="sm" class="flex-1" @keydown.ctrl.enter="saveNote(project.id, task.id)" />
                        <UButton size="sm" color="primary" variant="soft" @click="saveNote(project.id, task.id)">✓</UButton>
                        <UButton size="sm" color="neutral" variant="ghost" @click="showNote[task.id] = false">✕</UButton>
                      </div>
                    </div>
                    <div class="flex gap-2">
                      <UButton size="sm" color="primary" variant="soft" icon="i-ph-play" class="flex-1" @click="advanceStatus(project.id, task.id, 'in_progress')">Взять в работу</UButton>
                      <UButton size="sm" color="neutral" variant="ghost" icon="i-ph-git-pull-request" @click="openProposeModal(project.id, task.id)" />
                    </div>
                  </div>
                </div>
                <EmptyState v-if="localTodo.length === 0" icon="i-ph-tray" title="Нет задач" description="Перетащите задачу сюда" class="py-8" />
              </VueDraggable>
            </div>

            <!-- Column: В работе -->
            <div class="flex-1 min-w-0 flex flex-col">
              <div class="flex items-center gap-2 mb-3 px-1">
                <div class="w-2.5 h-2.5 rounded-full bg-blue-400" />
                <span class="text-xs font-semibold text-blue-500 dark:text-blue-400 uppercase tracking-wide">В работе</span>
                <span class="ml-auto text-xs bg-blue-100 dark:bg-blue-950 text-blue-600 font-semibold px-2 py-0.5 rounded-full">{{ localInProgress.length }}</span>
                <span v-if="inProgressOverdue > 0" class="text-xs text-red-500 font-medium">{{ inProgressOverdue }} просроч.</span>
              </div>
              <VueDraggable
                v-model="localInProgress"
                group="tasks"
                class="flex-1 overflow-y-auto space-y-3 pr-1 min-h-[60px]"
                ghost-class="opacity-40"
                @add="(e: any) => onDropToCol('in_progress', e)"
              >
                <div v-for="{ project, task } in localInProgress" :key="task.id">
                  <div
                    class="bg-white dark:bg-slate-900 border border-blue-200/60 dark:border-blue-800/50 rounded-2xl p-4 transition-all hover:shadow-md cursor-grab active:cursor-grabbing"
                    :class="isOverdue(task.deadline) ? 'border-l-4 border-l-red-400' : ''"
                  >
                    <div class="flex items-center gap-1.5 mb-2 flex-wrap">
                      <div class="flex items-center gap-1 text-xs text-slate-400">
                        <UIcon :name="stageIcon(task.stage)" class="w-3 h-3" />
                        {{ stageLabel(task.stage) }}
                      </div>
                      <div class="flex items-center gap-1 text-xs text-slate-400">
                        <UIcon :name="roleIcon(task.role)" class="w-3 h-3" />
                        {{ roleLabel(task.role) }}
                      </div>
                      <UBadge v-if="isUrgent(task.deadline, task.status)" color="error" variant="solid" size="xs" class="ml-auto">Срочно</UBadge>
                      <span v-else-if="!selectedProjectId" class="text-xs text-slate-300 dark:text-slate-600 ml-auto truncate max-w-24">{{ project.name }}</span>
                    </div>
                    <p class="font-semibold text-sm text-slate-800 dark:text-slate-200 mb-2 leading-snug">
                      {{ crm.taskMap[task.taskId]?.name ?? task.taskId }}
                    </p>
                    <div v-if="task.deadline" class="flex items-center gap-1.5 mb-2">
                      <UIcon name="i-ph-calendar" class="w-3.5 h-3.5 shrink-0" :class="isOverdue(task.deadline) ? 'text-red-500' : 'text-slate-400'" />
                      <span class="text-xs" :class="isOverdue(task.deadline) ? 'text-red-500 font-semibold' : 'text-slate-500'">
                        {{ fmtDate(task.deadline) }}
                        <span v-if="isOverdue(task.deadline)"> — просрочено</span>
                        <span v-else-if="calcDaysUntil(task.deadline) !== null && calcDaysUntil(task.deadline)! <= 7" class="text-amber-500"> — {{ calcDaysUntil(task.deadline) }} дн.</span>
                      </span>
                    </div>
                    <div class="mb-3">
                      <button class="flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-500 transition-colors" @click="toggleNote(task.id, task.note)">
                        <UIcon :name="task.note ? 'i-ph-chat-text-fill' : 'i-ph-chat-text'" class="w-3.5 h-3.5" :class="task.note ? 'text-blue-400' : ''" />
                        <span v-if="task.note">{{ task.note.substring(0, 35) }}{{ task.note.length > 35 ? '...' : '' }}</span>
                        <span v-else class="text-slate-300">Заметка</span>
                      </button>
                      <div v-if="showNote[task.id]" class="mt-2 flex gap-2">
                        <UInput v-model="noteDraft[task.id]" placeholder="Заметка..." size="sm" class="flex-1" @keydown.ctrl.enter="saveNote(project.id, task.id)" />
                        <UButton size="sm" color="primary" variant="soft" @click="saveNote(project.id, task.id)">✓</UButton>
                        <UButton size="sm" color="neutral" variant="ghost" @click="showNote[task.id] = false">✕</UButton>
                      </div>
                    </div>
                    <div class="flex gap-2">
                      <UButton size="sm" color="success" variant="soft" icon="i-ph-check" class="flex-1" @click="advanceStatus(project.id, task.id, 'done')">Завершить</UButton>
                      <UButton size="sm" color="neutral" variant="ghost" icon="i-ph-git-pull-request" @click="openProposeModal(project.id, task.id)" />
                    </div>
                  </div>
                </div>
                <EmptyState v-if="localInProgress.length === 0" icon="i-ph-spinner" title="Нет активных задач" description="Возьмите задачу из очереди" class="py-8" />
              </VueDraggable>
            </div>

            <!-- Column: Готово -->
            <div class="flex-1 min-w-0 flex flex-col">
              <div class="flex items-center gap-2 mb-3 px-1">
                <div class="w-2.5 h-2.5 rounded-full bg-green-400" />
                <span class="text-xs font-semibold text-green-500 dark:text-green-400 uppercase tracking-wide">Готово</span>
                <span class="ml-auto text-xs bg-green-100 dark:bg-green-950 text-green-600 font-semibold px-2 py-0.5 rounded-full">{{ localDone.length }}</span>
              </div>
              <VueDraggable
                v-model="localDone"
                group="tasks"
                class="flex-1 overflow-y-auto space-y-3 pr-1 min-h-[60px]"
                ghost-class="opacity-40"
                @add="(e: any) => onDropToCol('done', e)"
              >
                <div v-for="{ project, task } in localDone" :key="task.id">
                  <div class="bg-white dark:bg-slate-900 border border-green-200/60 dark:border-green-800/50 rounded-2xl p-4 opacity-80 hover:opacity-100 transition-all cursor-grab active:cursor-grabbing">
                    <div class="flex items-center gap-1.5 mb-2 flex-wrap">
                      <div class="flex items-center gap-1 text-xs text-slate-400">
                        <UIcon :name="stageIcon(task.stage)" class="w-3 h-3" />
                        {{ stageLabel(task.stage) }}
                      </div>
                      <div class="flex items-center gap-1 text-xs text-slate-400">
                        <UIcon :name="roleIcon(task.role)" class="w-3 h-3" />
                        {{ roleLabel(task.role) }}
                      </div>
                      <span v-if="!selectedProjectId" class="text-xs text-slate-300 dark:text-slate-600 ml-auto truncate max-w-24">{{ project.name }}</span>
                    </div>
                    <p class="font-semibold text-sm text-slate-600 dark:text-slate-400 mb-2 leading-snug line-through decoration-green-400/60">
                      {{ crm.taskMap[task.taskId]?.name ?? task.taskId }}
                    </p>
                    <div v-if="task.deadline" class="flex items-center gap-1.5">
                      <UIcon name="i-ph-calendar-check" class="w-3.5 h-3.5 text-green-500 shrink-0" />
                      <span class="text-xs text-slate-400">{{ fmtDate(task.deadline) }}</span>
                    </div>
                    <div class="mt-2 flex items-center gap-1.5">
                      <UIcon name="i-ph-check-circle" class="w-3.5 h-3.5 text-green-500" />
                      <span class="text-xs text-green-600 dark:text-green-400 font-medium">Завершено</span>
                    </div>
                  </div>
                </div>
                <EmptyState v-if="localDone.length === 0" icon="i-ph-check-circle" title="Нет завершённых задач" class="py-8" />
              </VueDraggable>
            </div>

          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Propose change modal -->
  <UModal v-model:open="proposeModal.open" title="Предложить изменение">
    <template #body>
      <div class="space-y-4 p-1">
        <UFormField label="Причина изменения" required>
          <UInput v-model="proposeModal.reason" placeholder="Опишите причину..." class="w-full" />
        </UFormField>
        <UFormField label="Новый дедлайн">
          <UInput type="date" v-model="proposeModal.deadlineTo" class="w-full" />
        </UFormField>
        <div class="flex justify-end gap-2 pt-2">
          <UButton color="neutral" variant="ghost" @click="proposeModal.open = false">Отмена</UButton>
          <UButton color="primary" icon="i-ph-paper-plane-right" :disabled="!proposeModal.reason.trim()" @click="submitPropose">
            Отправить запрос
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
  </div>
</template>
