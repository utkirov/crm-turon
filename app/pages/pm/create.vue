<script setup lang="ts">
import { z } from 'zod'
import { useAuthStore } from '~/stores/useAuthStore'
import { useCrmStore } from '~/stores/useCrmStore'
import {
  STAGES, STAGE_LABELS, STAGE_SHORT_LABELS,
  STAGE_ICONS, ROLE_LABELS, ROLE_ICONS,
} from '~/constants/taskCatalog'
import type { DesignStage, StageRole, ProjectType, CatalogTask } from '~/types/crm'

definePageMeta({ layout: 'default', middleware: ['auth'] })

const auth = useAuthStore()
const crm  = useCrmStore()
const router = useRouter()
const toast = useToast()

// ─── Step management ──────────────────────────────────────────────────────────
const step = ref(1)
const STEPS = [
  { n: 1, label: 'Данные',   icon: 'i-ph-file-text' },
  { n: 2, label: 'Задачи',   icon: 'i-ph-stack' },
  { n: 3, label: 'Команда',  icon: 'i-ph-users' },
]

// ─── Step 1: Project info ─────────────────────────────────────────────────────
const step1Schema = z.object({
  name:           z.string().min(3, 'Минимум 3 символа'),
  client:         z.string().min(2, 'Укажите заказчика'),
  location:       z.string().min(2, 'Укажите адрес'),
  type:           z.enum(['residential','commercial','education','infrastructure']),
  contractAmount: z.number().min(1_000_000, 'Минимум 1 000 000 сум'),
})

const info = reactive({
  name: '', client: '', location: '',
  type: 'residential' as ProjectType,
  contractAmount: 0,
  startDate: '', plannedEndDate: '',
  contactPerson: '', contactPhone: '', contactEmail: '',
})

// Real-time formatted display of contract amount
const contractAmountDisplay = computed(() =>
  info.contractAmount ? info.contractAmount.toLocaleString('ru-RU') : ''
)

function onContractAmountInput(val: string | number) {
  const num = Number(String(val).replace(/\D/g, '')) || 0
  info.contractAmount = num
}
const step1Errors = ref<Record<string, string>>({})
const contactExpanded = ref(false)

// Milestones (dynamic — add/remove rows)
const milestones = ref([
  { label: 'Аванс',        percent: 30, dueDate: '' },
  { label: 'Промежуточный', percent: 40, dueDate: '' },
  { label: 'Финальный',    percent: 30, dueDate: '' },
])

function addMilestone() {
  milestones.value.push({ label: '', percent: 0, dueDate: '' })
}
function removeMilestone(i: number) {
  if (milestones.value.length > 1) milestones.value.splice(i, 1)
}
const milestonePctTotal = computed(() => milestones.value.reduce((s, m) => s + (m.percent || 0), 0))

function validateStep1() {
  const r = step1Schema.safeParse({ ...info })
  step1Errors.value = {}
  if (!r.success) {
    r.error.issues.forEach(i => { step1Errors.value[i.path[0] as string] = i.message })
    return false
  }
  if (milestonePctTotal.value !== 100) {
    step1Errors.value['milestones'] = 'Сумма процентов должна равняться 100%'
    return false
  }
  return true
}

const TYPE_OPTIONS = [
  { label: 'Жилой',          value: 'residential' },
  { label: 'Коммерческий',   value: 'commercial' },
  { label: 'Образование',    value: 'education' },
  { label: 'Инфраструктура', value: 'infrastructure' },
]

// ─── Step 2: Stage & Task selection ──────────────────────────────────────────
const activeStage = ref<DesignStage>('sketch')
const activeRole  = ref<StageRole | null>(null)

watch(activeStage, () => { activeRole.value = null })

// { taskId → { deadline: string } }
interface SelectedTask { deadline: string }
const selectedTasks = reactive<Record<string, SelectedTask>>({})

function toggleTask(taskId: string) {
  if (selectedTasks[taskId]) {
    delete selectedTasks[taskId]
  } else {
    selectedTasks[taskId] = { deadline: '' }
  }
}

// Roles available for the active stage
const rolesForActiveStage = computed(() => getRolesForStage(activeStage.value))

// Tasks for the selected stage+role
const tasksForActiveSelection = computed(() => {
  if (!activeRole.value) return []
  return getTasksByStageAndRole(activeStage.value).get(activeRole.value) ?? []
})

