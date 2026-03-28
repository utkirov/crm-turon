<script setup lang="ts">
import { useCrmStore } from '~/stores/useCrmStore'

definePageMeta({ layout: 'default', middleware: ['auth'] })

const crm = useCrmStore()
const fmt = (n: number) => n.toLocaleString('ru-RU')

const today = new Date().toISOString().split('T')[0]

// ── Revenue by project ────────────────────────────────────────────────────────
const projectStats = computed(() =>
  crm.projects.map(p => {
    const total = p.tasks.length
    const done  = p.tasks.filter(t => t.status === 'done').length
    const completionPct = total > 0 ? Math.round((done / total) * 100) : 0
    return { ...p, fin: crm.projectFinancials(p.id), completionPct, doneServices: done, totalServices: total }
  })
)

const maxContract = computed(() =>
  Math.max(...projectStats.value.map(p => p.contractAmount), 1)
)

// ── Monthly cash flow (last 6 months) ─────────────────────────────────────────
const monthlyFlow = computed(() => {
  const months: Record<string, { inflow: number; outflow: number }> = {}
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    months[key] = { inflow: 0, outflow: 0 }
  }
  for (const tx of crm.transactions) {
    const key = tx.date.slice(0, 7)
    if (months[key]) {
      if (tx.type === 'inflow') months[key].inflow += tx.amount
      else months[key].outflow += tx.amount
    }
  }
  return Object.entries(months).map(([month, vals]) => ({
    month,
    label: new Date(month + '-01').toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' }),
    ...vals,
    net: vals.inflow - vals.outflow
  }))
})

const maxMonthVal = computed(() =>
  Math.max(...monthlyFlow.value.map(m => Math.max(m.inflow, m.outflow)), 1)
)

