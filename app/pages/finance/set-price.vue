<script setup lang="ts">
import { useDebounce } from '@vueuse/core'
import { useAuthStore } from '~/stores/useAuthStore'
import { useCrmStore } from '~/stores/useCrmStore'
import { STAGE_SHORT_LABELS, STAGE_ICONS, ROLE_LABELS } from '~/constants/taskCatalog'
import { fmtMoney, parseMoney } from '~/utils/money'

definePageMeta({ layout: 'default', middleware: ['auth', 'role'] })

const auth  = useAuthStore()
const crm   = useCrmStore()
const toast = useToast()

const fmt = fmtMoney

// ── Unpriced tasks (filtered by selected project if set) ──────────────────────
const allUnpriced = computed(() => crm.unpricedTasks)

const unpricedTasks = computed(() => {
  if (!crm.selectedProjectId) return allUnpriced.value
  return allUnpriced.value.filter(({ project }) => project.id === crm.selectedProjectId)
})

// ── Pricing rows ──────────────────────────────────────────────────────────────
interface PricingRow {
  projectId: string
  taskId: string
  catalogName: string
  projectName: string
  staffName: string
  stage: string
  role: string
  price: string
  splitCount: number
  splits: Array<{ label: string; percent: string }>
}

const pricingRows = reactive<Record<string, PricingRow>>({})

watch(
  unpricedTasks,
  (tasks) => {
    for (const { project, task } of tasks) {
      const key = task.id
      if (!pricingRows[key]) {
        const staff = task.staffId ? crm.staffById(task.staffId) : null
        pricingRows[key] = {
          projectId:   project.id,
          taskId:      task.id,
          catalogName: crm.taskMap[task.taskId]?.name ?? task.taskId,
          projectName: project.name,
          staffName:   staff?.name ?? 'Не назначен',
          stage:       task.stage,
          role:        task.role,
          price:       '',
          splitCount:  3,
          splits:      defaultSplits(3),
        }
      }
    }
    const activeIds = new Set(tasks.map(({ task }) => task.id))
    for (const key of Object.keys(pricingRows)) {
      if (!activeIds.has(key)) delete pricingRows[key]
    }
  },
  { immediate: true },
)

function defaultSplits(count: number): Array<{ label: string; percent: string }> {
  if (count === 2) return [{ label: 'Аванс', percent: '50' }, { label: 'Финальный', percent: '50' }]
  if (count === 3) return [{ label: 'Аванс', percent: '30' }, { label: 'Промежуточный', percent: '40' }, { label: 'Финальный', percent: '30' }]
  if (count === 4) return [
    { label: 'Аванс', percent: '25' }, { label: 'Этап 2', percent: '25' },
    { label: 'Этап 3', percent: '25' }, { label: 'Финальный', percent: '25' },
  ]
  return [
    { label: 'Аванс', percent: '20' }, { label: 'Этап 2', percent: '20' },
    { label: 'Этап 3', percent: '20' }, { label: 'Этап 4', percent: '20' },
    { label: 'Финальный', percent: '20' },
  ]
}

// Preserve existing labels when split count changes — only add/remove entries
function onSplitCountChange(row: PricingRow) {
  const newCount = row.splitCount
  const defaults = defaultSplits(newCount)
  const current  = row.splits
  if (newCount > current.length) {
    // Append missing entries with default labels
    for (let i = current.length; i < newCount; i++) {
      current.push({ label: defaults[i]?.label ?? `Этап ${i + 1}`, percent: defaults[i]?.percent ?? '0' })
    }
  } else {
    // Remove extras, preserve the rest
    current.splice(newCount)
  }
  // Redistribute percentages evenly while keeping labels
  const even = Math.floor(100 / newCount)
  const remainder = 100 - even * newCount
  current.forEach((sp, i) => { sp.percent = String(even + (i === newCount - 1 ? remainder : 0)) })
}

function splitPctTotal(row: PricingRow) {
  return row.splits.reduce((s, sp) => s + (Number(sp.percent) || 0), 0)
}

function pricePreview(row: PricingRow, pct: string) {
  const price = parseMoney(row.price)
  if (!price) return '—'
  return fmt(Math.round(price * Number(pct) / 100))
}

function saveTaskPrice(row: PricingRow) {
  const price = parseMoney(row.price)
  if (!price || splitPctTotal(row) !== 100) return
  crm.setTaskPrice(
    row.projectId,
    row.taskId,
    price,
    row.splits.map(sp => ({ label: sp.label, percent: Number(sp.percent) })),
  )
  toast.add({ title: 'Цена сохранена', color: 'success' })
}

// ── Autosave ───────────────────────────────────────────────────────────────────
const autosaveEnabled = ref(true)

