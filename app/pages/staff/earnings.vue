<script setup lang="ts">
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { Doughnut } from 'vue-chartjs'
import { STAGE_SHORT_LABELS, STAGE_ICONS, ROLE_LABELS, ROLE_ICONS } from '~/constants/taskCatalog'
import { fmtMoney } from '~/utils/money'
import { fmtDate, fromNow } from '~/utils/date'

ChartJS.register(ArcElement, Tooltip, Legend)

definePageMeta({ layout: 'default', middleware: ['auth', 'role'] })

const auth = useAuthStore()
const crm  = useCrmStore()
const colorMode = useColorMode()

const staffId = computed(() => auth.currentUser?.id ?? '')

// ── Earnings data ──────────────────────────────────────────────────────────────
const earnings = computed(() => crm.staffEarnings(staffId.value))

const totalEarned  = computed(() => earnings.value.reduce((s, e) => s + e.earned, 0))
const totalPending = computed(() => earnings.value.reduce((s, e) => s + e.pending, 0))
const totalAll     = computed(() => earnings.value.reduce((s, e) => s + (e.price || 0), 0))
const totalUnearned = computed(() => Math.max(0, totalAll.value - totalEarned.value - totalPending.value))
const allPaid      = computed(() => totalAll.value > 0 && totalEarned.value === totalAll.value)
const paidPercent  = computed(() => totalAll.value > 0 ? Math.round((totalEarned.value / totalAll.value) * 100) : 0)

// ── Color-coded progress bar ───────────────────────────────────────────────────
const progressColor = computed(() => {
  if (paidPercent.value >= 80) return 'bg-gradient-to-r from-green-400 to-emerald-500'
  if (paidPercent.value >= 40) return 'bg-gradient-to-r from-yellow-400 to-amber-500'
  return 'bg-gradient-to-r from-red-400 to-rose-500'
})

const progressTextColor = computed(() => {
  if (paidPercent.value >= 80) return 'text-green-600 dark:text-green-400'
  if (paidPercent.value >= 40) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
})

// ── Doughnut chart ─────────────────────────────────────────────────────────────
const isDark = computed(() => colorMode.value === 'dark')

const doughnutData = computed(() => ({
  labels: ['Получено', 'Ожидается', 'Не оплачено'],
  datasets: [{
    data: [totalEarned.value, totalPending.value, totalUnearned.value],
    backgroundColor: ['#22c55e', '#f59e0b', isDark.value ? '#334155' : '#e2e8f0'],
    borderColor:     ['#16a34a', '#d97706', isDark.value ? '#475569' : '#cbd5e1'],
    borderWidth: 2,
    hoverOffset: 4,
  }],
}))

const doughnutOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  cutout: '70%',
  plugins: {
    legend: {
      position: 'bottom' as const,
      labels: { color: isDark.value ? '#94a3b8' : '#64748b', font: { size: 11 }, padding: 12, boxWidth: 10 },
    },
    tooltip: {
      callbacks: { label: (ctx: any) => ` ${ctx.label}: ${fmtMoney(ctx.raw)} сум` },
    },
  },
}))

// ── Group by project ───────────────────────────────────────────────────────────
const earningsByProject = computed(() => {
  const map = new Map<string, {
    projectId: string; projectName: string
    total: number; earned: number; pending: number
    services: typeof earnings.value
  }>()
  for (const entry of earnings.value) {
    if (!map.has(entry.projectId)) {
      map.set(entry.projectId, { projectId: entry.projectId, projectName: entry.projectName, total: 0, earned: 0, pending: 0, services: [] })
    }
    const g = map.get(entry.projectId)!
    g.total   += entry.price || 0
    g.earned  += entry.earned
    g.pending += entry.pending
    g.services.push(entry)
  }
  return Array.from(map.values())
})

const earningsWithoutPrice = computed(() => earnings.value.filter(e => !e.price))

// ── Transactions ───────────────────────────────────────────────────────────────
const myTransactions = computed(() => crm.staffTransactions(staffId.value))
const txExpanded = ref(false)
const expandedProjects = reactive<Record<string, boolean>>({})

