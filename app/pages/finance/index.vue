<script setup lang="ts">
import { useDebounce } from '@vueuse/core'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend, Filler,
} from 'chart.js'
import { Line } from 'vue-chartjs'
import { fmtMoney } from '~/utils/money'
import dayjs from 'dayjs'
import { fmtDate, lastNMonths, monthLabel } from '~/utils/date'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

definePageMeta({ layout: 'default', middleware: ['auth', 'role'] })

const auth = useAuthStore()
const crm  = useCrmStore()
const colorMode = useColorMode()
const toast = useToast()

const today = dayjs().format('YYYY-MM-DD')

function isOverdue(ms: { status: string; dueDate?: string }) {
  return ms.status !== 'paid' && ms.dueDate && ms.dueDate < today
}

// ── Project selector ───────────────────────────────────────────────────────────
const projectOptions = computed(() =>
  crm.projects.map(p => ({ value: p.id, label: p.name }))
)

const selectedId = computed({
  get: () => crm.selectedProjectId ?? crm.projects[0]?.id ?? '',
  set: (v: string) => { crm.selectedProjectId = v },
})

const project    = computed(() => crm.projects.find(p => p.id === selectedId.value))
const financials = computed(() => crm.projectFinancials(selectedId.value))

// ── Cashflow chart ─────────────────────────────────────────────────────────────
const isDark = computed(() => colorMode.value === 'dark')

const cashflowData = computed(() => {
  const months = lastNMonths(6)
  const labels = months.map(m => monthLabel(m))
  const projectTx = crm.transactionsByProject(selectedId.value)

  const inflows  = months.map(m =>
    projectTx.filter(t => t.type === 'inflow' && t.date?.startsWith(m))
      .reduce((s, t) => s + t.amount, 0)
  )
  const outflows = months.map(m =>
    projectTx.filter(t => t.type === 'outflow' && t.date?.startsWith(m))
      .reduce((s, t) => s + t.amount, 0)
  )

  return {
    labels,
    datasets: [
      {
        label: 'Входящие',
        data: inflows,
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34,197,94,0.08)',
        fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#22c55e',
      },
      {
        label: 'Расходы',
        data: outflows,
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239,68,68,0.06)',
        fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#ef4444',
      },
    ],
  }
})

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index' as const, intersect: false },
  plugins: {
    legend: {
      position: 'top' as const,
      labels: { color: isDark.value ? '#94a3b8' : '#64748b', font: { size: 12 }, boxWidth: 10, padding: 16 },
    },
    tooltip: {
      callbacks: { label: (ctx: any) => ` ${ctx.dataset.label}: ${fmtMoney(ctx.parsed.y)} сум` },
    },
  },
  scales: {
    x: {
      grid: { color: isDark.value ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
      ticks: { color: isDark.value ? '#64748b' : '#94a3b8', font: { size: 11 } },
    },
    y: {
      grid: { color: isDark.value ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
      ticks: { color: isDark.value ? '#64748b' : '#94a3b8', font: { size: 11 }, callback: (v: any) => fmtMoney(v) },
    },
  },
}))

// ── Transaction search & filter ────────────────────────────────────────────────
const txSearch    = ref('')
const debouncedTxSearch = useDebounce(txSearch, 300)
const txTypeFilter = ref<'all' | 'inflow' | 'outflow'>('all')

const TX_TYPE_OPTIONS = [
  { value: 'all',     label: 'Все' },
  { value: 'inflow',  label: 'Входящие' },
  { value: 'outflow', label: 'Расходы' },
]

const filteredTransactions = computed(() => {
  let list = crm.transactionsByProject(selectedId.value)
  const q = debouncedTxSearch.value.toLowerCase()
  if (q) list = list.filter(t => t.description?.toLowerCase().includes(q) || t.staffId?.toLowerCase().includes(q))
  if (txTypeFilter.value !== 'all') {
    list = list.filter(t => t.type === txTypeFilter.value)
  }
  return [...list].sort((a, b) => b.date.localeCompare(a.date))
})

