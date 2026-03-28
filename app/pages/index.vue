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

definePageMeta({ layout: 'default', middleware: ['auth'] })

const auth = useAuthStore()
const crm  = useCrmStore()
const router = useRouter()
const colorMode = useColorMode()

if (auth.currentRole && auth.currentRole !== 'ceo') {
  navigateTo(auth.roleHome)
}

const health = computed(() => crm.companyHealth)

// ── Stats ───────────────────────────────────────────────────────────────────
const totalContracts = computed(() => crm.projects.reduce((s, p) => s + p.contractAmount, 0))

const stats = computed(() => [
  {
    label: 'Общая выручка', value: fmtMoney(health.value.totalRevenue),
    icon: 'i-ph-trend-up', color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-50 dark:bg-green-900/20',
    delta: health.value.totalRevenue > 0 ? '+' : undefined,
  },
  {
    label: 'Расходы', value: fmtMoney(health.value.totalExpenses),
    icon: 'i-ph-trend-down', color: 'text-red-500 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-900/20',
  },
  {
    label: 'Прибыль', value: fmtMoney(health.value.totalProfit),
    icon: 'i-ph-currency-circle-dollar', color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
  },
  {
    label: 'Активных проектов', value: String(health.value.activeProjects),
    icon: 'i-ph-folder-open', color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-50 dark:bg-purple-900/20',
  },
  {
    label: 'Общий портфель', value: fmtMoney(totalContracts.value),
    icon: 'i-ph-briefcase', color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
  },
])

// ── Cashflow chart ──────────────────────────────────────────────────────────
const isDark = computed(() => colorMode.value === 'dark')

const cashflowData = computed(() => {
  const months = lastNMonths(6)
  const labels = months.map(m => monthLabel(m))

  const inflows  = months.map(m => {
    return crm.transactions
      .filter(t => t.type === 'inflow' && t.date?.startsWith(m))
      .reduce((s, t) => s + t.amount, 0)
  })
  const outflows = months.map(m => {
    return crm.transactions
      .filter(t => t.type === 'outflow' && t.date?.startsWith(m))
      .reduce((s, t) => s + t.amount, 0)
  })

  return {
    labels,
    datasets: [
      {
        label: 'Входящие',
        data: inflows,
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34,197,94,0.08)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#22c55e',
      },
      {
        label: 'Расходы',
        data: outflows,
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239,68,68,0.06)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#ef4444',
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
      callbacks: {
        label: (ctx: any) => ` ${ctx.dataset.label}: ${fmtMoney(ctx.parsed.y)} сум`,
      },
    },
  },
  scales: {
    x: {
      grid: { color: isDark.value ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
      ticks: { color: isDark.value ? '#64748b' : '#94a3b8', font: { size: 11 } },
    },
    y: {
      grid: { color: isDark.value ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
      ticks: {
        color: isDark.value ? '#64748b' : '#94a3b8',
        font: { size: 11 },
        callback: (v: any) => fmtMoney(v),
      },
    },
  },
}))

// ── Table sort ──────────────────────────────────────────────────────────────
type SortKey = 'name' | 'amount' | 'inflow' | 'balance' | 'progress' | 'status'
const sortKey = ref<SortKey>('amount')
const sortDir = ref<1 | -1>(-1)

function toggleSort(key: SortKey) {
  if (sortKey.value === key) sortDir.value = sortDir.value === 1 ? -1 : 1
  else { sortKey.value = key; sortDir.value = -1 }
}

function projectProgress(p: typeof crm.projects[0]) {
  if (!p.tasks.length) return 0
  return Math.round(p.tasks.filter(t => t.status === 'done').length / p.tasks.length * 100)
}

// ── Search + Pagination ─────────────────────────────────────────────────────
const tableSearch = ref('')
const debouncedSearch = useDebounce(tableSearch, 300)
const page = ref(1)
const PAGE_SIZE = 10

watch(debouncedSearch, () => { page.value = 1 })

const allProjectRows = computed(() => {
  const q = debouncedSearch.value.toLowerCase()
  const rows = crm.projects
    .filter(p => !q || p.name.toLowerCase().includes(q) || p.client.toLowerCase().includes(q))
    .map(p => ({ ...p, fin: crm.projectFinancials(p.id), progress: projectProgress(p) }))

  return rows.sort((a, b) => {
    let va: number | string = 0, vb: number | string = 0
    if (sortKey.value === 'name')     { va = a.name;           vb = b.name }
    if (sortKey.value === 'amount')   { va = a.contractAmount; vb = b.contractAmount }
    if (sortKey.value === 'inflow')   { va = a.fin.totalInflow; vb = b.fin.totalInflow }
    if (sortKey.value === 'balance')  { va = a.fin.balance;    vb = b.fin.balance }
    if (sortKey.value === 'progress') { va = a.progress;       vb = b.progress }
    if (sortKey.value === 'status')   { va = a.status;         vb = b.status }
    if (va < vb) return -1 * sortDir.value
    if (va > vb) return  1 * sortDir.value
    return 0
  })
})