function toggleProject(projectId: string) {
  expandedProjects[projectId] = !expandedProjects[projectId]
}

const SPLIT_STATUS: Record<string, { icon: string; color: string; bg: string }> = {
  pending: { icon: 'i-ph-clock',        color: 'text-slate-400',  bg: 'bg-slate-50 dark:bg-slate-800' },
  partial: { icon: 'i-ph-timer',        color: 'text-amber-500',  bg: 'bg-amber-50 dark:bg-amber-950/30' },
  paid:    { icon: 'i-ph-check-circle', color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-950/30' },
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <!-- Header -->
    <header class="h-16 flex items-center justify-between px-8 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 flex-shrink-0">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/25">
          <UIcon name="i-ph-coins" class="text-white w-5 h-5" />
        </div>
        <div>
          <h1 class="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Мои заработки</h1>
          <p class="text-xs text-slate-400">{{ auth.currentUser?.name }} · {{ auth.currentUser?.specialization }}</p>
        </div>
      </div>
      <UBadge color="secondary" variant="soft" icon="i-ph-pencil-ruler" size="sm">Сотрудник</UBadge>
    </header>

    <div class="flex-1 overflow-y-auto p-8 bg-slate-50/50 dark:bg-slate-950/50">
      <div class="max-w-4xl mx-auto space-y-6">

        <!-- Summary + Doughnut -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">

          <!-- Stats -->
          <div class="space-y-3">
            <div class="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/20 border border-emerald-100 dark:border-emerald-900/40">
              <div>
                <p class="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1">Получено</p>
                <p class="text-xl font-bold text-emerald-700 dark:text-emerald-300">{{ fmtMoney(totalEarned) }}</p>
                <p class="text-xs text-emerald-500 mt-0.5">сум</p>
              </div>
              <div class="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/50 rounded-xl flex items-center justify-center">
                <UIcon name="i-ph-check-circle" class="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>

            <div class="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-100 dark:border-amber-900/40">
              <div>
                <p class="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1">Ожидается</p>
                <p class="text-xl font-bold text-amber-700 dark:text-amber-300">{{ fmtMoney(totalPending) }}</p>
                <p class="text-xs text-amber-500 mt-0.5">сум</p>
              </div>
              <div class="w-10 h-10 bg-amber-100 dark:bg-amber-900/50 rounded-xl flex items-center justify-center">
                <UIcon name="i-ph-clock" class="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>

            <div class="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <div>
                <p class="text-xs font-medium text-slate-500 mb-1">Итого</p>
                <p class="text-xl font-bold text-slate-800 dark:text-slate-200">{{ fmtMoney(totalAll) }}</p>
                <p class="text-xs text-slate-400 mt-0.5">сум</p>
              </div>
              <div class="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center">
                <UIcon name="i-ph-wallet" class="w-5 h-5 text-slate-500" />
              </div>
            </div>
          </div>

          <!-- Doughnut chart -->
          <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 flex flex-col">
            <p class="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Распределение выплат</p>
            <div class="flex-1 relative min-h-[160px]">
              <Doughnut :data="doughnutData" :options="doughnutOptions" />
              <!-- Center label -->
              <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p class="text-2xl font-bold" :class="progressTextColor">{{ paidPercent }}%</p>
                <p class="text-xs text-slate-400">оплачено</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Color-coded progress bar -->
        <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium text-slate-700 dark:text-slate-300">Прогресс выплат</span>
            <span class="text-sm font-bold" :class="progressTextColor">{{ paidPercent }}%</span>
          </div>
          <div class="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-700"
              :class="progressColor"
              :style="{ width: paidPercent + '%' }"
            />
          </div>
          <div v-if="allPaid" class="mt-3 flex items-center gap-2 text-green-600 dark:text-green-400">
            <UIcon name="i-ph-confetti" class="w-4 h-4" />
            <span class="text-xs font-semibold">Все выплаты получены!</span>
          </div>
        </div>

        <!-- Per-project breakdown -->
        <div>
          <h2 class="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
            <UIcon name="i-ph-buildings" class="w-4 h-4 text-slate-400" />
            Разбивка по объектам
          </h2>

          <EmptyState
            v-if="earningsByProject.length === 0"
            icon="i-ph-coins"
            title="Нет данных о заработках"
            description="Задачи с ценами появятся здесь"
            class="py-12"
          />

          <div class="space-y-3">
            <div
              v-for="group in earningsByProject"
              :key="group.projectId"
              class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden"
            >
              <button
                class="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                @click="toggleProject(group.projectId)"
              >
                <div class="w-9 h-9 bg-blue-100 dark:bg-blue-950/50 rounded-xl flex items-center justify-center shrink-0">
                  <UIcon name="i-ph-buildings" class="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="font-semibold text-sm text-slate-800 dark:text-slate-200">{{ group.projectName }}</p>
                  <p class="text-xs text-slate-400 mt-0.5">{{ group.services.length }} услуг</p>
                </div>
                <div class="text-right shrink-0 mr-3">
                  <p class="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {{ fmtMoney(group.earned) }}
                    <span class="text-xs font-normal text-slate-400">/ {{ fmtMoney(group.total) }}</span>
                  </p>
                  <p class="text-xs text-slate-400">сум</p>
                </div>
                <div class="w-16 shrink-0">
                  <div class="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      class="h-full rounded-full transition-all"
                      :class="group.total > 0 && group.earned / group.total >= 0.8 ? 'bg-emerald-400' : group.total > 0 && group.earned / group.total >= 0.4 ? 'bg-amber-400' : 'bg-blue-400'"
                      :style="{ width: group.total > 0 ? `${Math.round(group.earned / group.total * 100)}%` : '0%' }"
                    />
                  </div>
                  <p class="text-xs text-slate-400 mt-0.5 text-right">
                    {{ group.total > 0 ? Math.round(group.earned / group.total * 100) : 0 }}%
                  </p>
                </div>
                <UIcon :name="expandedProjects[group.projectId] ? 'i-ph-caret-up' : 'i-ph-caret-down'" class="w-4 h-4 text-slate-400 shrink-0" />
              </button>

              <div v-if="expandedProjects[group.projectId]" class="border-t border-slate-100 dark:border-slate-800">
                <div
                  v-for="service in group.services"
                  :key="service.taskId"
                  class="px-5 py-4 border-b border-slate-50 dark:border-slate-800/50 last:border-b-0"
                >
                  <div class="flex items-start justify-between gap-3 mb-3">
                    <div class="flex-1 min-w-0">
                      <p class="font-medium text-sm text-slate-800 dark:text-slate-200">{{ service.taskName }}</p>
                      <div class="flex items-center gap-3 mt-1">
                        <div class="flex items-center gap-1 text-xs text-slate-400">
                          <UIcon :name="STAGE_ICONS[service.stage]" class="w-3 h-3" />
                          {{ STAGE_SHORT_LABELS[service.stage] }}
                        </div>
                        <div class="flex items-center gap-1 text-xs text-slate-400">
                          <UIcon :name="ROLE_ICONS[service.role]" class="w-3 h-3" />
                          {{ ROLE_LABELS[service.role] }}
                        </div>
                      </div>
                    </div>
                    <div class="text-right shrink-0">
                      <p class="text-sm font-bold text-slate-800 dark:text-slate-200">{{ fmtMoney(service.price) }} сум</p>
                      <p class="text-xs mt-0.5">
                        <span class="text-green-600 dark:text-green-400">+{{ fmtMoney(service.earned) }}</span>
                        <span v-if="service.pending > 0" class="text-amber-500 ml-1">/ {{ fmtMoney(service.pending) }} ожид.</span>
                      </p>
                    </div>
                  </div>

                  <div v-if="service.splits.length > 0" class="flex flex-wrap gap-2">
                    <div
                      v-for="sp in service.splits"
                      :key="sp.id"
                      class="flex items-center gap-2 px-3 py-2 rounded-xl border text-xs"
                      :class="[
                        SPLIT_STATUS[sp.status]!.bg,
                        sp.status === 'paid' ? 'border-green-200 dark:border-green-800/50' :
                        sp.status === 'partial' ? 'border-amber-200 dark:border-amber-800/50' :
                        'border-slate-200 dark:border-slate-700'
                      ]"
                    >
                      <UIcon :name="SPLIT_STATUS[sp.status]!.icon" class="w-3.5 h-3.5" :class="SPLIT_STATUS[sp.status]!.color" />
                      <div>
                        <p class="font-medium text-slate-700 dark:text-slate-300">{{ sp.label }}</p>
                        <p class="font-bold" :class="sp.status === 'paid' ? 'text-green-600 dark:text-green-400' : 'text-slate-500'">
                          {{ fmtMoney(sp.amount) }} сум
                        </p>
                        <p v-if="sp.paidAt" class="text-slate-400 text-[10px]" :title="fmtDate(sp.paidAt)">
                          {{ fromNow(sp.paidAt) }}
                        </p>
                      </div>
                    </div>
                  </div>
                  <p v-else class="text-xs text-amber-500 italic">Сплиты не установлены</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Unpriced tasks warning -->
        <div v-if="earningsWithoutPrice.length > 0">
          <h2 class="text-sm font-semibold text-amber-600 dark:text-amber-400 mb-3 flex items-center gap-2">
            <UIcon name="i-ph-warning" class="w-4 h-4" />
            Цена не установлена ({{ earningsWithoutPrice.length }})
          </h2>
          <div class="space-y-2">
            <div
              v-for="entry in earningsWithoutPrice"
              :key="entry.taskId"
              class="flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-xl"
            >
              <UIcon name="i-ph-tag" class="w-4 h-4 text-amber-500 shrink-0" />
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-slate-800 dark:text-slate-200">{{ entry.taskName }}</p>
                <p class="text-xs text-slate-400">{{ entry.projectName }} · {{ STAGE_SHORT_LABELS[entry.stage] }}</p>
              </div>
              <UBadge color="warning" variant="soft" size="xs">Ожидает оценки</UBadge>
            </div>
          </div>
        </div>

        <!-- Transaction history -->
        <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden">
          <button
            class="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            @click="txExpanded = !txExpanded"
          >
            <UIcon name="i-ph-receipt" class="w-4 h-4 text-slate-400" />
            <span class="flex-1 text-left text-sm font-medium text-slate-700 dark:text-slate-300">История транзакций</span>
            <UBadge v-if="myTransactions.length > 0" color="neutral" variant="soft" size="xs">{{ myTransactions.length }}</UBadge>
            <UIcon :name="txExpanded ? 'i-ph-caret-up' : 'i-ph-caret-down'" class="w-4 h-4 text-slate-400" />
          </button>
          <div v-if="txExpanded" class="border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-50 dark:divide-slate-800/50">
            <EmptyState v-if="myTransactions.length === 0" icon="i-ph-receipt" title="Выплат пока нет" class="py-8" />
            <div
              v-for="tx in myTransactions"
              :key="tx.id"
              class="flex items-center justify-between px-5 py-3"
            >
              <div class="flex items-center gap-3">
                <div class="w-7 h-7 rounded-lg flex items-center justify-center"
                  :class="tx.type === 'inflow' ? 'bg-green-100 dark:bg-green-950/50' : 'bg-blue-100 dark:bg-blue-950/50'">
                  <UIcon
                    :name="tx.type === 'inflow' ? 'i-ph-arrow-down-left' : 'i-ph-arrow-up-right'"
                    class="w-3.5 h-3.5"
                    :class="tx.type === 'inflow' ? 'text-green-600' : 'text-blue-600'"
                  />
                </div>
                <div>
                  <p class="text-xs font-medium text-slate-700 dark:text-slate-300">{{ tx.description }}</p>
                  <p class="text-xs text-slate-400" :title="fmtDate(tx.date)">{{ fromNow(tx.date) }}</p>
                </div>
              </div>
              <span class="text-sm font-bold" :class="tx.type === 'inflow' ? 'text-green-600' : 'text-blue-600'">
                {{ tx.type === 'inflow' ? '+' : '' }}{{ fmtMoney(tx.amount) }}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>
