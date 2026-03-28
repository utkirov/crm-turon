<script setup lang="ts">
import { useDebounce } from '@vueuse/core'
import { useAuthStore } from '~/stores/useAuthStore'
import { useCrmStore } from '~/stores/useCrmStore'
import {
  STAGES, STAGE_LABELS, STAGE_SHORT_LABELS, STAGE_ICONS,
  ROLE_LABELS, ROLE_ICONS,
} from '~/constants/taskCatalog'
import dayjs from 'dayjs'
import { fmtDate, fmtDateShort } from '~/utils/date'
import { fmtMoney } from '~/utils/money'
import type { ProjectStatus, DesignStage, StageRole, ServiceStatus, DocumentStatus, DocumentTemplate, ProjectType } from '~/types/crm'

definePageMeta({ layout: 'default', middleware: ['auth', 'role'] })

const auth  = useAuthStore()
const crm   = useCrmStore()
const toast = useToast()
const route = useRoute()
const today = dayjs().format('YYYY-MM-DD')

// ── Search, filter, sort ───────────────────────────────────────────────────────
const searchQuery  = ref('')
const filterStatus = ref<ProjectStatus | 'all'>('all')
const sortBy       = ref<'date' | 'amount' | 'progress' | 'overdue'>('date')

const allProjects = computed(() =>
  auth.currentUser ? crm.projectsByPm(auth.currentUser.id) : crm.projects
)

const projects = computed(() => {
  let list = allProjects.value
  if (filterStatus.value !== 'all') list = list.filter(p => p.status === filterStatus.value)
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.client.toLowerCase().includes(q) ||
      p.location.toLowerCase().includes(q)
    )
  }
  return [...list].sort((a, b) => {
    if (sortBy.value === 'amount') return b.contractAmount - a.contractAmount
    if (sortBy.value === 'progress') {
      const pa = a.tasks.length ? a.tasks.filter(t => t.status === 'done').length / a.tasks.length : 0
      const pb = b.tasks.length ? b.tasks.filter(t => t.status === 'done').length / b.tasks.length : 0
      return pb - pa
    }
    if (sortBy.value === 'overdue') {
      const oa = a.tasks.some(t => isOverdue(t.deadline) && t.status !== 'done') ? 1 : 0
      const ob = b.tasks.some(t => isOverdue(t.deadline) && t.status !== 'done') ? 1 : 0
      return ob - oa
    }
    return (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
  })
})

const fmt = fmtMoney

const TYPE_LABELS: Record<string, string> = {
  residential: 'Жилой', commercial: 'Коммерческий',
  education: 'Образование', infrastructure: 'Инфраструктура',
}
const TYPE_ICONS: Record<string, string> = {
  residential: 'i-ph-house', commercial: 'i-ph-buildings',
  education: 'i-ph-graduation-cap', infrastructure: 'i-ph-bank',
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active:    { label: 'Активен',  color: 'green' },
  completed: { label: 'Завершён', color: 'blue' },
  on_hold:   { label: 'На паузе', color: 'amber' },
}

const STATUS_OPTIONS = [
  { label: 'Активен',   value: 'active' },
  { label: 'На паузе',  value: 'on_hold' },
  { label: 'Завершён',  value: 'completed' },
]

// ── Project selection ─────────────────────────────────────────────────────────
const selected = ref<string | null>(null)
const detailTab = ref<'overview' | 'finance'>('overview')

onMounted(() => {
  // Support opening a specific project via ?id= query param (e.g. from kanban page)
  const qId = route.query.id as string | undefined
  if (qId && crm.projects.find(p => p.id === qId)) {
    selected.value = qId
  } else if (!selected.value && projects.value.length) {
    selected.value = projects.value[0]?.id ?? ''
  }
})

const selectedProject = computed(() => crm.projects.find(p => p.id === selected.value) ?? null)
const financials      = computed(() => selected.value ? crm.projectFinancials(selected.value) : null)

function selectProject(id: string) {
  selected.value = id
  detailTab.value = 'overview'
  taskSearchRaw.value = ''
}

// ── Document progress for header ──────────────────────────────────────────────
const docProgress = computed(() => {
  const docs = selectedProject.value?.documents ?? []
  if (!docs.length) return null
  const received = docs.filter(d => d.status === 'received').length
  const total    = docs.filter(d => d.status !== 'na').length
  return { received, total }
})

// ── Project status change ─────────────────────────────────────────────────────
function changeProjectStatus(status: string) {
  if (!selected.value) return
  crm.updateProjectStatus(selected.value, status as any)
  toast.add({ title: `Статус изменён на "${STATUS_CONFIG[status]?.label}"`, color: 'success' })
}

// ── Overview tab: Stage lifecycle ─────────────────────────────────────────────
const activeOverviewStage = ref<DesignStage>('sketch')
const collapsedRoles = reactive<Record<string, boolean>>({})
const allRolesExpanded = ref(true)

function toggleRole(key: string) {
  collapsedRoles[key] = !collapsedRoles[key]
}

function expandAllRoles() {
  allRolesExpanded.value = true
  for (const key of Object.keys(collapsedRoles)) {
    collapsedRoles[key] = false
  }
}

function collapseAllRoles() {
  allRolesExpanded.value = false
  const rolesInStage = getProjectRolesForStage(activeOverviewStage.value)
  for (const role of rolesInStage) {
    collapsedRoles[`${activeOverviewStage.value}-${role}`] = true
  }
}

// Tasks for a given project stage
function getTasksForStage(stage: DesignStage) {
  return selectedProject.value?.tasks.filter(t => t.stage === stage) ?? []
}

// Stage stats
function stageStats(stage: DesignStage) {
  const tasks = getTasksForStage(stage)
  if (!tasks.length) return { total: 0, done: 0, pct: 0, status: 'empty' as const }
  const done = tasks.filter(t => t.status === 'done').length
  const inProgress = tasks.filter(t => t.status === 'in_progress').length
  const pct = Math.round(done / tasks.length * 100)
  const status = done === tasks.length ? 'done' : inProgress > 0 || done > 0 ? 'active' : 'pending'
  return { total: tasks.length, done, pct, status } as const
}

// Tasks for a role within a stage (respects task search)
function getTasksForStageRole(stage: DesignStage, role: string) {
  const q = taskSearch.value.toLowerCase()
  return (selectedProject.value?.tasks ?? []).filter(t => {
    if (t.stage !== stage || t.role !== role) return false
    if (q) {
      const name = crm.taskMap[t.taskId]?.name?.toLowerCase() ?? ''
      const staff = crm.staffById(t.staffId ?? '')?.name?.toLowerCase() ?? ''
      return name.includes(q) || staff.includes(q)
    }
    return true
  })
}