const totalPages = computed(() => Math.ceil(allProjectRows.value.length / PAGE_SIZE))

const projectRows = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE
  return allProjectRows.value.slice(start, start + PAGE_SIZE)
})

// ── Staff ───────────────────────────────────────────────────────────────────
const staffRows = computed(() =>
  crm.staff
    .filter(s => s.role === 'staff' || s.role === 'pm')
    .map(s => {
      const e = crm.staffEarnings(s.id)
      return { ...s, total: e.reduce((a, x) => a + x.price, 0), earned: e.reduce((a, x) => a + x.earned, 0), tasks: e.length }
    })
    .sort((a, b) => b.total - a.total)
)

const TYPE_LABELS: Record<string, string> = {
  residential: 'Жилой', commercial: 'Коммерческий',
  educational: 'Образование', infrastructure: 'Инфраструктура',
}

// ── Overdue milestones ──────────────────────────────────────────────────────
const today = dayjs().format('YYYY-MM-DD')
const showAllOverdue = ref(false)

const overdueMilestones = computed(() => {
  const result: { projectName: string; label: string; dueDate: string; amount: number; projectId: string }[] = []
  for (const p of crm.projects) {
    for (const ms of p.clientMilestones) {
      if (ms.status !== 'paid' && ms.dueDate && ms.dueDate < today) {
        result.push({ projectName: p.name, label: ms.label, dueDate: ms.dueDate, amount: ms.amount, projectId: p.id })
      }
    }
  }
  return result
})