let autosaveTimer: ReturnType<typeof setTimeout> | null = null
watch(
  () => JSON.stringify(pricingRows),
  () => {
    if (!autosaveEnabled.value) return
    if (autosaveTimer) clearTimeout(autosaveTimer)
    autosaveTimer = setTimeout(() => {
      for (const row of Object.values(pricingRows)) {
        const price = parseMoney(row.price)
        if (price && splitPctTotal(row) === 100) saveTaskPrice(row)
      }
    }, 1500)
  },
)

// ── Batch mode ─────────────────────────────────────────────────────────────────
const batchMode  = ref(false)
const batchPrice = ref('')
const batchSplitCount = ref(3)
const batchSelected  = reactive<Set<string>>(new Set())

function toggleBatchSelect(taskId: string) {
  if (batchSelected.has(taskId)) batchSelected.delete(taskId)
  else batchSelected.add(taskId)
}

function applyBatch() {
  const price = parseMoney(batchPrice.value)
  if (!price || batchSelected.size === 0) return
  for (const taskId of batchSelected) {
    const row = pricingRows[taskId]
    if (!row) continue
    row.price = batchPrice.value
    row.splitCount = batchSplitCount.value
    onSplitCountChange(row)
    saveTaskPrice(row)
  }
  batchSelected.clear()
  batchPrice.value = ''
  batchMode.value = false
  toast.add({ title: `Цена применена к ${batchSelected.size || '—'} задачам`, color: 'success' })
}