// Roles present in this project for the given stage
function getProjectRolesForStage(stage: DesignStage) {
  const roles = new Set<string>()
  for (const t of getTasksForStage(stage)) roles.add(t.role)
  return Array.from(roles)
}

// Overdue check (using imported util)
function isOverdue(deadline?: string | null) {
  return !!deadline && deadline < today
}

// ── Task search within Overview tab ───────────────────────────────────────────
const taskSearchRaw = ref('')
const taskSearch = useDebounce(taskSearchRaw, 300)

// Status icons
const TASK_STATUS_ICON: Record<ServiceStatus, string> = {
  todo:        'i-ph-circle',
  in_progress: 'i-ph-clock',
  done:        'i-ph-check-circle',
}
const TASK_STATUS_COLOR: Record<ServiceStatus, string> = {
  todo:        'text-slate-300 dark:text-slate-600',
  in_progress: 'text-amber-500',
  done:        'text-green-500',
}

// Stage card visual state
const STAGE_STATE_CLASS = {
  done:    'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950',
  active:  'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950',
  pending: 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900',
  empty:   'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 opacity-50',
}
const STAGE_TEXT_CLASS = {
  done:    'text-green-700 dark:text-green-300',
  active:  'text-blue-700 dark:text-blue-300',
  pending: 'text-slate-500',
  empty:   'text-slate-400',
}

// ── Finance tab ───────────────────────────────────────────────────────────────
const SPLIT_BAR_CLASS: Record<string, string> = {
  pending: 'bg-slate-300 dark:bg-slate-600',
  partial: 'bg-amber-400',
  paid:    'bg-green-500',
}

// Progress bar for project list item
function projectProgress(p: typeof projects.value[0]) {
  if (!p.tasks.length) return 0
  return Math.round(p.tasks.filter(t => t.status === 'done').length / p.tasks.length * 100)
}

function hasOverdueTasks(p: typeof projects.value[0]) {
  return p.tasks.some(t => isOverdue(t.deadline) && t.status !== 'done')
}

// Total staff payout for current project
const totalStaffPayout = computed(() => {
  if (!selectedProject.value) return 0
  return selectedProject.value.tasks.reduce((s, t) => s + t.price, 0)
})

const unpricedCount = computed(() => {
  if (!selectedProject.value) return 0
  return selectedProject.value.tasks.filter(t => t.price === 0).length
})

// ── Document display & editing ────────────────────────────────────────────────
type DocEntry = NonNullable<typeof selectedProject.value>['documents'][0]
type TaskEntry = NonNullable<typeof selectedProject.value>['tasks'][0]

const DOC_STATUS_CONFIG: Record<DocumentStatus, { label: string; color: string; icon: string }> = {
  pending:  { label: 'Ожидает',  color: 'amber',   icon: 'i-ph-clock' },
  received: { label: 'Получен',  color: 'green',   icon: 'i-ph-check-circle' },
  na:       { label: 'Н/А',      color: 'neutral', icon: 'i-ph-minus-circle' },
}

const docsForActiveStage = computed(() =>
  selectedProject.value?.documents.filter(d => d.stage === activeOverviewStage.value) ?? []
)

const showDocModal = ref(false)
const editingDoc = reactive({
  id: '',
  name: '',
  status: 'pending' as DocumentStatus,
  receivedDate: '',
  pendingReason: '',
})

function openDocEdit(doc: DocEntry) {
  editingDoc.id            = doc.id
  editingDoc.name          = doc.name
  editingDoc.status        = doc.status
  editingDoc.receivedDate  = doc.receivedDate ?? ''
  editingDoc.pendingReason = doc.pendingReason ?? ''
  showDocModal.value = true
}

function saveDocStatus() {
  if (!selected.value) return
  crm.updateDocumentStatus(
    selected.value,
    editingDoc.id,
    editingDoc.status,
    editingDoc.status === 'received' ? (editingDoc.receivedDate || undefined) : undefined,
    editingDoc.status === 'pending'  ? (editingDoc.pendingReason || undefined) : undefined,
  )
  showDocModal.value = false
}

// ── Add document to project ────────────────────────────────────────────────────
const showAddDocModal = ref(false)
const addDocStage = ref<DesignStage>('sketch')

const availableDocsForAdd = computed(() => {
  if (!selectedProject.value) return []
  const existingIds = new Set(selectedProject.value.documents.map(d => d.templateId))
  return crm.documentTemplates.filter(
    d => d.stage === addDocStage.value && !existingIds.has(d.id)
  )
})

function openAddDoc() {
  addDocStage.value = activeOverviewStage.value
  showAddDocModal.value = true
}

function addDocument(template: DocumentTemplate) {
  if (!selected.value) return
  crm.addDocumentToProject(selected.value, template)
  showAddDocModal.value = false
  toast.add({ title: 'Документ добавлен', color: 'success' })
}

// ── Task edit / change request ────────────────────────────────────────────────
const showChangeModal = ref(false)
const changingTask    = ref<TaskEntry | null>(null)

const changeForm = reactive({
  reason:      '',
  newStaffId:  null as string | null,
  newDeadline: '',
})

const staffAssignOptions = computed(() => [
  { label: 'Не назначен', value: null },
  ...crm.staffWorkers.map(s => ({ label: s.name, value: s.id })),
])

function openTaskEdit(task: TaskEntry) {
  changingTask.value       = task
  changeForm.reason        = ''
  changeForm.newStaffId    = task.staffId
  changeForm.newDeadline   = task.deadline ?? ''
  showChangeModal.value = true
}

function submitTaskChange() {
  if (!changingTask.value || !selected.value || !changeForm.reason.trim()) return
  const task = changingTask.value
  const changes: Record<string, { from: unknown; to: unknown }> = {}

  if (changeForm.newStaffId !== task.staffId)
    changes.staffId = { from: task.staffId, to: changeForm.newStaffId }

  if (changeForm.newDeadline !== (task.deadline ?? ''))
    changes.deadline = { from: task.deadline, to: changeForm.newDeadline || undefined }

  if (Object.keys(changes).length === 0) {
    showChangeModal.value = false
    return
  }
  crm.proposeChange(
    selected.value,
    task.id,
    'task_change',
    changeForm.reason,
    changes,
    auth.currentUser?.id ?? '',
  )
  toast.add({ title: 'Запрос отправлен на согласование', color: 'info' })
  showChangeModal.value = false
}