const visibleOverdue = computed(() => showAllOverdue.value ? overdueMilestones.value : overdueMilestones.value.slice(0, 3))
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <header class="h-16 flex items-center justify-between px-8 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 flex-shrink-0">
      <div>
        <h1 class="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Дашборд</h1>
        <p class="text-xs text-slate-400 mt-0.5">Общее состояние компании</p>
      </div>
      <UBadge color="warning" variant="soft" icon="i-ph-crown" size="sm">Директор</UBadge>
    </header>

    <!-- Loading skeleton -->
    <div v-if="crm._loading" class="flex-1 overflow-y-auto p-8 space-y-6">
      <SkeletonRows :n="2" class="h-20" />
      <div class="grid grid-cols-5 gap-4">
        <SkeletonRows v-for="i in 5" :key="i" :n="1" class="h-24" />
      </div>
      <SkeletonRows :n="8" />
      <SkeletonRows :n="5" />
    </div>

    <div v-else class="flex-1 overflow-y-auto p-8 space-y-6">

      <!-- Overdue alert -->
      <div
        v-if="overdueMilestones.length > 0"
        class="flex items-start gap-3 p-4 rounded-2xl bg-gradient-to-r from-red-50 to-red-100/50 dark:from-red-950/30 dark:to-red-900/10 border border-red-200/60 dark:border-red-800/40"
      >
        <div class="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
          <UIcon name="i-ph-warning" class="w-5 h-5 text-red-600 dark:text-red-400" />
        </div>
        <div class="flex-1">
          <p class="text-sm font-semibold text-red-800 dark:text-red-300">
            {{ overdueMilestones.length }} просроченных платежей от заказчиков
          </p>
          <ul class="mt-1.5 space-y-0.5">
            <li
              v-for="ms in visibleOverdue"
              :key="`${ms.projectId}-${ms.label}`"
              class="text-xs text-red-600/80 dark:text-red-400/70 cursor-pointer hover:underline"
              @click="router.push('/finance')"
            >
              <span class="font-medium">{{ ms.projectName }}</span> — {{ ms.label }}
              ({{ fmtMoney(ms.amount) }} сум, срок {{ fmtDate(ms.dueDate) }})
            </li>
          </ul>
          <button
            v-if="overdueMilestones.length > 3"
            class="mt-2 text-xs text-red-600 dark:text-red-400 font-medium hover:underline"
            @click="showAllOverdue = !showAllOverdue"
          >
            {{ showAllOverdue ? 'Скрыть' : `Показать все ${overdueMilestones.length}` }}
          </button>
        </div>
      </div>

      <!-- Stat cards -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          v-for="s in stats"
          :key="s.label"
          :icon="s.icon"
          :icon-color="s.color"
          :icon-bg="s.bg"
          :value="s.value"
          :label="s.label"
        />
      </div>

      <!-- Cashflow chart -->
      <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <p class="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <UIcon name="i-ph-chart-line" class="w-4 h-4 text-green-500" />
            Cashflow за 6 месяцев
          </p>
        </div>
        <div class="p-6 h-56">
          <Line :data="cashflowData" :options="chartOptions" />
        </div>
      </div>

      <!-- Projects table -->
      <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 gap-4">
          <p class="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 shrink-0">
            <UIcon name="i-ph-kanban" class="w-4 h-4 text-blue-500" />
            Портфель проектов
            <span class="text-xs font-normal text-slate-400 ml-1">({{ allProjectRows.length }})</span>
          </p>
          <UInput
            v-model="tableSearch"
            icon="i-ph-magnifying-glass"
            placeholder="Поиск по проектам..."
            size="sm"
            class="w-64"
          />
        </div>

        <!-- Empty state -->
        <EmptyState
          v-if="allProjectRows.length === 0"
          icon="i-ph-folder-open"
          title="Нет проектов"
          :description="tableSearch ? 'Попробуйте другой запрос' : 'Создайте первый проект в разделе PM'"
          class="py-12"
        />

        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-[11px] text-slate-400 border-b border-slate-100 dark:border-slate-800 uppercase tracking-wider">
                <th
                  class="text-left py-3 pl-6 font-medium cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 select-none transition-colors"
                  @click="toggleSort('name')"
                >
                  Проект
                  <UIcon
                    :name="sortKey === 'name' ? (sortDir === 1 ? 'i-ph-caret-up' : 'i-ph-caret-down') : 'i-ph-caret-up-down'"
                    class="w-3 h-3 inline ml-1 opacity-50"
                  />
                </th>
                <th class="text-left py-3 font-medium">Тип</th>
                <th
                  class="text-right py-3 font-medium cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 select-none transition-colors"
                  @click="toggleSort('amount')"
                >
                  Контракт
                  <UIcon
                    :name="sortKey === 'amount' ? (sortDir === 1 ? 'i-ph-caret-up' : 'i-ph-caret-down') : 'i-ph-caret-up-down'"
                    class="w-3 h-3 inline ml-1 opacity-50"
                  />
                </th>
                <th
                  class="text-right py-3 font-medium cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 select-none transition-colors"
                  @click="toggleSort('inflow')"
                >
                  Получено
                  <UIcon
                    :name="sortKey === 'inflow' ? (sortDir === 1 ? 'i-ph-caret-up' : 'i-ph-caret-down') : 'i-ph-caret-up-down'"
                    class="w-3 h-3 inline ml-1 opacity-50"
                  />
                </th>
                <th class="text-right py-3 font-medium">Расходы</th>
                <th
                  class="text-right py-3 font-medium cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 select-none transition-colors"
                  @click="toggleSort('balance')"
                >
                  Баланс
                  <UIcon
                    :name="sortKey === 'balance' ? (sortDir === 1 ? 'i-ph-caret-up' : 'i-ph-caret-down') : 'i-ph-caret-up-down'"
                    class="w-3 h-3 inline ml-1 opacity-50"
                  />
                </th>
                <th
                  class="text-center py-3 font-medium w-32 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 select-none transition-colors"
                  @click="toggleSort('progress')"
                >
                  Прогресс
                  <UIcon
                    :name="sortKey === 'progress' ? (sortDir === 1 ? 'i-ph-caret-up' : 'i-ph-caret-down') : 'i-ph-caret-up-down'"
                    class="w-3 h-3 inline ml-1 opacity-50"
                  />
                </th>
                <th
                  class="text-center py-3 pr-6 font-medium cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 select-none transition-colors"
                  @click="toggleSort('status')"
                >
                  Статус
                  <UIcon
                    :name="sortKey === 'status' ? (sortDir === 1 ? 'i-ph-caret-up' : 'i-ph-caret-down') : 'i-ph-caret-up-down'"
                    class="w-3 h-3 inline ml-1 opacity-50"
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="p in projectRows"
                :key="p.id"
                class="border-b border-slate-50 dark:border-slate-800/50 hover:bg-blue-50/60 dark:hover:bg-blue-900/10 cursor-pointer transition-colors"
                @click="router.push('/pm/projects?id=' + p.id)"
              >
                <td class="py-3.5 pl-6">
                  <p class="font-semibold text-slate-800 dark:text-slate-200">{{ p.name }}</p>
                  <p class="text-xs text-slate-400 mt-0.5">{{ p.client }}</p>
                </td>
                <td class="py-3.5 text-slate-500 dark:text-slate-400 text-xs">{{ TYPE_LABELS[p.type] ?? p.type }}</td>
                <td class="py-3.5 text-right font-mono text-xs text-slate-600 dark:text-slate-400">{{ fmtMoney(p.contractAmount) }}</td>
                <td class="py-3.5 text-right font-mono text-sm font-semibold text-green-600">{{ fmtMoney(p.fin.totalInflow) }}</td>
                <td class="py-3.5 text-right font-mono text-xs text-red-500">{{ fmtMoney(p.fin.totalOutflow) }}</td>
                <td class="py-3.5 text-right font-mono text-sm font-bold" :class="p.fin.balance >= 0 ? 'text-blue-600' : 'text-red-600'">
                  {{ fmtMoney(p.fin.balance) }}
                </td>
                <td class="py-3.5 px-3 w-32">
                  <div class="flex items-center gap-2">
                    <div class="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        class="h-full rounded-full transition-all duration-700"
                        :class="p.progress === 100 ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gradient-to-r from-blue-500 to-indigo-500'"
                        :style="{ width: p.progress + '%' }"
                      />
                    </div>
                    <span class="text-xs text-slate-400 w-7 text-right">{{ p.progress }}%</span>
                  </div>
                </td>
                <td class="py-3.5 pr-6 text-center">
                  <UBadge
                    :color="p.status === 'active' ? 'success' : p.status === 'completed' ? 'info' : 'warning'"
                    variant="soft" size="sm"
                  >
                    {{ p.status === 'active' ? 'Активен' : p.status === 'completed' ? 'Завершён' : 'Пауза' }}
                  </UBadge>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Pagination -->
          <div v-if="totalPages > 1" class="flex items-center justify-between px-6 py-3 border-t border-slate-100 dark:border-slate-800">
            <p class="text-xs text-slate-400">
              {{ (page - 1) * PAGE_SIZE + 1 }}–{{ Math.min(page * PAGE_SIZE, allProjectRows.length) }} из {{ allProjectRows.length }}
            </p>
            <UPagination v-model:page="page" :total="allProjectRows.length" :items-per-page="PAGE_SIZE" size="xs" />
          </div>
        </div>
      </div>

      <!-- Staff utilization -->
      <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <p class="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <UIcon name="i-ph-users" class="w-4 h-4 text-purple-500" />
            Загрузка сотрудников
          </p>
        </div>
        <div class="p-6">
          <EmptyState
            v-if="staffRows.length === 0"
            icon="i-ph-users"
            title="Нет сотрудников"
            class="py-8"
          />
          <div v-else class="space-y-4">
            <div
              v-for="s in staffRows"
              :key="s.id"
              class="flex items-center gap-4 group cursor-pointer rounded-xl p-2 -mx-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              @click="router.push('/pm/projects?pmId=' + s.id)"
            >
              <UAvatar :text="s.initials" size="sm" />
              <div class="flex-1">
                <div class="flex items-center justify-between mb-1.5">
                  <div>
                    <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">{{ s.name }}</p>
                    <p class="text-[11px] text-slate-400">{{ s.position }}</p>
                  </div>
                  <p class="text-xs text-slate-500">
                    <span class="text-slate-400">{{ s.tasks }} задач</span>
                    <span class="mx-1.5 text-slate-300">·</span>
                    <span class="text-emerald-600 font-semibold">{{ fmtMoney(s.earned) }}</span>
                    <span class="text-slate-300"> / </span>
                    <span>{{ fmtMoney(s.total) }}</span>
                    <span class="text-slate-400"> сум</span>
                  </p>
                </div>
                <div class="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all duration-700"
                    :class="
                      s.total > 0 && (s.earned / s.total) >= 0.8 ? 'bg-gradient-to-r from-green-400 to-emerald-500' :
                      s.total > 0 && (s.earned / s.total) >= 0.5 ? 'bg-gradient-to-r from-yellow-400 to-amber-500' :
                      'bg-gradient-to-r from-blue-500 to-indigo-500'
                    "
                    :style="{ width: (s.total > 0 ? Math.round((s.earned / s.total) * 100) : 0) + '%' }"
                  />
                </div>
              </div>
              <UIcon name="i-ph-arrow-right" class="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
