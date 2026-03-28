<script setup lang="ts">
import { useCrmStore } from '~/stores/useCrmStore'
import type { TransactionCategory } from '~/types/crm'

definePageMeta({ layout: 'default', middleware: ['auth'] })

const crm = useCrmStore()
const fmt = (n: number) => n.toLocaleString('ru-RU')

// ── Filters ───────────────────────────────────────────────────────────────────
const filterType    = ref<'all' | 'inflow' | 'outflow'>('all')
const filterProject = ref<string>('all')
const searchQuery   = ref('')

const projectOptions = computed(() => [
  { label: 'Все проекты', value: 'all' },
  ...crm.projects.map(p => ({ label: p.name, value: p.id }))
])

const typeOptions = [
  { label: 'Все',    value: 'all' },
  { label: 'Приход', value: 'inflow' },
  { label: 'Расход', value: 'outflow' }
]

// ── Filtered transactions (newest first) ──────────────────────────────────────
const filtered = computed(() => {
  let txs = [...crm.transactions].sort((a, b) => b.date.localeCompare(a.date))
  if (filterType.value !== 'all')    txs = txs.filter(t => t.type === filterType.value)
  if (filterProject.value !== 'all') txs = txs.filter(t => t.projectId === filterProject.value)
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    txs = txs.filter(t => t.description.toLowerCase().includes(q))
  }
  return txs
})

// ── Totals for filtered set ───────────────────────────────────────────────────
const totalInflow  = computed(() => filtered.value.filter(t => t.type === 'inflow').reduce((s, t) => s + t.amount, 0))
const totalOutflow = computed(() => filtered.value.filter(t => t.type === 'outflow').reduce((s, t) => s + t.amount, 0))
const netBalance   = computed(() => totalInflow.value - totalOutflow.value)

// ── Project name lookup ───────────────────────────────────────────────────────
const projectName = (id: string) => crm.projects.find(p => p.id === id)?.name ?? id