// ── ChangeRequest detail view ─────────────────────────────────────────────────
const showCrDetailModal = ref(false)
const viewingCrTask = ref<TaskEntry | null>(null)

const viewingChangeRequest = computed(() => {
  if (!viewingCrTask.value) return null
  return crm.changeRequests.find(r => r.id === viewingCrTask.value?.pendingChangeId) ?? null
})

function openCrDetail(task: TaskEntry) {
  viewingCrTask.value = task
  showCrDetailModal.value = true
}

function cancelCr() {
  if (!viewingChangeRequest.value) return
  crm.cancelChange(viewingChangeRequest.value.id)
  showCrDetailModal.value = false
  toast.add({ title: 'Запрос отозван', color: 'neutral' })
}

// ── Edit project modal ────────────────────────────────────────────────────────
const showEditModal = ref(false)
const editForm = reactive({
  name: '', client: '', location: '',
  type: 'residential' as ProjectType,
  contractAmount: 0, status: 'active' as ProjectStatus,
  startDate: '', plannedEndDate: '',
})

const TYPE_OPTIONS_EDIT = [
  { label: 'Жилой',          value: 'residential' },
  { label: 'Коммерческий',   value: 'commercial' },
  { label: 'Образование',    value: 'education' },
  { label: 'Инфраструктура', value: 'infrastructure' },
]

function openEditModal() {
  const p = selectedProject.value!
  Object.assign(editForm, {
    name: p.name, client: p.client, location: p.location, type: p.type,
    contractAmount: p.contractAmount, status: p.status,
    startDate: p.startDate ?? '', plannedEndDate: p.plannedEndDate ?? '',
  })
  showEditModal.value = true
}

function saveEditModal() {
  if (!selected.value) return
  crm.updateProject(selected.value, {
    name: editForm.name, client: editForm.client, location: editForm.location,
    type: editForm.type, contractAmount: editForm.contractAmount,
    startDate: editForm.startDate || undefined, plannedEndDate: editForm.plannedEndDate || undefined,
  })
  crm.updateProjectStatus(selected.value, editForm.status)
  toast.add({ title: 'Проект обновлён', color: 'success' })
  showEditModal.value = false
}

// ── Add task to project (new 3-col selector) ──────────────────────────────────
const showAddTaskModal = ref(false)
const serviceSelectorRef = ref<{ selectedTasks: Record<string, { deadline: string }>; reset: () => void } | null>(null)

function openAddTask() {
  serviceSelectorRef.value?.reset()
  showAddTaskModal.value = true
}

function submitAddTask() {
  if (!selected.value || !serviceSelectorRef.value) return
  const tasks = serviceSelectorRef.value.selectedTasks
  const count = Object.keys(tasks).length
  if (!count) return
  for (const [taskId, sel] of Object.entries(tasks)) {
    crm.addTaskToProject(selected.value, {
      taskId,
      staffId: null,
      deadline: sel.deadline || undefined,
    })
  }
  toast.add({ title: `Добавлено ${count} задач в проект`, color: 'success' })
  showAddTaskModal.value = false
}

// ── Milestone pay ────────────────────────────────────────────────────────────
function payMilestone(msId: string) {
  if (!selected.value) return
  crm.markMilestonePaid(selected.value, msId)
  toast.add({ title: 'Этап оплаты отмечен как оплаченный', color: 'success' })
}

const docStatusOptions: { label: string; value: DocumentStatus }[] = [
  { label: 'Ожидается',    value: 'pending'  },
  { label: 'Получен',      value: 'received' },
  { label: 'Не требуется', value: 'na'       },
]

const STAGE_OPTIONS = STAGES.map(s => ({ label: STAGE_SHORT_LABELS[s], value: s }))
</script>

