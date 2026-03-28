<script setup lang="ts">
import { useAuthStore } from '~/stores/useAuthStore'
import { useCrmStore } from '~/stores/useCrmStore'
import { STAGE_SHORT_LABELS, STAGE_ICONS, ROLE_LABELS, ROLE_ICONS } from '~/constants/taskCatalog'
import type { ChangeRequest, CrmProject } from '~/types/crm'

definePageMeta({ layout: 'default', middleware: ['auth'] })

const auth = useAuthStore()
const crm  = useCrmStore()

const staffId = computed(() => auth.currentUser?.id ?? '')
const today = new Date().toISOString().split('T')[0]

// ── Left panel: project filter ────────────────────────────────────────────────
const selectedProjectId = ref<string | null>(null)

// ── All tasks ────────────────────────────────────────────────────────────────
const allMyTasks = computed(() => crm.tasksByStaff(staffId.value))

// Unique projects that have tasks assigned to this staff
const myProjects = computed(() => {
  const map = new Map<string, { project: CrmProject; count: number }>()
  for (const { project } of allMyTasks.value) {
    if (!map.has(project.id)) map.set(project.id, { project, count: 0 })
    map.get(project.id)!.count++
  }
  return Array.from(map.values())
})

// ── Filtered by selected project ─────────────────────────────────────────────
const filteredTasks = computed(() => {
  if (!selectedProjectId.value) return allMyTasks.value
  return allMyTasks.value.filter(({ project }) => project.id === selectedProjectId.value)
})

// ── Kanban columns ────────────────────────────────────────────────────────────
const todoTasks       = computed(() => filteredTasks.value.filter(x => x.task.status === 'todo'))
const inProgressTasks = computed(() => filteredTasks.value.filter(x => x.task.status === 'in_progress'))
const doneTasks       = computed(() => filteredTasks.value.filter(x => x.task.status === 'done'))

const overdueCount = computed(() =>
  allMyTasks.value.filter(({ task }) => task.status !== 'done' && isOverdue(task.deadline)).length
)

// ── Date helpers ─────────────────────────────────────────────────────────────
function isOverdue(deadline?: string) {
  return !!deadline && deadline < today
}

function formatDate(d?: string) {
  if (!d) return ''
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d))
}

function daysUntil(d?: string): number | null {
  if (!d) return null
  return Math.ceil((new Date(d).getTime() - new Date(today).getTime()) / 86_400_000)
}

// ── Change requests ───────────────────────────────────────────────────────────
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

// ── Task notes (inline edit) ──────────────────────────────────────────────────
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

// ── Propose change ────────────────────────────────────────────────────────────
const proposeModal = reactive({ open: false, projectId: '', taskId: '', reason: '', deadlineTo: '' })

function openProposeModal(projectId: string, taskId: string) {
  proposeModal.open = true
  proposeModal.projectId = projectId
  proposeModal.taskId = taskId
  proposeModal.reason = ''
  proposeModal.deadlineTo = ''
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

// ── Status helpers ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  todo:        { label: 'В очереди', color: 'neutral', icon: 'i-ph-circle' },
  in_progress: { label: 'В работе',  color: 'blue',    icon: 'i-ph-spinner' },
  done:        { label: 'Готово',    color: 'green',   icon: 'i-ph-check-circle' },
}

function nextStatus(current: string) {
  if (current === 'todo')        return { label: 'Взять в работу', status: 'in_progress', color: 'blue',  icon: 'i-ph-play' }
  if (current === 'in_progress') return { label: 'Завершить',      status: 'done',        color: 'green', icon: 'i-ph-check' }
  return null
}