// ── CSV export ─────────────────────────────────────────────────────────────────
function exportCsv() {
  const rows = [
    ['Дата', 'Тип', 'Описание', 'Сумма'],
    ...filteredTransactions.value.map(t => [
      t.date,
      t.type === 'inflow' ? 'Приход' : 'Расход',
      t.description ?? '',
      String(t.amount),
    ]),
  ]
  const csv  = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `transactions_${selectedId.value}_${today}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Staff payouts ──────────────────────────────────────────────────────────────
interface StaffPayoutGroup {
  staffId: string; staffName: string; initials: string
  total: number; pending: number; paid: number
  splits: Array<{ taskId: string; taskName: string; splitId: string; splitLabel: string; amount: number; status: string }>
}

const staffPayoutGroups = computed((): StaffPayoutGroup[] => {
  const map = new Map<string, StaffPayoutGroup>()
  for (const task of project.value?.tasks ?? []) {
    if (task.price === 0 || !task.staffId) continue
    const sid   = task.staffId
    const staff = crm.staffById(sid)
    if (!map.has(sid)) map.set(sid, { staffId: sid, staffName: staff?.name ?? sid, initials: staff?.initials ?? '?', total: 0, pending: 0, paid: 0, splits: [] })
    const g = map.get(sid)!
    const taskName = crm.taskMap[task.taskId]?.name ?? task.taskId
    for (const sp of task.paymentSplits) {
      g.total += sp.amount
      if (sp.status === 'paid') g.paid += sp.amount
      else g.pending += sp.amount
      g.splits.push({ taskId: task.id, taskName, splitId: sp.id, splitLabel: sp.label, amount: sp.amount, status: sp.status })
    }
  }
  return Array.from(map.values())
})

const totalPending = computed(() => staffPayoutGroups.value.reduce((s, g) => s + g.pending, 0))

const expandedStaff = ref<Set<string>>(new Set())
function toggleStaff(id: string) {
  if (expandedStaff.value.has(id)) expandedStaff.value.delete(id)
  else expandedStaff.value.add(id)
  expandedStaff.value = new Set(expandedStaff.value)
}

// ── Confirm modals ─────────────────────────────────────────────────────────────
const confirmMs   = ref<{ id: string; label: string } | null>(null)
const confirmSplit = ref<{ taskId: string; splitId: string; label: string } | null>(null)
const confirmAllStaff = ref<StaffPayoutGroup | null>(null)
const confirmAllPending = ref(false)

async function doPayMilestone() {
  if (!confirmMs.value) return
  await crm.markMilestonePaid(selectedId.value, confirmMs.value.id)
  confirmMs.value = null
}

async function doPaySplit() {
  if (!confirmSplit.value) return
  await crm.markSplitPaid(selectedId.value, confirmSplit.value.taskId, confirmSplit.value.splitId)
  confirmSplit.value = null
}

async function doPayAllForStaff() {
  if (!confirmAllStaff.value) return
  for (const s of confirmAllStaff.value.splits) {
    if (s.status !== 'paid') await crm.markSplitPaid(selectedId.value, s.taskId, s.splitId)
  }
  confirmAllStaff.value = null
}

async function doPayAllPending() {
  for (const group of staffPayoutGroups.value) {
    for (const s of group.splits) {
      if (s.status !== 'paid') await crm.markSplitPaid(selectedId.value, s.taskId, s.splitId)
    }
  }
  confirmAllPending.value = false
}

// ── Change requests ────────────────────────────────────────────────────────────
const financierId = computed(() => auth.currentUser?.id ?? '')
const pendingPriceChanges = computed(() => crm.pendingChangeRequests(financierId.value))
const priceRejectComment = reactive<Record<string, string>>({})
const showPriceRejectForm = reactive<Record<string, boolean>>({})

function acceptPriceChange(requestId: string) { crm.approveChange(requestId, financierId.value) }
function togglePriceReject(requestId: string) { showPriceRejectForm[requestId] = !showPriceRejectForm[requestId] }
function rejectPriceChange(requestId: string) {
  if (!priceRejectComment[requestId]?.trim()) {
    toast.add({ color: 'warning', title: 'Укажите причину отклонения' })
    return
  }
  crm.rejectChange(requestId, financierId.value, priceRejectComment[requestId])
  showPriceRejectForm[requestId] = false
}

function changeLabel(changes: Record<string, { from: unknown; to: unknown }>) {
  return Object.entries(changes).map(([key, val]) => {
    const keyName = key === 'staffId' ? 'исполнитель' : key === 'deadline' ? 'дедлайн' : key === 'price' ? 'цена' : key
    return `${keyName}: ${val.from ?? '—'} → ${val.to ?? '—'}`
  }).join(', ')
}

function approvalStatusLabel(req: typeof pendingPriceChanges.value[0]) {
  const approved = req.approvals.filter(a => a.status === 'approved').length
  return `${approved}/${req.approvals.length} согласований`
}

const SPLIT_STATUS_MAP = {
  pending: { label: 'Ожидает',  color: 'neutral', icon: 'i-ph-clock' },
  partial: { label: 'Частично', color: 'amber',   icon: 'i-ph-timer' },
  paid:    { label: 'Оплачен',  color: 'green',   icon: 'i-ph-check-circle' },
}

const unpricedTasks = computed(() => crm.unpricedTasks)
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">

    <!-- Header -->
    <header class="flex items-center justify-between px-6 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex-shrink-0 gap-4 flex-wrap">
      <div>
        <h1 class="text-lg font-bold text-slate-900 dark:text-white">Финансовый учёт</h1>
        <p class="text-xs text-slate-500">Управление платежами по проектам</p>
      </div>
      <div class="flex items-center gap-3 flex-wrap">
        <!-- Project selector -->
        <USelect
          v-model="selectedId"
          :items="projectOptions"
          value-key="value"
          label-key="label"
          icon="i-ph-buildings"
          size="sm"
          class="w-56"
          placeholder="Выберите проект"
        />
        <UBadge color="success" variant="soft" icon="i-ph-wallet">Финансист</UBadge>
      </div>
    </header>

    <!-- Loading skeleton -->
    <div v-if="crm._loading" class="flex-1 overflow-y-auto p-6 space-y-6">
      <div class="grid grid-cols-4 gap-4">
        <SkeletonRows v-for="i in 4" :key="i" :n="1" class="h-24" />
      </div>
      <SkeletonRows :n="6" />
      <SkeletonRows :n="4" />
    </div>

    <div v-else class="flex-1 overflow-y-auto p-6 space-y-6">

      <!-- Change requests -->
      <div v-if="pendingPriceChanges.length > 0">
        <div class="flex items-center gap-2 mb-3">
          <UIcon name="i-ph-git-pull-request" class="w-5 h-5 text-orange-500" />
          <h2 class="font-semibold text-slate-800 dark:text-slate-200">Запросы на изменение</h2>
          <UBadge color="warning" variant="solid" size="xs">{{ pendingPriceChanges.length }}</UBadge>
        </div>
        <div class="space-y-3">
          <UCard
            v-for="req in pendingPriceChanges"
            :key="req.id"
            :ui="{ body: 'p-4' }"
            class="border-l-4 border-l-orange-400"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1 flex-wrap">
                  <UBadge color="warning" variant="soft" size="xs">
                    {{ req.type === 'price_change' ? 'Изменение цены' : 'Изменение задачи' }}
                  </UBadge>
                  <span class="text-xs text-slate-400">{{ approvalStatusLabel(req) }}</span>
                </div>
                <p class="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-0.5">{{ changeLabel(req.changes) }}</p>
                <p class="text-xs text-slate-500"><span class="font-medium">Причина:</span> {{ req.reason }}</p>
                <p class="text-xs text-slate-400 mt-0.5">{{ req.proposedAt }}</p>
                <div class="flex gap-1.5 mt-2 flex-wrap">
                  <div
                    v-for="appr in req.approvals"
                    :key="appr.staffId"
                    class="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                    :class="appr.status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                            appr.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                            'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'"
                  >
                    <UIcon :name="appr.status === 'approved' ? 'i-ph-check' : appr.status === 'rejected' ? 'i-ph-x' : 'i-ph-clock'" class="w-3 h-3" />
                    {{ crm.staffById(appr.staffId)?.name ?? appr.role }}
                  </div>
                </div>
              </div>
              <div v-if="req.approvals.find(a => a.staffId === financierId && a.status === 'pending')" class="flex flex-col gap-1.5 shrink-0">
                <UButton size="sm" color="success" variant="soft" icon="i-ph-check" @click="acceptPriceChange(req.id)">Согласовать</UButton>
                <UButton size="sm" color="error" variant="ghost" icon="i-ph-x" @click="togglePriceReject(req.id)">Отказать</UButton>
              </div>
            </div>
            <div v-if="showPriceRejectForm[req.id]" class="mt-3 flex gap-2">
              <UInput v-model="priceRejectComment[req.id]" placeholder="Причина отклонения (обязательно)" size="sm" class="flex-1" />
              <UButton size="sm" color="error" @click="rejectPriceChange(req.id)">Подтвердить</UButton>
            </div>
          </UCard>
        </div>
      </div>

      <!-- Unpriced tasks alert -->
      <div
        v-if="unpricedTasks.length > 0"
        class="flex items-center gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60"
      >
        <UIcon name="i-ph-warning-circle" class="w-5 h-5 text-amber-500 shrink-0" />
        <div class="flex-1">
          <p class="font-semibold text-amber-800 dark:text-amber-200 text-sm">{{ unpricedTasks.length }} задач ожидают установки цены</p>
          <p class="text-xs text-amber-600 dark:text-amber-400">Перейдите в «Установить цену», чтобы не забыть</p>
        </div>
        <NuxtLink to="/finance/set-price">
          <UButton size="sm" color="warning" variant="soft" icon="i-ph-tag">Установить цену</UButton>
        </NuxtLink>
      </div>

      <!-- Summary stats -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon="i-ph-file-text" icon-bg="bg-slate-50 dark:bg-slate-800" icon-color="text-slate-600 dark:text-slate-400" :value="fmtMoney(financials.contractAmount)" label="Контракт" />
        <StatCard icon="i-ph-arrow-circle-down" icon-bg="bg-green-50 dark:bg-green-900/20" icon-color="text-green-600" :value="fmtMoney(financials.totalInflow)" label="Получено" />
        <StatCard icon="i-ph-arrow-circle-up" icon-bg="bg-red-50 dark:bg-red-900/20" icon-color="text-red-500" :value="fmtMoney(financials.totalOutflow)" label="Выплачено" />
        <StatCard
          icon="i-ph-scales"
          :icon-bg="financials.balance >= 0 ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-red-50 dark:bg-red-900/20'"
          :icon-color="financials.balance >= 0 ? 'text-blue-600' : 'text-red-600'"
          :value="fmtMoney(financials.balance)"
          label="Баланс"
        />
      </div>

      <!-- Cashflow chart -->
      <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div class="flex items-center gap-2 px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <UIcon name="i-ph-chart-line" class="w-4 h-4 text-green-500" />
          <p class="font-semibold text-slate-800 dark:text-slate-200">Cashflow за 6 месяцев</p>
        </div>
        <div class="p-6 h-52">
          <Line :data="cashflowData" :options="chartOptions" />
        </div>
      </div>

      <!-- Milestones + Staff payouts -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <!-- CLIENT MILESTONES -->
        <UCard>
          <template #header>
            <p class="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <UIcon name="i-ph-arrow-circle-down" class="w-4 h-4 text-green-500" />
              Платежи от заказчика
            </p>
          </template>
          <div class="space-y-3">
            <EmptyState v-if="!project?.clientMilestones?.length" icon="i-ph-check-circle" title="Нет вех оплаты" class="py-6" />
            <div
              v-for="ms in project?.clientMilestones"
              :key="ms.id"
              class="flex items-center justify-between p-3 rounded-lg border"
              :class="ms.status === 'paid'
                ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-900'
                : isOverdue(ms)
                  ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                  : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800'"
            >
              <div>
                <div class="flex items-center gap-2">
                  <p class="text-sm font-medium text-slate-800 dark:text-slate-200">{{ ms.label }}</p>
                  <UBadge v-if="isOverdue(ms)" color="error" variant="soft" size="xs" icon="i-ph-warning">Просрочен</UBadge>
                </div>
                <p class="text-xs text-slate-400 mt-0.5">
                  {{ fmtMoney(ms.amount) }} сум
                  <template v-if="ms.dueDate"> · срок <span :class="isOverdue(ms) ? 'text-red-500 font-medium' : ''">{{ fmtDate(ms.dueDate) }}</span></template>
                  <template v-if="ms.paidAt"> · получен {{ fmtDate(ms.paidAt) }}</template>
                </p>
              </div>
              <div class="flex items-center gap-2">
                <UBadge :color="SPLIT_STATUS_MAP[ms.status].color as any" :icon="SPLIT_STATUS_MAP[ms.status].icon" variant="soft" size="xs">
                  {{ SPLIT_STATUS_MAP[ms.status].label }}
                </UBadge>
                <UButton v-if="ms.status !== 'paid'" size="sm" color="success" variant="soft" icon="i-ph-check" @click="confirmMs = { id: ms.id, label: ms.label }">
                  Оплачен
                </UButton>
              </div>
            </div>
          </div>
        </UCard>

        <!-- STAFF PAYOUTS -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <p class="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <UIcon name="i-ph-arrow-circle-up" class="w-4 h-4 text-red-400" />
                Выплаты сотрудникам
              </p>
              <div class="flex items-center gap-2">
                <span v-if="totalPending > 0" class="text-xs text-red-500 font-medium">К выплате: {{ fmtMoney(totalPending) }} сум</span>
                <UButton v-if="totalPending > 0" size="xs" color="error" variant="soft" icon="i-ph-paper-plane-right" @click="confirmAllPending = true">
                  Выплатить всем
                </UButton>
              </div>
            </div>
          </template>

          <div class="space-y-2 max-h-96 overflow-y-auto">
            <EmptyState v-if="staffPayoutGroups.length === 0" icon="i-ph-users" title="Нет назначений с ценами" class="py-6" />
            <div v-for="group in staffPayoutGroups" :key="group.staffId" class="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
              <button
                class="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                @click="toggleStaff(group.staffId)"
              >
                <div class="flex items-center gap-2">
                  <UAvatar :text="group.initials" size="xs" />
                  <div class="text-left">
                    <p class="text-sm font-medium text-slate-700 dark:text-slate-300">{{ group.staffName }}</p>
                    <p class="text-xs text-slate-400">Итого: {{ fmtMoney(group.total) }} · Оплачено: {{ fmtMoney(group.paid) }}</p>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <span v-if="group.pending > 0" class="text-xs font-medium text-red-500">{{ fmtMoney(group.pending) }}</span>
                  <UButton v-if="group.pending > 0" size="xs" color="error" variant="ghost" icon="i-ph-paper-plane-right" @click.stop="confirmAllStaff = group">Выплатить</UButton>
                  <UIcon :name="expandedStaff.has(group.staffId) ? 'i-ph-caret-up' : 'i-ph-caret-down'" class="w-4 h-4 text-slate-400" />
                </div>
              </button>
              <div v-if="expandedStaff.has(group.staffId)" class="border-t border-slate-100 dark:border-slate-700 divide-y divide-slate-50 dark:divide-slate-800">
                <div
                  v-for="s in group.splits"
                  :key="`${s.taskId}-${s.splitId}`"
                  class="flex items-center justify-between px-3 py-2"
                  :class="s.status === 'paid' ? 'opacity-50' : ''"
                >
                  <p class="text-xs text-slate-600 dark:text-slate-400">{{ s.taskName }} · <span class="font-medium">{{ s.splitLabel }}</span></p>
                  <div class="flex items-center gap-2">
                    <p class="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">{{ fmtMoney(s.amount) }}</p>
                    <UBadge :color="SPLIT_STATUS_MAP[s.status as keyof typeof SPLIT_STATUS_MAP].color as any" variant="soft" size="xs">
                      {{ SPLIT_STATUS_MAP[s.status as keyof typeof SPLIT_STATUS_MAP].label }}
                    </UBadge>
                    <UButton
                      v-if="s.status !== 'paid'"
                      size="sm" color="error" variant="ghost" icon="i-ph-check"
                      @click="confirmSplit = { taskId: s.taskId, splitId: s.splitId, label: `${s.taskName} · ${s.splitLabel}` }"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Transaction log -->
      <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 gap-3 flex-wrap">
          <p class="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 shrink-0">
            <UIcon name="i-ph-receipt" class="w-4 h-4" />
            Журнал транзакций
            <span class="text-xs font-normal text-slate-400">({{ filteredTransactions.length }})</span>
          </p>
          <div class="flex items-center gap-2">
            <UInput v-model="txSearch" icon="i-ph-magnifying-glass" placeholder="Поиск..." size="sm" class="w-44" />
            <USelect v-model="txTypeFilter" :items="TX_TYPE_OPTIONS" value-key="value" label-key="label" size="sm" class="w-32" />
            <UButton icon="i-ph-download-simple" size="sm" variant="ghost" color="neutral" @click="exportCsv">CSV</UButton>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-xs text-slate-500 border-b border-slate-100 dark:border-slate-800">
                <th class="text-left py-3 pl-6 font-medium">Дата</th>
                <th class="text-left py-3 font-medium">Тип</th>
                <th class="text-left py-3 font-medium">Описание</th>
                <th class="text-right py-3 pr-6 font-medium">Сумма (сум)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="filteredTransactions.length === 0">
                <td colspan="4" class="py-8 text-center text-slate-400 text-xs">Нет транзакций</td>
              </tr>
              <tr
                v-for="tx in filteredTransactions"
                :key="tx.id"
                class="border-b border-slate-50 dark:border-slate-800/50"
              >
                <td class="py-2.5 pl-6 text-xs text-slate-500">{{ fmtDate(tx.date) }}</td>
                <td class="py-2.5">
                  <UBadge
                    :color="tx.type === 'inflow' ? 'success' : 'error'"
                    variant="soft" size="xs"
                    :icon="tx.type === 'inflow' ? 'i-ph-arrow-circle-down' : 'i-ph-arrow-circle-up'"
                  >
                    {{ tx.type === 'inflow' ? 'Приход' : 'Расход' }}
                  </UBadge>
                </td>
                <td class="py-2.5 text-slate-700 dark:text-slate-300 text-xs">{{ tx.description }}</td>
                <td
                  class="py-2.5 pr-6 text-right font-mono font-semibold text-xs"
                  :class="tx.type === 'inflow' ? 'text-green-600' : 'text-red-500'"
                >
                  {{ tx.type === 'inflow' ? '+' : '-' }}{{ fmtMoney(tx.amount) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  </div>

  <!-- Confirm modals -->
  <ConfirmModal
    :open="!!confirmMs"
    title="Отметить платёж как полученный?"
    :description="confirmMs?.label"
    confirm-label="Подтвердить"
    confirm-color="green"
    @update:open="$event || (confirmMs = null)"
    @confirm="doPayMilestone"
  />
  <ConfirmModal
    :open="!!confirmSplit"
    title="Выплатить сотруднику?"
    :description="confirmSplit?.label"
    confirm-label="Выплатить"
    confirm-color="primary"
    @update:open="$event || (confirmSplit = null)"
    @confirm="doPaySplit"
  />
  <ConfirmModal
    :open="!!confirmAllStaff"
    title="Выплатить все ожидающие суммы сотруднику?"
    :description="confirmAllStaff?.staffName"
    confirm-label="Выплатить всё"
    confirm-color="primary"
    @update:open="$event || (confirmAllStaff = null)"
    @confirm="doPayAllForStaff"
  />
  <ConfirmModal
    :open="confirmAllPending"
    title="Выплатить всем сотрудникам?"
    :description="`Общая сумма: ${fmtMoney(totalPending)} сум`"
    confirm-label="Выплатить всем"
    confirm-color="error"
    @update:open="confirmAllPending = $event"
    @confirm="doPayAllPending"
  />
</template>