const rows = computed(() => Object.values(pricingRows))
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <!-- Header -->
    <header class="h-16 flex items-center justify-between px-6 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 flex-shrink-0">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/25">
          <UIcon name="i-ph-tag" class="text-white w-5 h-5" />
        </div>
        <div>
          <h1 class="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Установить цену</h1>
          <p class="text-xs text-slate-400">Оцените задачи и настройте траншевые выплаты</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <UButton
          size="sm"
          :variant="autosaveEnabled ? 'soft' : 'ghost'"
          :color="autosaveEnabled ? 'success' : 'neutral'"
          :icon="autosaveEnabled ? 'i-ph-floppy-disk' : 'i-ph-floppy-disk'"
          @click="autosaveEnabled = !autosaveEnabled"
        >
          {{ autosaveEnabled ? 'Автосохр.' : 'Ручной' }}
        </UButton>
        <UButton
          size="sm"
          :variant="batchMode ? 'solid' : 'ghost'"
          :color="batchMode ? 'primary' : 'neutral'"
          icon="i-ph-stack"
          @click="batchMode = !batchMode"
        >
          Пакетный
        </UButton>
        <UBadge color="success" variant="soft" icon="i-ph-wallet">Финансист</UBadge>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-slate-950/50">
      <div class="max-w-3xl mx-auto space-y-4">

        <!-- Notification banner -->
        <div v-if="rows.length > 0"
          class="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 shadow-sm">
          <div class="w-9 h-9 bg-amber-100 dark:bg-amber-900/50 rounded-xl flex items-center justify-center shrink-0">
            <UIcon name="i-ph-bell-ringing" class="w-5 h-5 text-amber-600" />
          </div>
          <div class="flex-1">
            <p class="font-semibold text-amber-800 dark:text-amber-200">
              {{ rows.length }} задач{{
                rows.length === 1 ? 'а ожидает оценки' :
                rows.length < 5 ? 'и ожидают оценки' : ' ожидают оценки'
              }}
            </p>
            <p class="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              PM назначил задачи сотрудникам. Установите стоимость и траншевую разбивку для каждой задачи.
            </p>
          </div>
          <UBadge color="warning" variant="solid" size="lg">{{ rows.length }}</UBadge>
        </div>

        <!-- Empty state -->
        <div v-if="rows.length === 0" class="flex flex-col items-center justify-center py-24 text-slate-400">
          <div class="w-16 h-16 bg-green-100 dark:bg-green-950/30 rounded-2xl flex items-center justify-center mb-4">
            <UIcon name="i-ph-check-circle" class="w-8 h-8 text-green-500" />
          </div>
          <p class="text-base font-semibold text-slate-700 dark:text-slate-300 mb-1">Все задачи оценены!</p>
          <p class="text-sm text-slate-400">Нет задач, ожидающих установки цены</p>
        </div>

        <!-- Batch toolbar -->
        <div v-if="batchMode && rows.length > 0" class="flex items-center gap-3 p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60">
          <UIcon name="i-ph-stack" class="w-5 h-5 text-blue-500 shrink-0" />
          <p class="text-sm font-medium text-blue-700 dark:text-blue-300">
            Выбрано: {{ batchSelected.size }} задач
          </p>
          <MoneyInput v-model="batchPrice" placeholder="Единая цена" class="w-44" />
          <USelect
            v-model="batchSplitCount"
            :items="[{ label: '2 транша', value: 2 }, { label: '3 транша', value: 3 }, { label: '4 транша', value: 4 }]"
            class="w-32"
          />
          <UButton
            color="primary" size="sm" icon="i-ph-paper-plane-right"
            :disabled="!batchPrice || batchSelected.size === 0"
            @click="applyBatch"
          >
            Применить
          </UButton>
          <UButton color="neutral" variant="ghost" size="sm" @click="batchSelected.clear()">Сбросить</UButton>
        </div>

        <!-- Pricing cards -->
        <div
          v-for="row in rows" :key="row.taskId"
          class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm"
          :class="batchMode && batchSelected.has(row.taskId) ? 'ring-2 ring-blue-400 ring-offset-1' : ''"
        >
          <!-- Task info -->
          <div class="flex items-start justify-between gap-3 mb-4">
            <!-- Batch checkbox -->
            <div v-if="batchMode" class="shrink-0 pt-0.5">
              <input
                type="checkbox"
                class="w-4 h-4 rounded text-blue-500 cursor-pointer"
                :checked="batchSelected.has(row.taskId)"
                @change="toggleBatchSelect(row.taskId)"
              />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1.5 flex-wrap">
                <div class="flex items-center gap-1 text-xs text-slate-400">
                  <UIcon :name="STAGE_ICONS[row.stage as keyof typeof STAGE_ICONS]" class="w-3 h-3" />
                  {{ STAGE_SHORT_LABELS[row.stage as keyof typeof STAGE_SHORT_LABELS] }}
                </div>
                <span class="text-slate-200 dark:text-slate-700">·</span>
                <span class="text-xs text-slate-400">{{ ROLE_LABELS[row.role as keyof typeof ROLE_LABELS] }}</span>
                <span class="text-slate-200 dark:text-slate-700">·</span>
                <span class="text-xs text-slate-400">{{ row.projectName }}</span>
              </div>
              <p class="font-semibold text-slate-800 dark:text-slate-200">{{ row.catalogName }}</p>
              <p class="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                <UIcon name="i-ph-user" class="w-3 h-3" />
                {{ row.staffName }}
              </p>
            </div>
            <div class="w-8 h-8 bg-amber-100 dark:bg-amber-950/50 rounded-xl flex items-center justify-center shrink-0">
              <UIcon name="i-ph-tag" class="w-4 h-4 text-amber-600" />
            </div>
          </div>

          <!-- Price + split count -->
          <div class="flex items-end gap-3 mb-4">
            <UFormField label="Цена (сум)" class="flex-1">
              <MoneyInput v-model="row.price" class="w-full" />
            </UFormField>
            <UFormField label="Траншей">
              <USelect
                :model-value="row.splitCount"
                @update:model-value="row.splitCount = Number($event); onSplitCountChange(row)"
                :items="[
                  { label: '2 транша', value: 2 },
                  { label: '3 транша', value: 3 },
                  { label: '4 транша', value: 4 },
                  { label: '5 траншей', value: 5 },
                ]"
                class="w-36"
              />
            </UFormField>
          </div>

          <!-- Split rows -->
          <div class="space-y-2 mb-4">
            <div class="flex items-center gap-2 text-xs text-slate-500 font-medium px-1">
              <span class="flex-1">Название транша</span>
              <span class="w-20 text-right">%</span>
              <span class="w-28 text-right">Сумма</span>
            </div>
            <div
              v-for="(sp, i) in row.splits" :key="i"
              class="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl"
            >
              <UInput v-model="sp.label" placeholder="Название транша" class="flex-1" size="sm" />
              <div class="flex items-center gap-1 w-20 justify-end">
                <UInput v-model="sp.percent" type="number" min="0" max="100" class="w-14" size="sm" />
                <span class="text-slate-400 text-xs">%</span>
              </div>
              <span class="w-28 text-right text-xs font-mono font-medium text-slate-600 dark:text-slate-400">
                {{ pricePreview(row, sp.percent) }}
              </span>
            </div>
          </div>

          <!-- Validation + save -->
          <div class="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
            <div class="flex items-center gap-2">
              <div
                class="text-xs font-medium px-2.5 py-1 rounded-lg"
                :class="splitPctTotal(row) === 100
                  ? 'bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-400'
                  : 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400'"
              >
                {{ splitPctTotal(row) }}%
                <span v-if="splitPctTotal(row) !== 100"> / нужно 100%</span>
                <span v-else> ✓</span>
              </div>
              <span v-if="row.price && splitPctTotal(row) === 100" class="text-xs text-slate-400">
                Итого: {{ fmt(parseMoney(row.price)) }} сум
              </span>
            </div>
            <UButton
              color="success"
              icon="i-ph-floppy-disk"
              :disabled="!row.price || splitPctTotal(row) !== 100"
              @click="saveTaskPrice(row)"
            >
              Сохранить цену
            </UButton>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>