function advanceStatus(projectId: string, taskId: string, newStatus: string) {
  crm.updateTaskStatus(projectId, taskId, newStatus as any)
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <!-- Header -->
    <header class="h-16 flex items-center justify-between px-8 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 flex-shrink-0">
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
        <UBadge v-if="pendingChanges.length > 0" color="orange" variant="solid" size="sm" icon="i-ph-git-pull-request">
          {{ pendingChanges.length }} запрос{{ pendingChanges.length > 1 ? 'а' : '' }}
        </UBadge>
        <UBadge v-if="overdueCount > 0" color="red" variant="solid" size="sm" icon="i-ph-warning">
          {{ overdueCount }} просроч.
        </UBadge>
        <UBadge color="purple" variant="soft" icon="i-ph-pencil-ruler" size="sm">Сотрудник</UBadge>
      </div>
    </header>

    <div class="flex-1 overflow-hidden flex">

      <!-- ══ LEFT PANEL: Project list ══════════════════════════════════════════ -->
      <div class="w-56 shrink-0 border-r border-slate-200/80 dark:border-slate-800 overflow-y-auto p-4 bg-white dark:bg-slate-900/80">
        <p class="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.15em] px-2 mb-3">Проекты</p>

        <button
          @click="selectedProjectId = null"
          class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors mb-1"
          :class="!selectedProjectId
            ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-medium'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'"
        >
          <UIcon name="i-ph-grid-four" class="w-4 h-4 shrink-0" />
          <span class="flex-1 text-left text-xs">Все проекты</span>
          <span class="text-xs font-semibold shrink-0">{{ allMyTasks.length }}</span>
        </button>

        <div v-if="myProjects.length === 0" class="px-2 py-3 text-xs text-slate-400 italic">Нет задач</div>

        <button
          v-for="{ project, count } in myProjects" :key="project.id"
          @click="selectedProjectId = project.id"
          class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
          :class="selectedProjectId === project.id
            ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-medium'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'"
        >
          <span class="w-2 h-2 rounded-full shrink-0"
            :class="project.status === 'active' ? 'bg-green-400' : 'bg-slate-300'" />
          <span class="flex-1 text-left text-xs leading-tight truncate">{{ project.name }}</span>
          <span class="text-xs font-semibold shrink-0">{{ count }}</span>
        </button>
      </div>

      <!-- ══ KANBAN BOARD ═══════════════════════════════════════════════════════ -->
      <div class="flex-1 overflow-hidden flex flex-col bg-slate-50/50 dark:bg-slate-950/50">

        <!-- Pending change requests -->
        <div v-if="pendingChanges.length > 0" class="px-6 pt-5 pb-0">
          <div class="flex items-center gap-2 mb-3">
            <UIcon name="i-ph-git-pull-request" class="w-5 h-5 text-orange-500" />
            <h2 class="text-sm font-semibold text-slate-800 dark:text-slate-200">Запросы на изменение</h2>
            <UBadge color="orange" variant="solid" size="xs">{{ pendingChanges.length }}</UBadge>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mb-4">
            <UCard
              v-for="req in pendingChanges" :key="req.id"
              :ui="{ body: 'p-4' }"
              class="border-l-4 border-l-orange-400"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="flex-1 min-w-0">
                  <template v-if="changeContext(req)">
                    <p class="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-0.5">{{ changeContext(req)!.taskName }}</p>
                    <p class="text-xs text-slate-400 mb-1.5">{{ changeContext(req)!.projectName }}</p>
                  </template>
                  <UBadge color="orange" variant="soft" size="xs" icon="i-ph-git-pull-request" class="mb-1">
                    {{ req.type === 'task_change' ? 'Изменение задачи' : 'Изменение цены' }}
                  </UBadge>
                  <p class="text-xs text-slate-600 dark:text-slate-400">{{ changeLabel(req.changes) }}</p>
                  <p class="text-xs text-slate-500 mt-0.5"><span class="font-medium">Причина:</span> {{ req.reason }}</p>
                </div>
                <div class="flex flex-col gap-1.5 shrink-0">
                  <UButton size="sm" color="green" variant="soft" icon="i-ph-check" @click="acceptChange(req.id)">Принять</UButton>
                  <UButton size="sm" color="red" variant="ghost" icon="i-ph-x" @click="toggleRejectForm(req.id)">Отклонить</UButton>
                </div>
              </div>
              <div v-if="showRejectForm[req.id]" class="mt-3 flex gap-2">
                <UInput v-model="rejectComment[req.id]" placeholder="Комментарий" size="sm" class="flex-1" />
                <UButton size="sm" color="red" @click="rejectChange(req.id)">Подтвердить</UButton>
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
                <span class="ml-auto text-xs bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold px-2 py-0.5 rounded-full">{{ todoTasks.length }}</span>
              </div>
              <div class="flex-1 overflow-y-auto space-y-3 pr-1">
                <div v-if="todoTasks.length === 0" class="flex flex-col items-center justify-center py-12 text-slate-300 dark:text-slate-600">
                  <UIcon name="i-ph-tray" class="w-8 h-8 mb-2" />
                  <p class="text-xs">Нет задач</p>
                </div>
                <div
                  v-for="{ project, task } in todoTasks" :key="task.id"
                  v-memo="[task.status, task.deadline, task.note]"
                  class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 transition-all hover:shadow-md hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50"
                  :class="task.status !== 'done' && isOverdue(task.deadline) ? 'border-l-4 border-l-red-400' : ''"
                >
                  <!-- Badges -->
                  <div class="flex items-center gap-1.5 mb-2 flex-wrap">
                    <div class="flex items-center gap-1 text-xs text-slate-400">
                      <UIcon :name="STAGE_ICONS[task.stage]" class="w-3 h-3" />
                      {{ STAGE_SHORT_LABELS[task.stage] }}
                    </div>
                    <div class="flex items-center gap-1 text-xs text-slate-400">
                      <UIcon :name="ROLE_ICONS[task.role]" class="w-3 h-3" />
                      {{ ROLE_LABELS[task.role] }}
                    </div>
                    <span v-if="!selectedProjectId" class="text-xs text-slate-300 dark:text-slate-600 ml-auto truncate max-w-24">{{ project.name }}</span>
                  </div>
                  <!-- Task name -->
                  <p class="font-semibold text-sm text-slate-800 dark:text-slate-200 mb-2 leading-snug">
                    {{ crm.taskMap[task.taskId]?.name ?? task.taskId }}
                  </p>
                  <!-- Deadline -->
                  <div v-if="task.deadline" class="flex items-center gap-1.5 mb-2">
                    <UIcon name="i-ph-calendar" class="w-3.5 h-3.5 shrink-0"
                      :class="isOverdue(task.deadline) ? 'text-red-500' : 'text-slate-400'" />
                    <span class="text-xs"
                      :class="isOverdue(task.deadline) ? 'text-red-500 font-semibold' : 'text-slate-500'">
                      {{ formatDate(task.deadline) }}
                      <span v-if="isOverdue(task.deadline)"> — просрочено</span>
                      <span v-else-if="daysUntil(task.deadline) !== null && daysUntil(task.deadline)! <= 7" class="text-amber-500">
                        — {{ daysUntil(task.deadline) }} дн.
                      </span>
                    </span>
                  </div>
                  <!-- Note -->
                  <div class="mb-3">
                    <button class="flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-500 transition-colors"
                      @click="toggleNote(task.id, task.note)">
                      <UIcon name="i-ph-chat-text" class="w-3.5 h-3.5" />
                      <span>{{ task.note ? task.note.substring(0, 35) + (task.note.length > 35 ? '...' : '') : 'Заметка' }}</span>
                    </button>
                    <div v-if="showNote[task.id]" class="mt-2 flex gap-2">
                      <UInput v-model="noteDraft[task.id]" placeholder="Заметка по задаче..." size="sm" class="flex-1" />
                      <UButton size="sm" color="primary" variant="soft" @click="saveNote(project.id, task.id)">✓</UButton>
                      <UButton size="sm" color="neutral" variant="ghost" @click="showNote[task.id] = false">✕</UButton>
                    </div>
                  </div>
                  <!-- Actions -->
                  <div class="flex gap-2">
                    <UButton size="sm" color="blue" variant="soft" icon="i-ph-play" class="flex-1"
                      @click="advanceStatus(project.id, task.id, 'in_progress')">
                      Взять в работу
                    </UButton>
                    <UButton size="sm" color="neutral" variant="ghost" icon="i-ph-git-pull-request"
                      @click="openProposeModal(project.id, task.id)" />
                  </div>
                </div>
              </div>
            </div>

            <!-- Column: В работе -->
            <div class="flex-1 min-w-0 flex flex-col">
              <div class="flex items-center gap-2 mb-3 px-1">
                <div class="w-2.5 h-2.5 rounded-full bg-blue-400" />
                <span class="text-xs font-semibold text-blue-500 dark:text-blue-400 uppercase tracking-wide">В работе</span>
                <span class="ml-auto text-xs bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-semibold px-2 py-0.5 rounded-full">{{ inProgressTasks.length }}</span>
              </div>
              <div class="flex-1 overflow-y-auto space-y-3 pr-1">
                <div v-if="inProgressTasks.length === 0" class="flex flex-col items-center justify-center py-12 text-slate-300 dark:text-slate-600">
                  <UIcon name="i-ph-tray" class="w-8 h-8 mb-2" />
                  <p class="text-xs">Нет задач</p>
                </div>
                <div
                  v-for="{ project, task } in inProgressTasks" :key="task.id"
                  v-memo="[task.status, task.deadline, task.note]"
                  class="bg-white dark:bg-slate-900 border border-blue-200/60 dark:border-blue-800/50 rounded-2xl p-4 transition-all hover:shadow-md hover:shadow-blue-100/50 dark:hover:shadow-blue-900/20"
                  :class="isOverdue(task.deadline) ? 'border-l-4 border-l-red-400' : ''"
                >
                  <div class="flex items-center gap-1.5 mb-2 flex-wrap">
                    <div class="flex items-center gap-1 text-xs text-slate-400">
                      <UIcon :name="STAGE_ICONS[task.stage]" class="w-3 h-3" />
                      {{ STAGE_SHORT_LABELS[task.stage] }}
                    </div>
                    <div class="flex items-center gap-1 text-xs text-slate-400">
                      <UIcon :name="ROLE_ICONS[task.role]" class="w-3 h-3" />
                      {{ ROLE_LABELS[task.role] }}
                    </div>
                    <span v-if="!selectedProjectId" class="text-xs text-slate-300 dark:text-slate-600 ml-auto truncate max-w-24">{{ project.name }}</span>
                  </div>
                  <p class="font-semibold text-sm text-slate-800 dark:text-slate-200 mb-2 leading-snug">
                    {{ crm.taskMap[task.taskId]?.name ?? task.taskId }}
                  </p>
                  <div v-if="task.deadline" class="flex items-center gap-1.5 mb-2">
                    <UIcon name="i-ph-calendar" class="w-3.5 h-3.5 shrink-0"
                      :class="isOverdue(task.deadline) ? 'text-red-500' : 'text-slate-400'" />
                    <span class="text-xs"
                      :class="isOverdue(task.deadline) ? 'text-red-500 font-semibold' : 'text-slate-500'">
                      {{ formatDate(task.deadline) }}
                      <span v-if="isOverdue(task.deadline)"> — просрочено</span>
                      <span v-else-if="daysUntil(task.deadline) !== null && daysUntil(task.deadline)! <= 7" class="text-amber-500">
                        — {{ daysUntil(task.deadline) }} дн.
                      </span>
                    </span>
                  </div>
                  <div class="mb-3">
                    <button class="flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-500 transition-colors"
                      @click="toggleNote(task.id, task.note)">
                      <UIcon name="i-ph-chat-text" class="w-3.5 h-3.5" />
                      <span>{{ task.note ? task.note.substring(0, 35) + (task.note.length > 35 ? '...' : '') : 'Заметка' }}</span>
                    </button>
                    <div v-if="showNote[task.id]" class="mt-2 flex gap-2">
                      <UInput v-model="noteDraft[task.id]" placeholder="Заметка по задаче..." size="sm" class="flex-1" />
                      <UButton size="sm" color="primary" variant="soft" @click="saveNote(project.id, task.id)">✓</UButton>
                      <UButton size="sm" color="neutral" variant="ghost" @click="showNote[task.id] = false">✕</UButton>
                    </div>
                  </div>
                  <div class="flex gap-2">
                    <UButton size="sm" color="green" variant="soft" icon="i-ph-check" class="flex-1"
                      @click="advanceStatus(project.id, task.id, 'done')">
                      Завершить
                    </UButton>
                    <UButton size="sm" color="neutral" variant="ghost" icon="i-ph-git-pull-request"
                      @click="openProposeModal(project.id, task.id)" />
                  </div>
                </div>
              </div>
            </div>

            <!-- Column: Готово -->
            <div class="flex-1 min-w-0 flex flex-col">
              <div class="flex items-center gap-2 mb-3 px-1">
                <div class="w-2.5 h-2.5 rounded-full bg-green-400" />
                <span class="text-xs font-semibold text-green-500 dark:text-green-400 uppercase tracking-wide">Готово</span>
                <span class="ml-auto text-xs bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400 font-semibold px-2 py-0.5 rounded-full">{{ doneTasks.length }}</span>
              </div>
              <div class="flex-1 overflow-y-auto space-y-3 pr-1">
                <div v-if="doneTasks.length === 0" class="flex flex-col items-center justify-center py-12 text-slate-300 dark:text-slate-600">
                  <UIcon name="i-ph-tray" class="w-8 h-8 mb-2" />
                  <p class="text-xs">Нет задач</p>
                </div>
                <div
                  v-for="{ project, task } in doneTasks" :key="task.id"
                  v-memo="[task.status, task.deadline]"
                  class="bg-white dark:bg-slate-900 border border-green-200/60 dark:border-green-800/50 rounded-2xl p-4 opacity-80 hover:opacity-100 transition-all"
                >
                  <div class="flex items-center gap-1.5 mb-2 flex-wrap">
                    <div class="flex items-center gap-1 text-xs text-slate-400">
                      <UIcon :name="STAGE_ICONS[task.stage]" class="w-3 h-3" />
                      {{ STAGE_SHORT_LABELS[task.stage] }}
                    </div>
                    <div class="flex items-center gap-1 text-xs text-slate-400">
                      <UIcon :name="ROLE_ICONS[task.role]" class="w-3 h-3" />
                      {{ ROLE_LABELS[task.role] }}
                    </div>
                    <span v-if="!selectedProjectId" class="text-xs text-slate-300 dark:text-slate-600 ml-auto truncate max-w-24">{{ project.name }}</span>
                  </div>
                  <p class="font-semibold text-sm text-slate-600 dark:text-slate-400 mb-2 leading-snug line-through decoration-green-400/60">
                    {{ crm.taskMap[task.taskId]?.name ?? task.taskId }}
                  </p>
                  <div v-if="task.deadline" class="flex items-center gap-1.5">
                    <UIcon name="i-ph-calendar-check" class="w-3.5 h-3.5 text-green-500 shrink-0" />
                    <span class="text-xs text-slate-400">{{ formatDate(task.deadline) }}</span>
                  </div>
                  <div class="mt-2 flex items-center gap-1.5">
                    <UIcon name="i-ph-check-circle" class="w-3.5 h-3.5 text-green-500" />
                    <span class="text-xs text-green-600 dark:text-green-400 font-medium">Завершено</span>
                  </div>
                </div>
              </div>
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
          <UButton color="primary" icon="i-ph-paper-plane-right" @click="submitPropose" :disabled="!proposeModal.reason.trim()">
            Отправить запрос
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