// Selected count per role within a stage
function selectedCountForRole(stage: DesignStage, role: StageRole): number {
  return (getTasksByStageAndRole(stage).get(role) ?? []).filter(t => !!selectedTasks[t.id]).length
}

// Use store's editable task catalog so newly added tasks appear here
function getTasksByStageAndRole(stage: DesignStage): Map<StageRole, CatalogTask[]> {
  const map = new Map<StageRole, CatalogTask[]>()
  for (const task of crm.taskCatalog) {
    if (task.stage !== stage) continue
    if (!map.has(task.role)) map.set(task.role, [])
    map.get(task.role)!.push(task)
  }
  return map
}

function getRolesForStage(stage: DesignStage): StageRole[] {
  const roles = new Set<StageRole>()
  for (const task of crm.taskCatalog) {
    if (task.stage === stage) roles.add(task.role)
  }
  return Array.from(roles)
}

const selectedCountForStage = computed(() => (stage: DesignStage) => {
  return crm.taskCatalog.filter(t => t.stage === stage && !!selectedTasks[t.id]).length
})

function validateStep2() {
  if (Object.keys(selectedTasks).length === 0) {
    toast.add({ title: 'Выберите хотя бы одну задачу', color: 'warning', icon: 'i-ph-warning' })
    return false
  }
  return true
}

// ─── Document selection ───────────────────────────────────────────────────────
// { templateId → true }
const selectedDocs = reactive<Record<string, boolean>>({})

const docsForActiveStage = computed(() =>
  crm.documentTemplates.filter(d => d.stage === activeStage.value)
)

function toggleDoc(templateId: string) {
  if (selectedDocs[templateId]) {
    delete selectedDocs[templateId]
  } else {
    selectedDocs[templateId] = true
  }
}

function selectAllDocsForStage() {
  for (const d of docsForActiveStage.value) {
    selectedDocs[d.id] = true
  }
}

const docSectionCollapsed = ref(false)

// ─── Step 3: Staff assignment ─────────────────────────────────────────────────
// { taskId → staffId }
const assignments = reactive<Record<string, string | null>>({})

// Watch selected tasks — ensure assignment entries exist
watch(
  () => Object.keys(selectedTasks),
  (taskIds) => {
    // Add entries for new selections
    for (const id of taskIds) {
      if (!(id in assignments)) assignments[id] = null
    }
    // Remove entries for deselected tasks
    for (const id of Object.keys(assignments)) {
      if (!taskIds.includes(id)) delete assignments[id]
    }
  },
  { immediate: true },
)

// Staff options filtered by the task's role
function staffOptionsForTask(taskId: string) {
  const catalogTask = crm.taskMap[taskId]
  const workers = catalogTask
    ? crm.staffWorkers.filter(s => s.specialization && s.role === 'staff')
    : crm.staffWorkers
  // Try to match by role if catalog task has role info
  const filtered = catalogTask
    ? crm.staffWorkers.filter(s => {
        // Match staff whose specialization aligns with the task role
        const roleKeywords: Record<string, string[]> = {
          architect: ['архитектор', 'гап', 'гип'],
          designer:  ['дизайнер', 'visualization'],
          engineer:  ['инженер', 'гкп', 'конструктор'],
          constructor: ['конструктор', 'гкп'],
          surveyor:  ['эксперт', 'инспектор', 'surveyor'],
        }
        const keywords = roleKeywords[catalogTask.role] ?? []
        const specLower = (s.specialization ?? '').toLowerCase()
        const posLower  = (s.position ?? '').toLowerCase()
        return keywords.some(k => specLower.includes(k) || posLower.includes(k))
      })
    : workers
  const list = filtered.length > 0 ? filtered : crm.staffWorkers
  return [
    { label: 'Не назначен', value: null },
    ...list.map(s => ({ label: `${s.name} (${s.position ?? s.specialization})`, value: s.id })),
  ]
}

function validateStep3() { return true } // staff assignment is optional

// ─── Navigation ───────────────────────────────────────────────────────────────
function nextStep() {
  if (step.value === 1 && !validateStep1()) return
  if (step.value === 2 && !validateStep2()) return
  step.value++
}
function prevStep() { step.value-- }