<template>
  <div>
  <div class="flex h-[calc(100vh-4rem)] overflow-hidden">

    <!-- ════════════════════ LEFT: PROJECT LIST ════════════════════ -->
    <div class="w-72 shrink-0 border-r border-slate-100 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900">
      <!-- Header -->
      <div class="p-4 border-b border-slate-100 dark:border-slate-800">
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-semibold text-slate-900 dark:text-white">Проекты</h2>
          <UButton size="sm" icon="i-ph-plus" to="/pm/create" label="Новый" />
        </div>
        <UInput
          v-model="searchQuery"
          icon="i-ph-magnifying-glass"
          placeholder="Поиск..."
          size="sm"
          class="mb-2"
        />
        <!-- Filters -->
        <div class="flex gap-1 flex-wrap">
          <UButton
            v-for="opt in [
              { v: 'all', l: 'Все' },
              { v: 'active', l: 'Активные' },
              { v: 'on_hold', l: 'Пауза' },
              { v: 'completed', l: 'Завершённые' },
            ]"
            :key="opt.v"
            size="sm" variant="ghost"
            :color="filterStatus === opt.v ? 'primary' : 'neutral'"
            @click="filterStatus = opt.v as any"
          >{{ opt.l }}</UButton>
        </div>
        <!-- Sort -->
        <div class="mt-2 flex gap-1">
          <UButton
            v-for="s in [
              { v: 'date', l: 'Дата' },
              { v: 'amount', l: 'Сумма' },
              { v: 'progress', l: '%' },
              { v: 'overdue', l: '🔴' },
            ]"
            :key="s.v"
            size="sm" variant="ghost"
            :color="sortBy === s.v ? 'primary' : 'neutral'"
            @click="sortBy = s.v as any"
          >{{ s.l }}</UButton>
        </div>
      </div>

      <!-- List -->
      <div class="flex-1 overflow-y-auto py-2">
        <button
          v-for="p in projects" :key="p.id"
          @click="selectProject(p.id)"
          class="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors relative"
          :class="selected === p.id
            ? 'bg-blue-50 dark:bg-blue-950 border-l-2 border-l-blue-500'
            : 'border-l-2 border-l-transparent'"
        >
          <div class="flex items-start justify-between gap-1">
            <span class="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-tight flex-1 mr-1">{{ p.name }}</span>
            <div class="flex items-center gap-1 shrink-0">
              <!-- Overdue indicator -->
              <div v-if="hasOverdueTasks(p)" class="w-2 h-2 rounded-full bg-red-500" title="Есть просроченные задачи" />
              <UBadge
                :label="STATUS_CONFIG[p.status]?.label"
                :color="STATUS_CONFIG[p.status]?.color as any"
                variant="subtle" size="xs"
              />
            </div>
          </div>
          <p class="text-xs text-slate-500 mt-0.5 truncate">{{ p.client }}</p>
          <div class="flex items-center gap-1.5 mt-0.5 text-xs text-slate-400">
            <UIcon :name="TYPE_ICONS[p.type]" class="w-3 h-3" />
            <span>{{ TYPE_LABELS[p.type] }}</span>
            <span class="text-slate-300">·</span>
            <span>{{ fmtDateShort(p.createdAt) }}</span>
          </div>
          <div class="flex items-center gap-2 mt-1.5">
            <div class="flex-1 h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                class="h-full rounded-full transition-all"
                :class="projectProgress(p) === 100 ? 'bg-green-500' : 'bg-blue-500'"
                :style="{ width: projectProgress(p) + '%' }"
              />
            </div>
            <span class="text-xs text-slate-400 shrink-0">{{ projectProgress(p) }}%</span>
          </div>
        </button>
        <p v-if="!projects.length" class="text-sm text-slate-400 text-center py-8 px-4">
          Проектов не найдено
          <br>
          <NuxtLink to="/pm/create" class="text-blue-500 hover:underline mt-1 block">Создать первый →</NuxtLink>
        </p>
      </div>
    </div>

    <!-- ════════════════════ RIGHT: DETAIL PANEL ════════════════════ -->
    <div v-if="selectedProject" class="flex-1 flex flex-col overflow-hidden">

      <!-- Project header -->
      <div class="px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1 flex-wrap">
              <h1 class="text-xl font-bold text-slate-900 dark:text-white">{{ selectedProject.name }}</h1>
              <!-- Clickable status badge -->
              <UDropdownMenu
                :items="STATUS_OPTIONS.map(o => ({ label: o.label, onSelect: () => changeProjectStatus(o.value) }))"
              >
                <UBadge
                  :label="STATUS_CONFIG[selectedProject.status]?.label"
                  :color="STATUS_CONFIG[selectedProject.status]?.color as any"
                  variant="subtle" size="sm"
                  class="cursor-pointer hover:opacity-80"
                />
              </UDropdownMenu>
            </div>
            <div class="flex items-center gap-3 text-sm text-slate-500 flex-wrap">
              <span class="flex items-center gap-1">
                <UIcon name="i-ph-buildings" class="w-3.5 h-3.5" />
                {{ selectedProject.client }}
              </span>
              <span class="flex items-center gap-1">
                <UIcon name="i-ph-map-pin" class="w-3.5 h-3.5" />
                {{ selectedProject.location }}
              </span>
              <span class="flex items-center gap-1">
                <UIcon name="i-ph-tag" class="w-3.5 h-3.5" />
                {{ TYPE_LABELS[selectedProject.type] }}
              </span>
              <!-- Dates -->
              <span v-if="selectedProject.startDate || selectedProject.plannedEndDate" class="flex items-center gap-1">
                <UIcon name="i-ph-calendar-blank" class="w-3.5 h-3.5" />
                {{ fmtDateShort(selectedProject.startDate) }} → {{ fmtDateShort(selectedProject.plannedEndDate) }}
              </span>
              <!-- Document progress -->
              <span v-if="docProgress && docProgress.total > 0" class="flex items-center gap-1" :title="`Документы: ${docProgress.received} из ${docProgress.total} получено`">
                <UIcon name="i-ph-files" class="w-3.5 h-3.5" :class="docProgress.received === docProgress.total ? 'text-green-500' : 'text-amber-500'" />
                <span :class="docProgress.received === docProgress.total ? 'text-green-600 dark:text-green-400 font-medium' : ''">
                  {{ docProgress.received }}/{{ docProgress.total }} доков
                </span>
              </span>
            </div>
          </div>
          <!-- Contract amount + edit -->
          <div class="flex items-start gap-2 shrink-0">
            <div class="text-right">
              <p class="text-xs text-slate-400">Контракт</p>
              <p class="text-xl font-bold text-slate-900 dark:text-white">
                {{ fmt(selectedProject.contractAmount) }} <span class="text-sm font-normal text-slate-500">сум</span>
              </p>
            </div>
            <UButton
              size="sm" variant="ghost" color="neutral"
              icon="i-ph-pencil-simple"
              title="Редактировать проект"
              @click="openEditModal"
            />
          </div>
        </div>

        <!-- Tabs -->
        <div class="flex gap-4 mt-4 border-b border-slate-100 dark:border-slate-800 -mb-4">
          <button
            v-for="tab in [
              { v: 'overview', label: 'Обзор', icon: 'i-ph-squares-four' },
              { v: 'finance',  label: 'Финансы', icon: 'i-ph-money' },
            ]"
            :key="tab.v"
            @click="detailTab = tab.v as any"
            class="flex items-center gap-1.5 pb-3 text-sm font-medium border-b-2 transition-colors"
            :class="detailTab === tab.v
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'"
          >
            <UIcon :name="tab.icon" class="w-4 h-4" />
            {{ tab.label }}
          </button>
        </div>
      </div>

      <!-- Tab content -->
      <div class="flex-1 overflow-y-auto">

        <!-- ══════ OVERVIEW TAB ══════ -->
        <div v-if="detailTab === 'overview'" class="p-6 space-y-5">

          <!-- Stage lifecycle bar (4 cards) -->
          <div class="grid grid-cols-4 gap-3">
            <button
              v-for="stage in STAGES" :key="stage"
              @click="activeOverviewStage = stage"
              class="p-3 rounded-xl border-2 text-left transition-all"
              :class="[
                STAGE_STATE_CLASS[stageStats(stage).status],
                activeOverviewStage === stage ? 'ring-2 ring-blue-400 ring-offset-1' : '',
              ]"
            >
              <div class="flex items-center justify-between mb-1.5">
                <UIcon
                  :name="STAGE_ICONS[stage]"
                  class="w-5 h-5"
                  :class="STAGE_TEXT_CLASS[stageStats(stage).status]"
                />
                <UIcon v-if="stageStats(stage).status === 'done'" name="i-ph-check-circle" class="w-4 h-4 text-green-500" />
                <UIcon v-else-if="stageStats(stage).status === 'active'" name="i-ph-play-circle" class="w-4 h-4 text-blue-500" />
                <UIcon v-else-if="stageStats(stage).total > 0" name="i-ph-circle" class="w-4 h-4 text-slate-300" />
              </div>
              <p class="text-xs font-semibold leading-tight" :class="STAGE_TEXT_CLASS[stageStats(stage).status]">
                {{ STAGE_SHORT_LABELS[stage] }}
              </p>
              <p v-if="stageStats(stage).total > 0" class="text-xs text-slate-400 mt-1">
                {{ stageStats(stage).done }}/{{ stageStats(stage).total }} задач
              </p>
              <p v-else class="text-xs text-slate-400 mt-1">Нет задач</p>
              <div v-if="stageStats(stage).total > 0" class="mt-2 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  class="h-full rounded-full transition-all"
                  :class="stageStats(stage).status === 'done' ? 'bg-green-500' : 'bg-blue-500'"
                  :style="{ width: stageStats(stage).pct + '%' }"
                />
              </div>
            </button>
          </div>

          <!-- Active stage task tree -->
          <div>
            <div class="flex items-center gap-2 mb-3">
              <UIcon :name="STAGE_ICONS[activeOverviewStage]" class="w-5 h-5 text-blue-500" />
              <h3 class="font-semibold text-slate-800 dark:text-slate-200">
                {{ STAGE_LABELS[activeOverviewStage] }}
              </h3>
              <UBadge
                :label="`${stageStats(activeOverviewStage).done}/${stageStats(activeOverviewStage).total}`"
                color="neutral" variant="subtle" size="xs"
              />
              <UInput
                v-model="taskSearchRaw"
                icon="i-ph-magnifying-glass"
                placeholder="Поиск задач..."
                size="xs"
                class="w-40"
              />
              <div class="flex-1" />
              <!-- Collapse/Expand all + Add task -->
              <UButton size="sm" variant="ghost" color="neutral" icon="i-ph-arrows-out" @click="expandAllRoles">Развернуть</UButton>
              <UButton size="sm" variant="ghost" color="neutral" icon="i-ph-arrows-in" @click="collapseAllRoles">Свернуть</UButton>
              <UButton size="sm" variant="soft" color="primary" icon="i-ph-plus" @click="openAddTask">Задача</UButton>
            </div>

            <div v-if="getTasksForStage(activeOverviewStage).length === 0"
              class="text-sm text-slate-400 py-6 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
              Задачи этого этапа не добавлены в проект
              <br>
              <button class="text-blue-500 text-xs mt-1 hover:underline" @click="openAddTask">+ Добавить задачу</button>
            </div>

            <!-- Role accordions -->
            <div v-else class="space-y-2">
              <UCard
                v-for="role in getProjectRolesForStage(activeOverviewStage)"
                :key="`${activeOverviewStage}-${role}`"
                :ui="{ body: 'p-0' }"
              >
                <!-- Role header -->
                <button
                  class="w-full flex items-center gap-2.5 px-4 py-3.5"
                  @click="toggleRole(`${activeOverviewStage}-${role}`)"
                >
                  <UIcon :name="ROLE_ICONS[role as keyof typeof ROLE_ICONS]" class="w-5 h-5 text-slate-400" />
                  <span class="flex-1 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                    {{ ROLE_LABELS[role as keyof typeof ROLE_LABELS] }}
                  </span>
                  <span class="text-xs text-slate-400">
                    {{ getTasksForStageRole(activeOverviewStage, role).filter(t => t.status === 'done').length }}
                    / {{ getTasksForStageRole(activeOverviewStage, role).length }} выполнено
                  </span>
                  <UIcon
                    :name="collapsedRoles[`${activeOverviewStage}-${role}`] ? 'i-ph-caret-down' : 'i-ph-caret-up'"
                    class="w-4 h-4 text-slate-400"
                  />
                </button>

                <!-- Task rows -->
                <div
                  v-if="!collapsedRoles[`${activeOverviewStage}-${role}`]"
                  class="border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-50 dark:divide-slate-800/50"
                >
                  <div
                    v-for="task in getTasksForStageRole(activeOverviewStage, role)"
                    :key="task.id"
                    class="flex items-center gap-3 px-4 py-3"
                  >
                    <!-- Status icon -->
                    <UIcon
                      :name="TASK_STATUS_ICON[task.status]"
                      class="w-5 h-5 shrink-0"
                      :class="TASK_STATUS_COLOR[task.status]"
                    />

                    <!-- Task name -->
                    <span class="flex-1 text-sm text-slate-700 dark:text-slate-300">
                      {{ crm.taskMap[task.taskId]?.name ?? task.taskId }}
                    </span>

                    <!-- Assignee -->
                    <div class="flex items-center gap-1.5 w-32 shrink-0">
                      <template v-if="task.staffId">
                        <UAvatar :alt="crm.staffById(task.staffId)?.initials ?? '?'" size="xs" />
                        <span class="text-xs text-slate-500 truncate">
                          {{ crm.staffById(task.staffId)?.name ?? '—' }}
                        </span>
                      </template>
                      <span v-else class="text-xs text-slate-300 italic">не назначен</span>
                    </div>

                    <!-- Deadline -->
                    <div class="w-24 shrink-0 text-right">
                      <span
                        v-if="task.deadline"
                        class="text-xs"
                        :class="isOverdue(task.deadline) && task.status !== 'done'
                          ? 'text-red-500 font-semibold'
                          : 'text-slate-400'"
                      >
                        <UIcon
                          v-if="isOverdue(task.deadline) && task.status !== 'done'"
                          name="i-ph-warning"
                          class="w-3 h-3 inline-block mr-0.5"
                        />
                        {{ fmtDateShort(task.deadline) }}
                      </span>
                      <span v-else class="text-xs text-slate-300">—</span>
                    </div>

                    <!-- Price / pending change chip -->
                    <div class="w-36 shrink-0 flex justify-end gap-1.5 items-center">
                      <button
                        v-if="task.pendingChangeId"
                        class="cursor-pointer"
                        @click="openCrDetail(task)"
                      >
                        <UBadge
                          label="На согласовании"
                          color="warning" variant="subtle" size="xs"
                          class="hover:opacity-80"
                        />
                      </button>
                      <UBadge
                        v-else-if="task.price === 0"
                        label="Цена не установлена"
                        color="warning" variant="subtle" size="xs"
                      />
                      <span v-else class="text-xs text-slate-500">
                        {{ fmt(task.price) }} сум
                      </span>
                    </div>

                    <!-- Edit button (only when no pending change) -->
                    <UButton
                      v-if="!task.pendingChangeId"
                      size="sm"
                      icon="i-ph-pencil"
                      variant="ghost"
                      color="neutral"
                      class="shrink-0"
                      @click="openTaskEdit(task)"
                    />
                  </div>
                </div>
              </UCard>
            </div>
          </div>

          <!-- Source documents for active stage -->
          <div class="mt-1">
            <div class="flex items-center gap-2 mb-3">
              <UIcon name="i-ph-files" class="w-5 h-5 text-orange-500" />
              <h3 class="font-semibold text-slate-800 dark:text-slate-200">
                Исходные документы — {{ STAGE_SHORT_LABELS[activeOverviewStage] }}
              </h3>
              <UBadge
                v-if="docsForActiveStage.length"
                :label="`${docsForActiveStage.filter(d => d.status === 'received').length}/${docsForActiveStage.length}`"
                color="warning" variant="subtle" size="xs"
              />
              <div class="flex-1" />
              <UButton size="sm" variant="soft" color="warning" icon="i-ph-plus" @click="openAddDoc">Добавить</UButton>
            </div>

            <div v-if="docsForActiveStage.length === 0"
              class="text-sm text-slate-400 py-4 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
              Документы для этого этапа не добавлены
              <br>
              <button class="text-orange-500 text-xs mt-1 hover:underline" @click="openAddDoc">+ Добавить документ</button>
            </div>

            <div v-else class="space-y-1.5">
              <div
                v-for="doc in docsForActiveStage"
                :key="doc.id"
                class="flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors"
                :class="doc.status === 'received'
                  ? 'bg-green-50 dark:bg-green-950 border-green-100 dark:border-green-900'
                  : doc.status === 'na'
                    ? 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 opacity-60'
                    : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'"
              >
                <UIcon
                  :name="DOC_STATUS_CONFIG[doc.status].icon"
                  class="w-5 h-5 shrink-0"
                  :class="doc.status === 'received' ? 'text-green-500' : doc.status === 'na' ? 'text-slate-400' : 'text-amber-500'"
                />
                <span class="flex-1 text-sm text-slate-700 dark:text-slate-300">{{ doc.name }}</span>
                <span v-if="doc.status === 'received' && doc.receivedDate" class="text-xs text-green-600 dark:text-green-400">
                  {{ fmtDate(doc.receivedDate) }}
                </span>
                <span v-else-if="doc.status === 'pending' && doc.pendingReason" class="text-xs text-amber-500 italic max-w-32 truncate">
                  {{ doc.pendingReason }}
                </span>
                <UBadge
                  :label="DOC_STATUS_CONFIG[doc.status].label"
                  :color="DOC_STATUS_CONFIG[doc.status].color as any"
                  variant="subtle" size="xs"
                />
                <UButton size="sm" icon="i-ph-pencil" variant="ghost" color="neutral" @click="openDocEdit(doc)" />
                <UButton size="sm" icon="i-ph-trash" variant="ghost" color="error"
                  @click="crm.removeDocumentFromProject(selected!, doc.id)" />
              </div>
            </div>
          </div>

          <!-- Client contact info -->
          <div v-if="selectedProject.contactPerson" class="pt-2">
            <USeparator class="mb-3" />
            <p class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Контактное лицо</p>
            <div class="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
              <span class="flex items-center gap-1.5">
                <UIcon name="i-ph-user" class="w-4 h-4" />
                {{ selectedProject.contactPerson }}
              </span>
              <span v-if="selectedProject.contactPhone" class="flex items-center gap-1.5">
                <UIcon name="i-ph-phone" class="w-4 h-4" />
                {{ selectedProject.contactPhone }}
              </span>
              <span v-if="selectedProject.contactEmail" class="flex items-center gap-1.5">
                <UIcon name="i-ph-envelope" class="w-4 h-4" />
                {{ selectedProject.contactEmail }}
              </span>
            </div>
          </div>
        </div>

        <!-- ══════ FINANCE TAB ══════ -->
        <div v-if="detailTab === 'finance'" class="p-6 space-y-5">
          <!-- Summary cards -->
          <div v-if="financials" class="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div class="p-3 rounded-xl bg-green-50 dark:bg-green-950 border border-green-100 dark:border-green-900">
              <p class="text-xs text-green-600 dark:text-green-400 mb-1">Получено</p>
              <p class="font-bold text-green-700 dark:text-green-300 text-sm">{{ fmt(financials.totalInflow) }}</p>
            </div>
            <div class="p-3 rounded-xl bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900">
              <p class="text-xs text-red-500 mb-1">Выплачено</p>
              <p class="font-bold text-red-600 text-sm">{{ fmt(financials.totalOutflow) }}</p>
            </div>
            <div class="p-3 rounded-xl bg-blue-50 dark:bg-blue-950 border border-blue-100 dark:border-blue-900">
              <p class="text-xs text-blue-600 mb-1">Баланс</p>
              <p class="font-bold text-blue-700 text-sm">{{ fmt(financials.balance) }}</p>
            </div>
            <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
              <p class="text-xs text-slate-500 mb-1">Оплачено</p>
              <p class="font-bold text-slate-700 dark:text-slate-200 text-sm">{{ financials.paidPercent }}%</p>
            </div>
            <!-- 5th card: total staff payout -->
            <div class="p-3 rounded-xl bg-purple-50 dark:bg-purple-950 border border-purple-100 dark:border-purple-900">
              <p class="text-xs text-purple-600 dark:text-purple-400 mb-1">
                Выплат сотрудникам
                <span v-if="unpricedCount > 0" class="ml-1 text-amber-500">(+{{ unpricedCount }} б/ц)</span>
              </p>
              <p class="font-bold text-purple-700 dark:text-purple-300 text-sm">{{ fmt(totalStaffPayout) }}</p>
            </div>
          </div>

          <!-- Client milestones -->
          <div>
            <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Этапы оплаты клиента</p>
            <div class="space-y-2">
              <div
                v-for="ms in selectedProject.clientMilestones" :key="ms.id"
                class="flex items-center gap-3 p-3.5 rounded-xl border"
                :class="ms.status === 'paid'
                  ? 'bg-green-50 dark:bg-green-950 border-green-100 dark:border-green-900'
                  : isOverdue(ms.dueDate)
                    ? 'bg-red-50 dark:bg-red-950 border-red-100 dark:border-red-900'
                    : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'"
              >
                <UIcon
                  :name="ms.status === 'paid' ? 'i-ph-check-circle' : isOverdue(ms.dueDate) ? 'i-ph-warning' : 'i-ph-clock'"
                  class="w-5 h-5 shrink-0"
                  :class="ms.status === 'paid' ? 'text-green-500' : isOverdue(ms.dueDate) ? 'text-red-500' : 'text-slate-400'"
                />
                <span class="flex-1 text-sm font-medium text-slate-700 dark:text-slate-300">{{ ms.label }}</span>
                <span class="text-xs text-slate-400">{{ fmtDate(ms.dueDate) }}</span>
                <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">{{ fmt(ms.amount) }} сум</span>
                <UBadge
                  :label="ms.status === 'paid' ? 'Оплачен' : 'Ожидает'"
                  :color="ms.status === 'paid' ? 'success' : 'neutral'"
                  variant="subtle" size="xs"
                />
                <!-- Mark as paid button -->
                <UButton
                  v-if="ms.status !== 'paid'"
                  size="sm"
                  icon="i-ph-check"
                  color="success"
                  variant="soft"
                  @click="payMilestone(ms.id)"
                >
                  Оплачен
                </UButton>
              </div>
            </div>
          </div>

          <!-- Task payment splits -->
          <div>
            <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Выплаты сотрудникам</p>
            <div class="space-y-3">
              <div
                v-for="task in selectedProject.tasks.filter(t => t.price > 0)"
                :key="task.id"
                class="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800"
              >
                <div class="flex items-center justify-between mb-2">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {{ crm.taskMap[task.taskId]?.name ?? task.taskId }}
                    </span>
                    <UBadge :label="ROLE_LABELS[task.role as keyof typeof ROLE_LABELS]" color="neutral" variant="subtle" size="xs" />
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-slate-500">
                      {{ crm.staffById(task.staffId ?? '')?.name ?? 'Не назначен' }}
                    </span>
                    <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {{ fmt(task.price) }} сум
                    </span>
                  </div>
                </div>
                <!-- Split mini-bar -->
                <div class="flex gap-0.5 h-1.5 rounded-full overflow-hidden mb-2">
                  <div
                    v-for="sp in task.paymentSplits" :key="sp.id"
                    class="h-full transition-all"
                    :class="SPLIT_BAR_CLASS[sp.status]"
                    :style="{ width: sp.percent + '%' }"
                  />
                </div>
                <div class="flex gap-2 flex-wrap">
                  <div v-for="sp in task.paymentSplits" :key="sp.id" class="flex items-center gap-1 text-xs">
                    <div class="w-2 h-2 rounded-full" :class="SPLIT_BAR_CLASS[sp.status]" />
                    <span class="text-slate-500">{{ sp.label }}</span>
                    <span class="font-medium text-slate-700 dark:text-slate-300">{{ fmt(sp.amount) }}</span>
                  </div>
                </div>
              </div>

              <!-- Tasks without price -->
              <div
                v-if="selectedProject.tasks.filter(t => t.price === 0).length > 0"
                class="p-3.5 bg-amber-50 dark:bg-amber-950 rounded-xl border border-amber-100 dark:border-amber-900"
              >
                <div class="flex items-center gap-2 mb-2">
                  <UIcon name="i-ph-clock" class="w-4 h-4 text-amber-500 shrink-0" />
                  <span class="text-sm font-medium text-amber-700 dark:text-amber-300">
                    Задачи без цены ({{ selectedProject.tasks.filter(t => t.price === 0).length }})
                  </span>
                </div>
                <div class="space-y-1">
                  <div v-for="task in selectedProject.tasks.filter(t => t.price === 0)" :key="task.id + '-unpriced'"
                    class="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
                    <span class="w-1 h-1 rounded-full bg-amber-400 shrink-0" />
                    {{ crm.taskMap[task.taskId]?.name ?? task.taskId }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="flex-1 flex items-center justify-center text-slate-400">
      <div class="text-center">
        <UIcon name="i-ph-folder-open" class="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p class="font-medium">Выберите проект</p>
        <p class="text-sm mt-1 mb-4">или создайте новый</p>
        <UButton to="/pm/create" icon="i-ph-plus" size="sm">Новый проект</UButton>
      </div>
    </div>
  </div>

  <!-- ── Document edit modal ───────────────────────────────────────────────── -->
  <UModal v-model:open="showDocModal" :title="`Документ: ${editingDoc.name}`">
    <template #body>
      <div class="space-y-4">
        <UFormField label="Статус документа">
          <USelect v-model="editingDoc.status" :items="docStatusOptions" />
        </UFormField>
        <UFormField v-if="editingDoc.status === 'received'" label="Дата получения">
          <UInput type="date" v-model="editingDoc.receivedDate" class="w-full" />
        </UFormField>
        <UFormField v-if="editingDoc.status === 'pending'" label="Причина ожидания">
          <UInput v-model="editingDoc.pendingReason" placeholder="Заказчик не предоставил..." class="w-full" />
        </UFormField>
      </div>
    </template>
    <template #footer>
      <div class="flex gap-2 justify-end">
        <UButton variant="ghost" color="neutral" @click="showDocModal = false">Отмена</UButton>
        <UButton @click="saveDocStatus">Сохранить</UButton>
      </div>
    </template>
  </UModal>

  <!-- ── Add document modal ────────────────────────────────────────────────── -->
  <UModal v-model:open="showAddDocModal" title="Добавить документ">
    <template #body>
      <div class="space-y-4">
        <UFormField label="Этап">
          <USelect v-model="addDocStage" :items="STAGE_OPTIONS" class="w-full" />
        </UFormField>
        <div v-if="availableDocsForAdd.length === 0" class="text-sm text-slate-400 py-3 text-center">
          Все документы шаблона уже добавлены для этого этапа
        </div>
        <div v-else class="space-y-1.5">
          <button
            v-for="tmpl in availableDocsForAdd"
            :key="tmpl.id"
            class="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors text-left"
            @click="addDocument(tmpl)"
          >
            <UIcon name="i-ph-file-text" class="w-4 h-4 text-slate-400 shrink-0" />
            <span class="text-sm text-slate-700 dark:text-slate-300">{{ tmpl.name }}</span>
          </button>
        </div>
      </div>
    </template>
    <template #footer>
      <UButton variant="ghost" color="neutral" @click="showAddDocModal = false">Закрыть</UButton>
    </template>
  </UModal>

  <!-- ── Task edit / change request modal ─────────────────────────────────── -->
  <UModal v-model:open="showChangeModal" title="Предложить изменение задачи">
    <template #body>
      <div v-if="changingTask" class="space-y-4">
        <div class="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm">
          <p class="font-medium text-slate-700 dark:text-slate-300">
            {{ crm.taskMap[changingTask.taskId]?.name ?? changingTask.taskId }}
          </p>
          <p class="text-xs text-slate-400 mt-0.5">{{ ROLE_LABELS[changingTask.role as keyof typeof ROLE_LABELS] }}</p>
        </div>

        <UFormField label="Назначить исполнителя">
          <USelect
            :model-value="changeForm.newStaffId"
            @update:model-value="changeForm.newStaffId = $event as string | null"
            :items="staffAssignOptions"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Дедлайн">
          <UInput type="date" v-model="changeForm.newDeadline" class="w-full" />
        </UFormField>

        <UFormField label="Причина изменения" required>
          <UInput
            v-model="changeForm.reason"
            placeholder="Объясните необходимость изменения..."
            class="w-full"
          />
        </UFormField>

        <div class="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg text-xs text-blue-600 dark:text-blue-400">
          <UIcon name="i-ph-info" class="w-3.5 h-3.5 mt-0.5 shrink-0" />
          Изменение требует подтверждения исполнителя.
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex gap-2 justify-end">
        <UButton variant="ghost" color="neutral" @click="showChangeModal = false">Отмена</UButton>
        <UButton :disabled="!changeForm.reason.trim()" @click="submitTaskChange">
          Отправить на согласование
        </UButton>
      </div>
    </template>
  </UModal>

  <!-- ── ChangeRequest detail modal ───────────────────────────────────────── -->
  <UModal v-model:open="showCrDetailModal" title="Запрос на изменение">
    <template #body>
      <div v-if="viewingChangeRequest" class="space-y-4">
        <!-- Task info -->
        <div class="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm">
          <p class="text-xs text-slate-400 mb-1">Задача</p>
          <p class="font-medium text-slate-700 dark:text-slate-300">
            {{ crm.taskMap[viewingCrTask?.taskId ?? '']?.name ?? viewingCrTask?.taskId }}
          </p>
        </div>

        <!-- Reason -->
        <div>
          <p class="text-xs text-slate-500 mb-1">Причина</p>
          <p class="text-sm text-slate-700 dark:text-slate-300">{{ viewingChangeRequest.reason }}</p>
        </div>

        <!-- Changes -->
        <div>
          <p class="text-xs text-slate-500 mb-2">Изменения</p>
          <div class="space-y-1.5">
            <div v-for="(val, field) in viewingChangeRequest.changes" :key="field"
              class="flex items-center gap-2 text-sm">
              <span class="text-slate-500 w-24 shrink-0 capitalize">{{ field }}</span>
              <span class="text-red-500 line-through">{{ String(val.from || '—') }}</span>
              <UIcon name="i-ph-arrow-right" class="w-3 h-3 text-slate-400" />
              <span class="text-green-600 font-medium">{{ String(val.to || '—') }}</span>
            </div>
          </div>
        </div>

        <!-- Approvals -->
        <div>
          <p class="text-xs text-slate-500 mb-2">Статус согласования</p>
          <div class="space-y-1.5">
            <div v-for="appr in viewingChangeRequest.approvals" :key="appr.staffId"
              class="flex items-center gap-2 text-sm">
              <UIcon
                :name="appr.status === 'approved' ? 'i-ph-check-circle' : appr.status === 'rejected' ? 'i-ph-x-circle' : 'i-ph-clock'"
                class="w-4 h-4"
                :class="appr.status === 'approved' ? 'text-green-500' : appr.status === 'rejected' ? 'text-red-500' : 'text-amber-500'"
              />
              <span class="flex-1 text-slate-600 dark:text-slate-400">
                {{ crm.staffById(appr.staffId)?.name ?? appr.staffId }}
                <span class="text-xs text-slate-400 ml-1">({{ appr.role }})</span>
              </span>
              <UBadge
                :label="appr.status === 'approved' ? 'Одобрено' : appr.status === 'rejected' ? 'Отклонено' : 'Ожидает'"
                :color="appr.status === 'approved' ? 'success' : appr.status === 'rejected' ? 'error' : 'warning'"
                variant="subtle" size="xs"
              />
            </div>
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex gap-2 justify-between">
        <UButton variant="ghost" color="error" icon="i-ph-x" @click="cancelCr">Отозвать запрос</UButton>
        <UButton variant="ghost" color="neutral" @click="showCrDetailModal = false">Закрыть</UButton>
      </div>
    </template>
  </UModal>

  <!-- ── Add task to project modal ─────────────────────────────────────────── -->
  <UModal v-model:open="showAddTaskModal" title="Добавить услуги в проект" :ui="{ content: 'sm:max-w-3xl' }">
    <template #body>
      <ServiceSelectorPanel ref="serviceSelectorRef" />
    </template>
    <template #footer>
      <div class="flex gap-2 justify-end">
        <UButton variant="ghost" color="neutral" @click="showAddTaskModal = false">Отмена</UButton>
        <UButton
          :disabled="!serviceSelectorRef || Object.keys(serviceSelectorRef.selectedTasks).length === 0"
          @click="submitAddTask"
        >
          Добавить {{ serviceSelectorRef ? Object.keys(serviceSelectorRef.selectedTasks).length : 0 }} задач
        </UButton>
      </div>
    </template>
  </UModal>

  <!-- ── Edit project modal ────────────────────────────────────────────────── -->
  <UModal v-model:open="showEditModal" title="Редактировать проект">
    <template #body>
      <div class="space-y-4">
        <UFormField label="Название проекта">
          <UInput v-model="editForm.name" placeholder="ЖК «Нур Сити»" class="w-full" />
        </UFormField>
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Клиент">
            <UInput v-model="editForm.client" placeholder="ООО «Turon»" class="w-full" />
          </UFormField>
          <UFormField label="Местоположение">
            <UInput v-model="editForm.location" placeholder="Ташкент, Юнусабад" class="w-full" />
          </UFormField>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Тип проекта">
            <USelect v-model="editForm.type" :items="TYPE_OPTIONS_EDIT" class="w-full" />
          </UFormField>
          <UFormField label="Статус">
            <USelect v-model="editForm.status" :items="STATUS_OPTIONS" class="w-full" />
          </UFormField>
        </div>
        <UFormField label="Сумма контракта (сум)">
          <UInput v-model.number="editForm.contractAmount" type="number" min="0" class="w-full" />
        </UFormField>
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Дата начала">
            <UInput type="date" v-model="editForm.startDate" class="w-full" />
          </UFormField>
          <UFormField label="Плановое завершение">
            <UInput type="date" v-model="editForm.plannedEndDate" class="w-full" />
          </UFormField>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex gap-2 justify-end">
        <UButton variant="ghost" color="neutral" @click="showEditModal = false">Отмена</UButton>
        <UButton color="primary" icon="i-ph-floppy-disk" :disabled="!editForm.name.trim()" @click="saveEditModal">
          Сохранить
        </UButton>
      </div>
    </template>
  </UModal>
  </div>
</template>