// ── Top tasks by revenue ──────────────────────────────────────────────────────
const serviceRevenue = computed(() => {
  const map: Record<string, number> = {}
  for (const p of crm.projects) {
    for (const t of p.tasks) {
      if (t.price > 0) {
        map[t.taskId] = (map[t.taskId] ?? 0) + t.price
      }
    }
  }
  return Object.entries(map)
    .map(([id, total]) => ({ id, name: crm.taskMap[id]?.name ?? id, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)
})

const maxServiceRev = computed(() => Math.max(...serviceRevenue.value.map(s => s.total), 1))

// ── Staff performance ─────────────────────────────────────────────────────────
const staffPerf = computed(() =>
  crm.staff
    .filter(s => s.role === 'staff' || s.role === 'pm')
    .map(s => {
      const earnings = crm.staffEarnings(s.id)
      const total  = earnings.reduce((a, e) => a + e.price, 0)
      const earned = earnings.reduce((a, e) => a + e.earned, 0)
      return { ...s, total, earned, tasks: earnings.length, pct: total > 0 ? Math.round(earned / total * 100) : 0 }
    })
    .sort((a, b) => b.total - a.total)
)

// ── Overdue milestones ────────────────────────────────────────────────────────
const overdueMilestones = computed(() => {
  const rows: { project: typeof crm.projects[0]; ms: typeof crm.projects[0]['clientMilestones'][0] }[] = []
  for (const p of crm.projects) {
    for (const ms of p.clientMilestones) {
      if (ms.status !== 'paid' && ms.dueDate && ms.dueDate < today) {
        rows.push({ project: p, ms })
      }
    }
  }
  return rows
})
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <header class="h-16 flex items-center justify-between px-8 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 flex-shrink-0">
      <div>
        <h1 class="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Аналитика</h1>
        <p class="text-xs text-slate-400 mt-0.5">Финансовые показатели компании</p>
      </div>
      <UBadge color="amber" variant="soft" icon="i-ph-crown" size="sm">Директор</UBadge>
    </header>

    <div class="flex-1 overflow-y-auto p-8 space-y-6">

      <!-- Overdue alert -->
      <div
        v-if="overdueMilestones.length > 0"
        class="flex items-start gap-3 p-4 rounded-2xl bg-gradient-to-r from-red-50 to-red-100/50 dark:from-red-950/30 dark:to-red-900/10 border border-red-200/60 dark:border-red-800/40"
      >
        <div class="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
          <UIcon name="i-ph-warning" class="w-5 h-5 text-red-600 dark:text-red-400" />
        </div>
        <div>
          <p class="text-sm font-semibold text-red-800 dark:text-red-300">{{ overdueMilestones.length }} просроченных платежа от заказчиков</p>
          <p class="text-xs text-red-600/70 dark:text-red-400/60 mt-1">{{ overdueMilestones.map(r => `${r.project.name} — ${r.ms.label} (${r.ms.dueDate})`).join(', ') }}</p>
        </div>
      </div>

      <!-- Revenue by project bar chart -->
      <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <p class="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <UIcon name="i-ph-chart-bar" class="w-4 h-4 text-blue-500" />
            Выручка по проектам
          </p>
          <div class="flex items-center gap-4 text-xs text-slate-400">
            <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-green-400 inline-block" /> Получено</span>
            <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-red-300 inline-block" /> Расходы</span>
          </div>
        </div>
        <div class="p-6 space-y-5">
          <div v-for="p in projectStats" :key="p.id">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2 min-w-0">
                <span class="font-medium text-sm text-slate-700 dark:text-slate-300 truncate max-w-xs">{{ p.name }}</span>
                <UBadge
                  :color="p.status === 'active' ? 'green' : p.status === 'completed' ? 'blue' : 'amber'"
                  variant="soft" size="xs"
                >
                  {{ p.status === 'active' ? 'Активен' : p.status === 'completed' ? 'Завершён' : 'Пауза' }}
                </UBadge>
              </div>
              <div class="flex items-center gap-4 text-xs flex-shrink-0 ml-3">
                <span class="text-green-600 font-medium">+{{ fmt(p.fin.totalInflow) }}</span>
                <span class="text-slate-400">из {{ fmt(p.contractAmount) }}</span>
              </div>
            </div>
            <!-- Получено -->
            <div class="space-y-1">
              <div class="flex gap-2 items-center">
                <span class="text-[10px] text-slate-400 w-14 shrink-0">Получено</span>
                <div class="flex-1 h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    class="h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-700"
                    :style="{ width: `${(p.fin.totalInflow / maxContract) * 100}%` }"
                  />
                </div>
              </div>
              <div class="flex gap-2 items-center">
                <span class="text-[10px] text-slate-400 w-14 shrink-0">Расходы</span>
                <div class="flex-1 h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    class="h-full rounded-full bg-gradient-to-r from-red-300 to-red-400 transition-all duration-700"
                    :style="{ width: `${(p.fin.totalOutflow / maxContract) * 100}%` }"
                  />
                </div>
              </div>
            </div>
            <div class="flex items-center gap-4 text-xs text-slate-400 mt-1.5 ml-16">
              <span>Расходы: <span class="text-red-500">{{ fmt(p.fin.totalOutflow) }}</span></span>
              <span>Баланс: <span :class="p.fin.balance >= 0 ? 'text-blue-600 font-semibold' : 'text-red-600 font-semibold'">{{ fmt(p.fin.balance) }}</span></span>
              <span>Услуги: <span class="text-slate-600 dark:text-slate-300 font-medium">{{ p.doneServices }}/{{ p.totalServices }}</span></span>
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-6">

        <!-- Monthly cash flow -->
        <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
            <p class="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <UIcon name="i-ph-trend-up" class="w-4 h-4 text-green-500" />
              Денежный поток (6 мес.)
            </p>
            <div class="flex items-center gap-3 text-xs text-slate-400">
              <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-green-400 inline-block" /> Приход</span>
              <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-red-300 inline-block" /> Расход</span>
            </div>
          </div>
          <div class="p-6 space-y-4">
            <div v-for="m in monthlyFlow" :key="m.month">
              <div class="flex items-center justify-between text-xs mb-1.5">
                <span class="font-semibold text-slate-600 dark:text-slate-400 w-16 flex-shrink-0">{{ m.label }}</span>
                <div class="flex gap-3">
                  <span class="text-green-600 font-medium">+{{ fmt(m.inflow) }}</span>
                  <span class="text-red-500">-{{ fmt(m.outflow) }}</span>
                  <span :class="m.net >= 0 ? 'text-blue-600' : 'text-red-600'" class="font-semibold">
                    {{ m.net >= 0 ? '+' : '' }}{{ fmt(m.net) }}
                  </span>
                </div>
              </div>
              <div class="space-y-1 ml-16">
                <div class="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    class="h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all"
                    :style="{ width: `${(m.inflow / maxMonthVal) * 100}%` }"
                  />
                </div>
                <div class="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    class="h-full rounded-full bg-gradient-to-r from-red-300 to-red-400 transition-all"
                    :style="{ width: `${(m.outflow / maxMonthVal) * 100}%` }"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Top services -->
        <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
            <p class="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <UIcon name="i-ph-stack" class="w-4 h-4 text-purple-500" />
              Топ услуг по выручке
            </p>
          </div>
          <div class="p-6 space-y-4">
            <div v-for="(svc, idx) in serviceRevenue" :key="svc.id" class="flex items-center gap-3">
              <span class="text-xs font-bold text-slate-300 dark:text-slate-600 w-5 flex-shrink-0 text-center">{{ idx + 1 }}</span>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between text-xs mb-1">
                  <span class="truncate text-slate-700 dark:text-slate-300 font-medium">{{ svc.name }}</span>
                  <span class="text-slate-600 dark:text-slate-400 flex-shrink-0 ml-2 font-mono font-semibold">{{ fmt(svc.total) }}</span>
                </div>
                <div class="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    class="h-full bg-gradient-to-r from-purple-400 to-indigo-500 rounded-full transition-all duration-700"
                    :style="{ width: `${(svc.total / maxServiceRev) * 100}%` }"
                  />
                </div>
              </div>
            </div>
            <div v-if="serviceRevenue.length === 0" class="py-6 text-center text-slate-400 text-sm">
              <UIcon name="i-ph-stack" class="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>Нет данных</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Staff performance -->
      <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <p class="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <UIcon name="i-ph-users" class="w-4 h-4 text-blue-500" />
            Эффективность сотрудников
          </p>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-[11px] text-slate-400 border-b border-slate-100 dark:border-slate-800 uppercase tracking-wider">
                <th class="text-left pb-3 pt-1 px-6 font-medium">Сотрудник</th>
                <th class="text-left pb-3 pt-1 font-medium">Должность</th>
                <th class="text-center pb-3 pt-1 font-medium">Задач</th>
                <th class="text-right pb-3 pt-1 font-medium">Выплачено</th>
                <th class="text-right pb-3 pt-1 font-medium">Итого</th>
                <th class="text-left pb-3 pt-1 pr-6 font-medium w-40">Прогресс</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="s in staffPerf" :key="s.id"
                class="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors"
              >
                <td class="py-3.5 px-6">
                  <div class="flex items-center gap-2.5">
                    <UAvatar :text="s.initials" size="sm" />
                    <div>
                      <p class="font-semibold text-slate-800 dark:text-slate-200 text-sm">{{ s.name }}</p>
                    </div>
                  </div>
                </td>
                <td class="py-3.5 text-xs text-slate-500">{{ s.specialization }}</td>
                <td class="py-3.5 text-center">
                  <UBadge color="neutral" variant="soft" size="xs">{{ s.tasks }}</UBadge>
                </td>
                <td class="py-3.5 text-right font-mono text-sm text-green-600 font-semibold">{{ fmt(s.earned) }}</td>
                <td class="py-3.5 text-right font-mono text-xs text-slate-500">{{ fmt(s.total) }}</td>
                <td class="py-3.5 pr-6">
                  <div class="flex items-center gap-2">
                    <div class="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        class="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-700"
                        :style="{ width: s.pct + '%' }"
                      />
                    </div>
                    <span class="text-xs text-slate-400 w-8 text-right">{{ s.pct }}%</span>
                  </div>
                </td>
              </tr>
              <tr v-if="staffPerf.length === 0">
                <td colspan="6" class="py-12 text-center text-slate-400 text-sm">
                  <UIcon name="i-ph-users" class="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>Нет данных о сотрудниках</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  </div>
</template>
