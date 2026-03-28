<script setup lang="ts">
import { useAuthStore } from '~/stores/useAuthStore'
import { useCrmStore } from '~/stores/useCrmStore'
import { STAGE_SHORT_LABELS, STAGE_ICONS, ROLE_LABELS } from '~/constants/taskCatalog'

definePageMeta({ layout: 'default', middleware: ['auth'] })

const auth = useAuthStore()
const crm  = useCrmStore()

const fmt = (n: number) => n.toLocaleString('ru-RU')

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

function onSplitCountChange(row: PricingRow) {
  row.splits = defaultSplits(row.splitCount)
}

function splitPctTotal(row: PricingRow) {
  return row.splits.reduce((s, sp) => s + (Number(sp.percent) || 0), 0)
}

function pricePreview(row: PricingRow, pct: string) {
  const price = Number(row.price.replace(/[\s,]/g, ''))
  if (!price) return '—'
  return fmt(Math.round(price * Number(pct) / 100))
}

function saveTaskPrice(row: PricingRow) {
  const price = Number(row.price.replace(/[\s,]/g, ''))
  if (!price || splitPctTotal(row) !== 100) return
  crm.setTaskPrice(
    row.projectId,
    row.taskId,
    price,
    row.splits.map(sp => ({ label: sp.label, percent: Number(sp.percent) })),
  )
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
        <span v-if="crm.selectedProjectId" class="text-xs text-slate-500 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <UIcon name="i-ph-buildings" class="w-3.5 h-3.5 inline mr-1 text-slate-400" />
          {{ crm.projects.find(p => p.id === crm.selectedProjectId)?.name }}
        </span>
        <UBadge color="green" variant="soft" icon="i-ph-wallet">Финансист</UBadge>
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
          <UBadge color="amber" variant="solid" size="lg">{{ rows.length }}</UBadge>
        </div>

        <!-- Empty state -->
        <div v-if="rows.length === 0" class="flex flex-col items-center justify-center py-24 text-slate-400">
          <div class="w-16 h-16 bg-green-100 dark:bg-green-950/30 rounded-2xl flex items-center justify-center mb-4">
            <UIcon name="i-ph-check-circle" class="w-8 h-8 text-green-500" />
          </div>
          <p class="text-base font-semibold text-slate-700 dark:text-slate-300 mb-1">Все задачи оценены!</p>
          <p class="text-sm text-slate-400">Нет задач, ожидающих установки цены</p>
        </div>

        <!-- Pricing cards -->
        <div
          v-for="row in rows" :key="row.taskId"
          class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm"
        >
          <!-- Task info -->
          <div class="flex items-start justify-between gap-3 mb-4">
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
              <UInput
                v-model="row.price"
                placeholder="5 000 000"
                inputmode="numeric"
                class="w-full"
              />
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
                Итого: {{ fmt(Number(row.price.replace(/[\s,]/g, ''))) }} сум
              </span>
            </div>
            <UButton
              color="green"
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
