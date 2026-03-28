<script setup lang="ts">
import { useAuthStore } from '~/stores/useAuthStore'
import { useCrmStore } from '~/stores/useCrmStore'

definePageMeta({ layout: 'default', middleware: ['auth'] })

const auth = useAuthStore()
const crm  = useCrmStore()
const router = useRouter()

if (auth.currentRole && auth.currentRole !== 'ceo') {
  navigateTo(auth.roleHome)
}

const health = computed(() => crm.companyHealth)
const fmt = (n: number) => n.toLocaleString('ru-RU')
const today = new Date().toISOString().split('T')[0]

function fmtDate(iso?: string) {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))
  } catch { return iso }
}

// ── Table sort ─────────────────────────────────────────────────────────────────
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

const projectRows = computed(() => {
  const rows = crm.projects.map(p => ({ ...p, fin: crm.projectFinancials(p.id), progress: projectProgress(p) }))
  return rows.sort((a, b) => {
    let va: number | string = 0, vb: number | string = 0
    if (sortKey.value === 'name')     { va = a.name;              vb = b.name }
    if (sortKey.value === 'amount')   { va = a.contractAmount;    vb = b.contractAmount }
    if (sortKey.value === 'inflow')   { va = a.fin.totalInflow;   vb = b.fin.totalInflow }
    if (sortKey.value === 'balance')  { va = a.fin.balance;       vb = b.fin.balance }
    if (sortKey.value === 'progress') { va = a.progress;          vb = b.progress }
    if (sortKey.value === 'status')   { va = a.status;            vb = b.status }
    if (va < vb) return -1 * sortDir.value
    if (va > vb) return  1 * sortDir.value
    return 0
  })
})

const staffRows = computed(() =>
  crm.staff
    .filter(s => s.role === 'staff' || s.role === 'pm')
    .map(s => {
      const e = crm.staffEarnings(s.id)
      return { ...s, total: e.reduce((a, x) => a + x.total, 0), earned: e.reduce((a, x) => a + x.earned, 0), tasks: e.length }
    })
    .sort((a, b) => b.total - a.total)
)

const TYPE_LABELS: Record<string, string> = {
  residential: 'Жилой', commercial: 'Коммерческий',
  education: 'Образование', infrastructure: 'Инфраструктура'
}

// Overdue milestones across all projects
const overdueMilestones = computed(() => {
  const result: { projectName: string; label: string; dueDate: string; amount: number }[] = []
  for (const p of crm.projects) {
    for (const ms of p.clientMilestones) {
      if (ms.status !== 'paid' && ms.dueDate && ms.dueDate < today) {
        result.push({ projectName: p.name, label: ms.label, dueDate: ms.dueDate, amount: ms.amount })
      }
    }
  }
  return result
})

const totalContracts = computed(() =>
  crm.projects.reduce((s, p) => s + p.contractAmount, 0)
)