// ── CSV Export ────────────────────────────────────────────────────────────────
function exportCsv() {
  const header = 'Дата,Тип,Проект,Описание,Сумма'
  const rows = filtered.value.map(t =>
    [
      t.date,
      t.type === 'inflow' ? 'Приход' : 'Расход',
      `"${projectName(t.projectId)}"`,
      `"${t.description}"`,
      t.type === 'inflow' ? t.amount : -t.amount
    ].join(',')
  )
  const csv = [header, ...rows].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Add Transaction Modal ─────────────────────────────────────────────────────
const addTxOpen = ref(false)
const addTxForm = reactive({
  date: new Date().toISOString().split('T')[0],
  type: 'outflow' as 'inflow' | 'outflow',
  projectId: crm.projects[0]?.id ?? '',
  category: 'expense' as TransactionCategory,
  description: '',
  amount: 0
})

const categoryOptions = [
  { label: 'Оплата клиента',    value: 'client_payment' },
  { label: 'Выплата сотруднику', value: 'staff_payment' },
  { label: 'Расход',            value: 'expense' }
]

const addTxTypeOptions = [
  { label: 'Приход', value: 'inflow' },
  { label: 'Расход', value: 'outflow' }
]

function openAddTx() {
  addTxForm.date = new Date().toISOString().split('T')[0]
  addTxForm.type = 'outflow'
  addTxForm.projectId = crm.projects[0]?.id ?? ''
  addTxForm.category = 'expense'
  addTxForm.description = ''
  addTxForm.amount = 0
  addTxOpen.value = true
}

function submitAddTx() {
  if (!addTxForm.description.trim() || addTxForm.amount <= 0 || !addTxForm.projectId) return
  crm.addTransaction({ ...addTxForm })
  addTxOpen.value = false
}

const addTxValid = computed(() =>
  addTxForm.description.trim().length > 0 &&
  addTxForm.amount > 0 &&
  !!addTxForm.projectId
)
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <header class="h-16 flex items-center justify-between px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
      <div>
        <h1 class="text-lg font-bold text-slate-900 dark:text-white">Транзакции</h1>
        <p class="text-xs text-slate-500">{{ filtered.length }} записей</p>
      </div>
      <div class="flex items-center gap-3">
        <UBadge color="green" variant="soft" icon="i-ph-wallet">Финансист</UBadge>
        <UButton
          size="sm" color="primary" variant="solid"
          icon="i-ph-plus"
          @click="openAddTx"
        >
          Добавить
        </UButton>
        <UButton
          size="sm" color="neutral" variant="outline"
          icon="i-ph-download"
          @click="exportCsv"
        >
          Экспорт CSV
        </UButton>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto p-6 space-y-5">

      <!-- Summary cards -->
      <div class="grid grid-cols-3 gap-4">
        <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5">
          <div class="flex items-center gap-3.5">
            <div class="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-green-50 dark:bg-green-900/20">
              <UIcon name="i-ph-arrow-circle-down" class="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p class="text-lg font-bold text-green-600 leading-tight">+{{ fmt(totalInflow) }}</p>
              <p class="text-[11px] text-slate-400 mt-0.5 font-medium">Приход</p>
            </div>
          </div>
        </div>
        <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5">
          <div class="flex items-center gap-3.5">
            <div class="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-red-50 dark:bg-red-900/20">
              <UIcon name="i-ph-arrow-circle-up" class="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p class="text-lg font-bold text-red-500 leading-tight">-{{ fmt(totalOutflow) }}</p>
              <p class="text-[11px] text-slate-400 mt-0.5 font-medium">Расход</p>
            </div>
          </div>
        </div>
        <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5">
          <div class="flex items-center gap-3.5">
            <div class="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" :class="netBalance >= 0 ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-red-50 dark:bg-red-900/20'">
              <UIcon name="i-ph-scales" class="w-5 h-5" :class="netBalance >= 0 ? 'text-blue-600' : 'text-red-600'" />
            </div>
            <div>
              <p class="text-lg font-bold leading-tight" :class="netBalance >= 0 ? 'text-blue-600' : 'text-red-600'">
                {{ netBalance >= 0 ? '+' : '' }}{{ fmt(netBalance) }}
              </p>
              <p class="text-[11px] text-slate-400 mt-0.5 font-medium">Баланс</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Filters -->
      <div class="flex items-center gap-3 flex-wrap">
        <UInput
          v-model="searchQuery"
          placeholder="Поиск по описанию..."
          icon="i-ph-magnifying-glass"
          class="w-60"
          size="sm"
        />
        <USelect
          v-model="filterProject"
          :items="projectOptions"
          class="w-52"
          size="sm"
        />
        <div class="flex gap-1">
          <UButton
            v-for="opt in typeOptions" :key="opt.value"
            size="sm"
            :color="filterType === opt.value ? 'primary' : 'neutral'"
            :variant="filterType === opt.value ? 'solid' : 'outline'"
            @click="filterType = opt.value as any"
          >
            {{ opt.label }}
          </UButton>
        </div>
        <UButton
          v-if="searchQuery || filterProject !== 'all' || filterType !== 'all'"
          size="sm" color="neutral" variant="ghost"
          icon="i-ph-x"
          @click="searchQuery = ''; filterProject = 'all'; filterType = 'all'"
        >
          Сбросить
        </UButton>
      </div>

      <!-- Transaction table -->
      <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <p class="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <UIcon name="i-ph-receipt" class="w-4 h-4 text-slate-500" />
            Журнал транзакций
            <span class="text-xs font-normal text-slate-400 ml-1">({{ filtered.length }})</span>
          </p>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-[11px] text-slate-400 border-b border-slate-100 dark:border-slate-800 uppercase tracking-wider">
                <th class="text-left pb-3 pt-1 px-6 font-medium">Дата</th>
                <th class="text-left pb-3 pt-1 font-medium">Тип</th>
                <th class="text-left pb-3 pt-1 font-medium">Проект</th>
                <th class="text-left pb-3 pt-1 font-medium">Описание</th>
                <th class="text-right pb-3 pt-1 pr-6 font-medium">Сумма (сум)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="filtered.length === 0">
                <td colspan="5" class="py-12 text-center text-slate-400 text-sm">
                  <UIcon name="i-ph-tray" class="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>Нет транзакций по выбранным фильтрам</p>
                </td>
              </tr>
              <tr
                v-for="tx in filtered"
                :key="tx.id"
                class="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors"
              >
                <td class="py-3 px-6 text-xs text-slate-500 font-mono">{{ tx.date }}</td>
                <td class="py-3">
                  <UBadge
                    :color="tx.type === 'inflow' ? 'green' : 'red'"
                    variant="soft" size="xs"
                    :icon="tx.type === 'inflow' ? 'i-ph-arrow-circle-down' : 'i-ph-arrow-circle-up'"
                  >
                    {{ tx.type === 'inflow' ? 'Приход' : 'Расход' }}
                  </UBadge>
                </td>
                <td class="py-3 text-xs text-slate-500 max-w-[160px] truncate">
                  {{ projectName(tx.projectId) }}
                </td>
                <td class="py-3 text-slate-700 dark:text-slate-300 text-xs">{{ tx.description }}</td>
                <td
                  class="py-3 pr-6 text-right font-mono font-semibold text-sm"
                  :class="tx.type === 'inflow' ? 'text-green-600' : 'text-red-500'"
                >
                  {{ tx.type === 'inflow' ? '+' : '-' }}{{ fmt(tx.amount) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  </div>

  <!-- Add Transaction Modal -->
  <UModal v-model:open="addTxOpen" title="Добавить транзакцию" :ui="{ width: 'max-w-md' }">
    <template #body>
      <div class="space-y-4">
        <!-- Type toggle -->
        <div>
          <p class="text-xs font-medium text-slate-500 mb-1.5">Тип</p>
          <div class="flex gap-2">
            <UButton
              v-for="opt in addTxTypeOptions" :key="opt.value"
              size="sm"
              :color="addTxForm.type === opt.value ? (opt.value === 'inflow' ? 'green' : 'red') : 'neutral'"
              :variant="addTxForm.type === opt.value ? 'solid' : 'outline'"
              @click="addTxForm.type = opt.value as any"
            >
              {{ opt.label }}
            </UButton>
          </div>
        </div>

        <!-- Date -->
        <UFormField label="Дата">
          <UInput v-model="addTxForm.date" type="date" size="sm" class="w-full" />
        </UFormField>

        <!-- Project -->
        <UFormField label="Проект">
          <USelect
            v-model="addTxForm.projectId"
            :items="crm.projects.map(p => ({ label: p.name, value: p.id }))"
            size="sm"
            class="w-full"
          />
        </UFormField>

        <!-- Category -->
        <UFormField label="Категория">
          <USelect
            v-model="addTxForm.category"
            :items="categoryOptions"
            size="sm"
            class="w-full"
          />
        </UFormField>

        <!-- Description -->
        <UFormField label="Описание">
          <UInput
            v-model="addTxForm.description"
            placeholder="Краткое описание..."
            size="sm"
            class="w-full"
          />
        </UFormField>

        <!-- Amount -->
        <UFormField label="Сумма (сум)">
          <UInput
            v-model.number="addTxForm.amount"
            type="number"
            placeholder="0"
            size="sm"
            class="w-full"
          />
        </UFormField>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="addTxOpen = false">Отмена</UButton>
        <UButton
          :color="addTxForm.type === 'inflow' ? 'green' : 'primary'"
          :disabled="!addTxValid"
          @click="submitAddTx"
        >
          Сохранить
        </UButton>
      </div>
    </template>
  </UModal>
</template>