// ─── Submit ───────────────────────────────────────────────────────────────────
const submitting = ref(false)

async function submit() {
  submitting.value = true
  try {
    const tasksPayload = Object.entries(selectedTasks).map(([taskId, sel]) => ({
      taskId,
      staffId: assignments[taskId] ?? null,
      deadline: sel.deadline || undefined,
    }))

    const selectedDocTemplates = crm.documentTemplates
      .filter(d => selectedDocs[d.id])
      .map(d => ({ templateId: d.id, name: d.name, stage: d.stage }))

    crm.createProject({
      name: info.name,
      client: info.client,
      location: info.location,
      type: info.type,
      pmId: auth.currentUser?.id ?? 'dilshod',
      contractAmount: info.contractAmount,
      startDate: info.startDate || undefined,
      plannedEndDate: info.plannedEndDate || undefined,
      contactPerson: info.contactPerson || undefined,
      contactPhone: info.contactPhone || undefined,
      contactEmail: info.contactEmail || undefined,
      milestones: milestones.value.map(m => ({
        label: m.label,
        percent: m.percent,
        dueDate: m.dueDate || undefined,
      })),
      tasks: tasksPayload,
      documents: selectedDocTemplates,
    })

    await router.push('/pm/projects')
  } finally {
    submitting.value = false
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString('ru-RU')

const STAGE_STATUS_COLOR: Record<string, string> = {
  completed: 'text-green-600',
  active: 'text-blue-600',
  pending: 'text-slate-400',
}

const selectedTasksList = computed(() =>
  Object.keys(selectedTasks)
    .map(id => ({ ...crm.taskMap[id], deadline: selectedTasks[id]?.deadline, staffId: assignments[id] }))
    .filter(Boolean)
)

const stagesInSelection = computed(() =>
  [...new Set(selectedTasksList.value.map(t => t?.stage))].filter(Boolean)
)
</script>

<template>
  <div class="min-h-screen bg-slate-100/80 dark:bg-slate-950 p-8">
    <!-- Header with step indicator -->
    <div class="max-w-4xl mx-auto">
      <div class="flex items-center gap-4 mb-8">
        <UButton icon="i-ph-arrow-left" variant="ghost" color="neutral" to="/pm/projects" class="rounded-xl" />
        <div class="flex-1">
          <h1 class="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Новый проект</h1>
          <p class="text-sm text-slate-400 mt-0.5">Заполните данные по шагам</p>
        </div>

        <!-- Step progress -->
        <div class="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl px-4 py-2.5">
          <template v-for="(s, idx) in STEPS" :key="s.n">
            <div class="flex items-center gap-1.5">
              <div
                class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                :class="step > s.n
                  ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                  : step === s.n
                    ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm shadow-blue-500/30'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400'"
              >
                <UIcon v-if="step > s.n" name="i-ph-check" class="w-3.5 h-3.5" />
                <span v-else>{{ s.n }}</span>
              </div>
              <span
                class="text-sm font-medium hidden sm:block"
                :class="step === s.n ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'"
              >{{ s.label }}</span>
            </div>
            <div v-if="idx < STEPS.length - 1" class="w-8 h-px bg-slate-200 dark:bg-slate-700 mx-1" />
          </template>
        </div>
      </div>

      <!-- ════════════════════════════════════════════════════════════
           STEP 1 — PROJECT INFO
      ════════════════════════════════════════════════════════════ -->
      <div v-if="step === 1">
        <UCard class="mb-4">
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-ph-file-text" class="w-4 h-4 text-blue-500" />
              <span class="font-semibold">Основная информация</span>
            </div>
          </template>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <!-- Name -->
            <UFormField label="Название проекта" required class="sm:col-span-2"
              :error="step1Errors.name">
              <UInput v-model="info.name" placeholder='ЖК «Пример»' class="w-full" />
            </UFormField>

            <!-- Client -->
            <UFormField label="Заказчик" required :error="step1Errors.client">
              <UInput v-model="info.client" placeholder='ООО «Инвест»' class="w-full" />
            </UFormField>

            <!-- Location -->
            <UFormField label="Адрес / Локация" required :error="step1Errors.location">
              <UInput v-model="info.location" placeholder="Ташкент, Юнусабадский р-н" class="w-full" />
            </UFormField>

            <!-- Type -->
            <UFormField label="Тип объекта" required :error="step1Errors.type">
              <USelect v-model="info.type" :items="TYPE_OPTIONS" class="w-full" />
            </UFormField>

            <!-- Contract amount -->
            <UFormField label="Сумма контракта (сум)" required :error="step1Errors.contractAmount">
              <UInput
                :model-value="contractAmountDisplay"
                @update:model-value="onContractAmountInput($event)"
                placeholder="450 000 000"
                class="w-full"
                inputmode="numeric"
              />
            </UFormField>

            <!-- Dates -->
            <UFormField label="Дата начала">
              <UInput type="date" v-model="info.startDate" class="w-full" />
            </UFormField>
            <UFormField label="Плановое завершение">
              <UInput type="date" v-model="info.plannedEndDate" class="w-full" />
            </UFormField>
          </div>
        </UCard>

        <!-- Client milestones -->
        <UCard class="mb-4">
          <template #header>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon name="i-ph-calendar-check" class="w-4 h-4 text-green-500" />
                <span class="font-semibold">Этапы оплаты клиента</span>
              </div>
              <div class="flex items-center gap-2">
                <span
                  class="text-sm font-medium"
                  :class="milestonePctTotal === 100 ? 'text-green-600' : 'text-amber-600'"
                >{{ milestonePctTotal }}%</span>
                <UButton size="sm" icon="i-ph-plus" variant="soft" @click="addMilestone">
                  Добавить
                </UButton>
              </div>
            </div>
          </template>

          <p v-if="step1Errors.milestones" class="text-xs text-red-500 mb-3">{{ step1Errors.milestones }}</p>

          <div class="space-y-2">
            <div v-for="(ms, i) in milestones" :key="i"
              class="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <UInput v-model="ms.label" placeholder="Название этапа" class="flex-1 min-w-0" size="sm" />
              <div class="flex items-center gap-1 shrink-0">
                <UInput
                  :model-value="ms.percent"
                  @update:model-value="ms.percent = Number($event) || 0"
                  type="number" min="0" max="100"
                  class="w-16" size="sm"
                />
                <span class="text-slate-500 text-sm">%</span>
              </div>
              <UInput type="date" v-model="ms.dueDate" class="w-36 shrink-0" size="sm" />
              <UButton
                v-if="milestones.length > 1"
                icon="i-ph-x" size="xs" variant="ghost" color="red"
                @click="removeMilestone(i)"
              />
            </div>
          </div>
        </UCard>

        <!-- Contact (collapsible) -->
        <UCard class="mb-6">
          <button
            class="w-full flex items-center justify-between text-sm font-medium text-slate-700 dark:text-slate-300"
            @click="contactExpanded = !contactExpanded"
          >
            <div class="flex items-center gap-2">
              <UIcon name="i-ph-user" class="w-4 h-4 text-slate-400" />
              Контактное лицо <span class="text-slate-400 font-normal">(необязательно)</span>
            </div>
            <UIcon
              :name="contactExpanded ? 'i-ph-caret-up' : 'i-ph-caret-down'"
              class="w-4 h-4 text-slate-400"
            />
          </button>
          <div v-if="contactExpanded" class="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <UFormField label="Имя контакта">
              <UInput v-model="info.contactPerson" placeholder="Бобур Хасанов" class="w-full" />
            </UFormField>
            <UFormField label="Телефон">
              <UInput v-model="info.contactPhone" placeholder="+998 90 123-45-67" class="w-full" />
            </UFormField>
            <UFormField label="Email">
              <UInput v-model="info.contactEmail" placeholder="name@company.uz" class="w-full" />
            </UFormField>
          </div>
        </UCard>

        <div class="flex justify-end">
          <UButton icon="i-ph-arrow-right" trailing @click="nextStep">Далее</UButton>
        </div>
      </div>

      <!-- ════════════════════════════════════════════════════════════
           STEP 2 — STAGE → ROLE → TASKS SELECTION
      ════════════════════════════════════════════════════════════ -->
      <div v-if="step === 2">
        <!-- 3-column selection panel -->
        <div class="flex gap-3 min-h-80 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden p-4">

          <!-- Col 1: Stage selector -->
          <div class="w-48 shrink-0">
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
                <span
                  v-if="selectedCountForStage(stage) > 0"
                  class="text-xs font-semibold text-blue-600 dark:text-blue-400 shrink-0"
                >
                  {{ selectedCountForStage(stage) }}
                </span>
              </button>
            </div>
          </div>

          <!-- Divider -->
          <div class="w-px bg-slate-200 dark:bg-slate-700 self-stretch" />

          <!-- Col 2: Role selector -->
          <div class="w-44 shrink-0">
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
                <span
                  v-if="selectedCountForRole(activeStage, role) > 0"
                  class="text-xs font-semibold text-indigo-600 dark:text-indigo-400 shrink-0"
                >
                  {{ selectedCountForRole(activeStage, role) }}
                </span>
              </button>
            </div>
          </div>

          <!-- Divider -->
          <div class="w-px bg-slate-200 dark:bg-slate-700 self-stretch" />

          <!-- Col 3: Tasks for selected stage + role -->
          <div class="flex-1 min-w-0">
            <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 px-1">3. Задачи</p>

            <!-- Prompt to pick role -->
            <div v-if="!activeRole" class="flex flex-col items-center justify-center py-12 text-slate-400">
              <UIcon name="i-ph-arrow-left" class="w-6 h-6 mb-2 opacity-40" />
              <p class="text-sm">Выберите специалиста</p>
            </div>

            <!-- Tasks list -->
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
                <!-- Deadline input when selected -->
                <div v-if="selectedTasks[task.id]" class="flex items-center gap-1.5 shrink-0" @click.stop>
                  <UIcon name="i-ph-calendar" class="w-3.5 h-3.5 text-slate-400" />
                  <UInput
                    type="date"
                    v-model="selectedTasks[task.id].deadline"
                    size="xs"
                    class="w-36"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Source documents section -->
        <div class="mt-4">
          <UCard :ui="{ body: 'p-0' }">
            <button
              class="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300"
              @click="docSectionCollapsed = !docSectionCollapsed"
            >
              <UIcon name="i-ph-files" class="w-5 h-5 text-orange-500 shrink-0" />
              <span class="flex-1 text-left">Исходные документы — {{ STAGE_SHORT_LABELS[activeStage] }}</span>
              <UBadge
                v-if="docsForActiveStage.filter(d => selectedDocs[d.id]).length > 0"
                color="orange" variant="subtle" size="xs"
              >
                {{ docsForActiveStage.filter(d => selectedDocs[d.id]).length }} выбрано
              </UBadge>
              <UButton
                v-if="docsForActiveStage.length > 0"
                size="xs" variant="ghost" color="primary" class="mr-1"
                @click.stop="selectAllDocsForStage()"
              >
                Выбрать все
              </UButton>
              <UIcon
                :name="docSectionCollapsed ? 'i-ph-caret-down' : 'i-ph-caret-up'"
                class="w-4 h-4 text-slate-400"
              />
            </button>
            <div
              v-if="!docSectionCollapsed"
              class="border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-50 dark:divide-slate-800/50"
            >
              <div v-if="docsForActiveStage.length === 0" class="px-4 py-3 text-xs text-slate-400 italic">
                Нет шаблонов документов для этого этапа
              </div>
              <div
                v-for="doc in docsForActiveStage" :key="doc.id"
                class="flex items-center gap-3 px-4 py-2.5 cursor-pointer"
                :class="selectedDocs[doc.id] ? 'bg-orange-50/50 dark:bg-orange-950/20' : ''"
                @click="toggleDoc(doc.id)"
              >
                <UCheckbox
                  :model-value="!!selectedDocs[doc.id]"
                  @update:model-value="toggleDoc(doc.id)"
                  @click.stop
                />
                <UIcon name="i-ph-file-text" class="w-4 h-4 text-slate-400 shrink-0" />
                <span class="flex-1 text-sm text-slate-700 dark:text-slate-300">{{ doc.name }}</span>
                <UBadge color="orange" variant="soft" size="xs" v-if="selectedDocs[doc.id]">Ожидается</UBadge>
              </div>
            </div>
          </UCard>
        </div>

        <!-- Selection summary bar -->
        <div v-if="Object.keys(selectedTasks).length > 0"
          class="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-xl flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
          <UIcon name="i-ph-check-circle" class="w-4 h-4 shrink-0" />
          Выбрано <strong>{{ Object.keys(selectedTasks).length }}</strong> задач
          в {{ stagesInSelection.length }} этапе(-ах)
          <span v-if="Object.keys(selectedDocs).length > 0" class="ml-2 text-orange-600">
            · {{ Object.keys(selectedDocs).length }} документов
          </span>
        </div>

        <div class="flex justify-between mt-6">
          <UButton variant="ghost" icon="i-ph-arrow-left" @click="prevStep">Назад</UButton>
          <UButton icon="i-ph-arrow-right" trailing @click="nextStep">Далее</UButton>
        </div>
      </div>

      <!-- ════════════════════════════════════════════════════════════
           STEP 3 — STAFF ASSIGNMENT (no prices — financier sets later)
      ════════════════════════════════════════════════════════════ -->
      <div v-if="step === 3">
        <div class="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950 rounded-xl mb-4 text-sm text-amber-700 dark:text-amber-300">
          <UIcon name="i-ph-info" class="w-4 h-4 mt-0.5 shrink-0" />
          <span>Цены за задачи устанавливает <strong>финансист</strong> после создания проекта. Здесь только назначьте исполнителей.</span>
        </div>

        <!-- Group tasks by stage -->
        <div v-for="stage in STAGES" :key="stage" class="mb-4">
          <template v-if="selectedTasksList.filter(t => t?.stage === stage).length > 0">
            <div class="flex items-center gap-2 mb-2">
              <UIcon :name="STAGE_ICONS[stage]" class="w-4 h-4 text-slate-400" />
              <span class="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {{ STAGE_SHORT_LABELS[stage] }}
              </span>
            </div>

            <div class="space-y-2">
              <div
                v-for="t in selectedTasksList.filter(tt => tt?.stage === stage)"
                :key="t?.id"
                class="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800"
              >
                <!-- Role badge -->
                <div class="flex items-center gap-1.5 w-36 shrink-0">
                  <UIcon :name="ROLE_ICONS[t!.role]" class="w-3.5 h-3.5 text-slate-400" />
                  <span class="text-xs text-slate-500">{{ ROLE_LABELS[t!.role] }}</span>
                </div>

                <!-- Task name -->
                <span class="flex-1 text-sm font-medium text-slate-800 dark:text-slate-200">
                  {{ t?.name }}
                </span>

                <!-- Deadline (read-only) -->
                <div v-if="t?.deadline" class="flex items-center gap-1 text-xs text-slate-400 shrink-0">
                  <UIcon name="i-ph-calendar" class="w-3 h-3" />
                  {{ t.deadline }}
                </div>

                <!-- Staff selector (filtered by task role) -->
                <USelect
                  :model-value="assignments[t!.id]"
                  @update:model-value="assignments[t!.id] = $event as string | null"
                  :items="staffOptionsForTask(t!.taskId)"
                  size="sm"
                  class="w-52 shrink-0"
                  placeholder="Не назначен"
                />
              </div>
            </div>
          </template>
        </div>

        <!-- Summary -->
        <UCard class="bg-slate-50 dark:bg-slate-900 mt-4">
          <div class="flex flex-wrap gap-4 text-sm">
            <div>
              <span class="text-slate-500">Проект:</span>
              <span class="ml-1 font-medium text-slate-800 dark:text-slate-200">{{ info.name }}</span>
            </div>
            <div>
              <span class="text-slate-500">Контракт:</span>
              <span class="ml-1 font-medium text-slate-800 dark:text-slate-200">{{ fmt(info.contractAmount) }} сум</span>
            </div>
            <div>
              <span class="text-slate-500">Задач:</span>
              <span class="ml-1 font-medium text-slate-800 dark:text-slate-200">{{ Object.keys(selectedTasks).length }}</span>
            </div>
            <div>
              <span class="text-slate-500">Назначено:</span>
              <span class="ml-1 font-medium text-green-600">
                {{ Object.values(assignments).filter(Boolean).length }}
              </span>
            </div>
          </div>
        </UCard>

        <div class="flex justify-between mt-6">
          <UButton variant="ghost" icon="i-ph-arrow-left" @click="prevStep">Назад</UButton>
          <UButton
            icon="i-ph-check" color="green"
            :loading="submitting"
            @click="submit"
          >
            Создать проект
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