const stats = computed(() => [
  { label: 'Общая выручка',     value: fmt(health.value.totalRevenue),      icon: 'i-ph-trend-up',               color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-900/20' },
  { label: 'Расходы',           value: fmt(health.value.totalExpenses),     icon: 'i-ph-trend-down',             color: 'text-red-500',    bg: 'bg-red-50 dark:bg-red-900/20' },
  { label: 'Прибыль',           value: fmt(health.value.totalProfit),       icon: 'i-ph-currency-circle-dollar', color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-900/20' },
  { label: 'Активных проектов', value: String(health.value.activeProjects), icon: 'i-ph-folder-open',            color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
  { label: 'Общий портфель',    value: fmt(totalContracts.value),           icon: 'i-ph-briefcase',              color: 'text-amber-600',  bg: 'bg-amber-50 dark:bg-amber-900/20' }
])
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <header class="h-16 flex items-center justify-between px-8 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 flex-shrink-0">
      <div>
        <h1 class="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Дашборд</h1>
        <p class="text-xs text-slate-400 mt-0.5">Общее состояние компании</p>
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
          <p class="text-sm font-semibold text-red-800 dark:text-red-300">{{ overdueMilestones.length }} просроченных платежей от заказчиков</p>
          <ul class="mt-1.5 space-y-0.5">
            <li v-for="ms in overdueMilestones" :key="`${ms.projectName}-${ms.label}`" class="text-xs text-red-600/80 dark:text-red-400/70">
              <span class="font-medium">{{ ms.projectName }}</span> — {{ ms.label }}
              ({{ fmt(ms.amount) }} сум, срок {{ fmtDate(ms.dueDate) }})
            </li>
          </ul>
        </div>
      </div>

      <!-- Stat cards (5 cols) -->
      <div class="grid grid-cols-5 gap-4">
        <div
          v-for="s in stats" :key="s.label"
          class="card-hover bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5"
        >
          <div class="flex items-center gap-3.5">
            <div class="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" :class="s.bg">
              <UIcon :name="s.icon" class="w-5 h-5" :class="s.color" />
            </div>
            <div>
              <p class="text-lg font-bold text-slate-900 dark:text-white leading-tight tracking-tight">{{ s.value }}</p>
              <p class="text-[11px] text-slate-400 mt-0.5 font-medium">{{ s.label }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Projects table -->
      <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <p class="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <UIcon name="i-ph-kanban" class="w-4 h-4 text-blue-500" />
            Портфель проектов
            <span class="text-xs font-normal text-slate-400 ml-1">({{ projectRows.length }})</span>
          </p>
        </div>
        <div class="overflow-x-auto">
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
                @click="router.push('/pm/projects')"
              >
                <td class="py-3.5 pl-6">
                  <p class="font-semibold text-slate-800 dark:text-slate-200">{{ p.name }}</p>
                  <p class="text-xs text-slate-400 mt-0.5">{{ p.client }}</p>
                </td>
                <td class="py-3.5 text-slate-500 text-xs">{{ TYPE_LABELS[p.type] }}</td>
                <td class="py-3.5 text-right font-mono text-xs text-slate-600 dark:text-slate-400">{{ fmt(p.contractAmount) }}</td>
                <td class="py-3.5 text-right font-mono text-sm font-semibold text-green-600">{{ fmt(p.fin.totalInflow) }}</td>
                <td class="py-3.5 text-right font-mono text-xs text-red-500">{{ fmt(p.fin.totalOutflow) }}</td>
                <td class="py-3.5 text-right font-mono text-sm font-bold" :class="p.fin.balance >= 0 ? 'text-blue-600' : 'text-red-600'">
                  {{ fmt(p.fin.balance) }}
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
                  <UBadge :color="p.status === 'active' ? 'green' : p.status === 'completed' ? 'blue' : 'amber'" variant="soft" size="sm">
                    {{ p.status === 'active' ? 'Активен' : p.status === 'completed' ? 'Завершён' : 'Пауза' }}
                  </UBadge>
                </td>
              </tr>
              <tr v-if="projectRows.length === 0">
                <td colspan="8" class="py-12 text-center text-slate-400 text-sm">
                  <UIcon name="i-ph-folder-open" class="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>Нет проектов</p>
                </td>
              </tr>
            </tbody>
          </table>
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
          <div v-if="staffRows.length === 0" class="flex flex-col items-center py-8 text-slate-400">
            <UIcon name="i-ph-users" class="w-8 h-8 mb-2 opacity-30" />
            <p class="text-sm">Нет сотрудников</p>
          </div>
          <div v-else class="space-y-4">
            <div v-for="s in staffRows" :key="s.id" class="flex items-center gap-4 group">
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
                    <span class="text-emerald-600 font-semibold">{{ fmt(s.earned) }}</span>
                    <span class="text-slate-300"> / </span>
                    <span>{{ fmt(s.total) }}</span>
                    <span class="text-slate-400"> сум</span>
                  </p>
                </div>
                <div class="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    class="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-700"
                    :style="{ width: (s.total > 0 ? Math.round((s.earned / s.total) * 100) : 0) + '%' }"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
