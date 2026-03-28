<script setup lang="ts">
import { useAuthStore } from '~/stores/useAuthStore'
import { useCrmStore } from '~/stores/useCrmStore'
import { STAGE_SHORT_LABELS, STAGE_ICONS, ROLE_LABELS } from '~/constants/taskCatalog'

definePageMeta({ layout: 'default', middleware: ['auth'] })

const auth = useAuthStore()
const crm  = useCrmStore()
const today = new Date().toISOString().split('T')[0]

function isOverdue(ms: { status: string; dueDate?: string }) {
  return ms.status !== 'paid' && ms.dueDate && ms.dueDate < today
}

// selectedProjectId now comes from the global store (set via sidebar)
const selectedProjectId = computed(() =>
  crm.selectedProjectId ?? crm.projects[0]?.id ?? ''
)
const project     = computed(() => crm.projects.find(p => p.id === selectedProjectId.value))
const financials  = computed(() => crm.projectFinancials(selectedProjectId.value))
const transactions = computed(() => crm.transactionsByProject(selectedProjectId.value))

const fmt = (n: number) => n.toLocaleString('ru-RU')

const SPLIT_STATUS_MAP = {
  pending: { label: 'Ожидает',  color: 'neutral', icon: 'i-ph-clock' },
  partial: { label: 'Частично', color: 'amber',   icon: 'i-ph-timer' },
  paid:    { label: 'Оплачен',  color: 'green',   icon: 'i-ph-check-circle' },
}

// ── Staff payouts from tasks ──────────────────────────────────────────────────
interface StaffPayoutGroup {
  staffId: string
  staffName: string
  initials: string
  total: number
  pending: number
  paid: number
  splits: Array<{ taskId: string; taskName: string; splitId: string; splitLabel: string; amount: number; status: string }>
}

const staffPayoutGroups = computed((): StaffPayoutGroup[] => {
  const map = new Map<string, StaffPayoutGroup>()
  for (const task of project.value?.tasks ?? []) {
    if (task.price === 0 || !task.staffId) continue
    const sid = task.staffId
    const staff = crm.staffById(sid)
    if (!map.has(sid)) {
      map.set(sid, {
        staffId: sid,
        staffName: staff?.name ?? sid,
        initials: staff?.initials ?? '?',
        total: 0, pending: 0, paid: 0,
        splits: [],
      })
    }
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

const totalPending = computed(() =>
  staffPayoutGroups.value.reduce((s, g) => s + g.pending, 0)
)

const expandedStaff = ref<Set<string>>(new Set())
function toggleStaff(id: string) {
  if (expandedStaff.value.has(id)) expandedStaff.value.delete(id)
  else expandedStaff.value.add(id)
  expandedStaff.value = new Set(expandedStaff.value)
}

function payMilestone(msId: string) {
  crm.markMilestonePaid(selectedProjectId.value, msId)
}

function paySplit(taskId: string, splitId: string) {
  crm.markSplitPaid(selectedProjectId.value, taskId, splitId)
}

function payAllForStaff(group: StaffPayoutGroup) {
  for (const s of group.splits) {
    if (s.status !== 'paid') paySplit(s.taskId, s.splitId)
  }
}

function payAllPending() {
  for (const group of staffPayoutGroups.value) payAllForStaff(group)
}

// ── Unpriced tasks count (for alert banner) ───────────────────────────────────
const unpricedTasks = computed(() => crm.unpricedTasks)

// ── Price change requests (financier approval) ────────────────────────────────
const financierId = computed(() => auth.currentUser?.id ?? '')
const pendingPriceChanges = computed(() => crm.pendingChangeRequests(financierId.value))

const priceRejectComment = reactive<Record<string, string>>({})
const showPriceRejectForm = reactive<Record<string, boolean>>({})

function acceptPriceChange(requestId: string) {
  crm.approveChange(requestId, financierId.value)
}
function togglePriceReject(requestId: string) {
  showPriceRejectForm[requestId] = !showPriceRejectForm[requestId]
}
function rejectPriceChange(requestId: string) {
  crm.rejectChange(requestId, financierId.value, priceRejectComment[requestId])
  showPriceRejectForm[requestId] = false
}

function changeLabel(changes: Record<string, { from: unknown; to: unknown }>) {
  return Object.entries(changes).map(([key, val]) => {
    const keyName = key === 'staffId' ? 'исполнитель' : key === 'deadline' ? 'дедлайн' : key === 'price' ? 'цена' : key
    const from = val.from != null ? String(val.from) : '—'
    const to   = val.to   != null ? String(val.to)   : '—'
    return `${keyName}: ${from} → ${to}`
  }).join(', ')
}

function approvalStatusLabel(req: typeof pendingPriceChanges.value[0]) {
  const approved = req.approvals.filter(a => a.status === 'approved').length
  const total    = req.approvals.length
  return `${approved}/${total} согласований`
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <header class="h-16 flex items-center justify-between px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
      <div>
        <h1 class="text-lg font-bold text-slate-900 dark:text-white">Финансовый учёт</h1>
        <p class="text-xs text-slate-500">Управление платежами по проектам</p>
      </div>
      <div class="flex items-center gap-3">
        <span v-if="project" class="text-sm font-medium text-slate-700 dark:text-slate-300 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <UIcon name="i-ph-buildings" class="w-3.5 h-3.5 inline mr-1.5 text-slate-400" />{{ project.name }}
        </span>
        <UBadge color="green" variant="soft" icon="i-ph-wallet">Финансист</UBadge>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto p-6 space-y-6">

      <!-- ══ PRICE CHANGE REQUESTS ════════════════════════════════════ -->
      <div v-if="pendingPriceChanges.length > 0">
        <div class="flex items-center gap-2 mb-3">
          <UIcon name="i-ph-git-pull-request" class="w-5 h-5 text-orange-500" />
          <h2 class="font-semibold text-slate-800 dark:text-slate-200">Запросы на изменение</h2>
          <UBadge color="orange" variant="solid" size="xs">{{ pendingPriceChanges.length }}</UBadge>
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
                  <UBadge color="orange" variant="soft" size="xs">
                    {{ req.type === 'price_change' ? 'Изменение цены' : 'Изменение задачи' }}
                  </UBadge>
                  <span class="text-xs text-slate-400">{{ approvalStatusLabel(req) }}</span>
                </div>
                <p class="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-0.5">
                  {{ changeLabel(req.changes) }}
                </p>
                <p class="text-xs text-slate-500">
                  <span class="font-medium">Причина:</span> {{ req.reason }}
                </p>
                <p class="text-xs text-slate-400 mt-0.5">{{ req.proposedAt }}</p>

                <!-- Approval status pills -->
                <div class="flex gap-1.5 mt-2 flex-wrap">
                  <div
                    v-for="appr in req.approvals"
                    :key="appr.staffId"
                    class="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                    :class="appr.status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                            appr.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                            'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'"
                  >
                    <UIcon
                      :name="appr.status === 'approved' ? 'i-ph-check' : appr.status === 'rejected' ? 'i-ph-x' : 'i-ph-clock'"
                      class="w-3 h-3"
                    />
                    {{ crm.staffById(appr.staffId)?.name ?? appr.role }}
                  </div>
                </div>
              </div>

              <!-- Actions (only for approvals still pending for this user) -->
              <div
                v-if="req.approvals.find(a => a.staffId === financierId && a.status === 'pending')"
                class="flex flex-col gap-1.5 shrink-0"
              >
                <UButton
                  size="sm" color="green" variant="soft" icon="i-ph-check"
                  @click="acceptPriceChange(req.id)"
                >
                  Согласовать
                </UButton>
                <UButton
                  size="sm" color="red" variant="ghost" icon="i-ph-x"
                  @click="togglePriceReject(req.id)"
                >
                  Отказать
                </UButton>
              </div>
            </div>

            <!-- Reject comment -->
            <div v-if="showPriceRejectForm[req.id]" class="mt-3 flex gap-2">
              <UInput
                v-model="priceRejectComment[req.id]"
                placeholder="Комментарий (необязательно)"
                size="sm"
                class="flex-1"
              />
              <UButton size="sm" color="red" @click="rejectPriceChange(req.id)">
                Подтвердить
              </UButton>
            </div>
          </UCard>
        </div>
      </div>

      <!-- Unpriced tasks alert → link to Set Price page -->
      <div v-if="unpricedTasks.length > 0"
        class="flex items-center gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60">
        <UIcon name="i-ph-warning-circle" class="w-5 h-5 text-amber-500 shrink-0" />
        <div class="flex-1">
          <p class="font-semibold text-amber-800 dark:text-amber-200 text-sm">
            {{ unpricedTasks.length }} задач ожидают установки цены
          </p>
          <p class="text-xs text-amber-600 dark:text-amber-400">Перейдите в «Установить цену», чтобы не забыть</p>
        </div>
        <NuxtLink to="/finance/set-price">
          <UButton size="sm" color="amber" variant="soft" icon="i-ph-tag">Установить цену</UButton>
        </NuxtLink>
      </div>

      <!-- ══ SUMMARY BAR ═════════════════════════════════════════════ -->
      <div class="grid grid-cols-4 gap-4">
        <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5">
          <div class="flex items-center gap-3.5">
            <div class="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-slate-50 dark:bg-slate-800">
              <UIcon name="i-ph-file-text" class="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <p class="text-lg font-bold text-slate-800 dark:text-slate-200 leading-tight">{{ fmt(financials.contractAmount) }}</p>
              <p class="text-[11px] text-slate-400 mt-0.5 font-medium">Контракт</p>
            </div>
          </div>
        </div>
        <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5">
          <div class="flex items-center gap-3.5">
            <div class="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-green-50 dark:bg-green-900/20">
              <UIcon name="i-ph-arrow-circle-down" class="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p class="text-lg font-bold text-green-600 leading-tight">{{ fmt(financials.totalInflow) }}</p>
              <p class="text-[11px] text-slate-400 mt-0.5 font-medium">Получено</p>
            </div>
          </div>
        </div>
        <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5">
          <div class="flex items-center gap-3.5">
            <div class="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-red-50 dark:bg-red-900/20">
              <UIcon name="i-ph-arrow-circle-up" class="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p class="text-lg font-bold text-red-500 leading-tight">{{ fmt(financials.totalOutflow) }}</p>
              <p class="text-[11px] text-slate-400 mt-0.5 font-medium">Выплачено</p>
            </div>
          </div>
        </div>
        <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5">
          <div class="flex items-center gap-3.5">
            <div class="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" :class="financials.balance >= 0 ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-red-50 dark:bg-red-900/20'">
              <UIcon name="i-ph-scales" class="w-5 h-5" :class="financials.balance >= 0 ? 'text-blue-600' : 'text-red-600'" />
            </div>
            <div>
              <p class="text-lg font-bold leading-tight" :class="financials.balance >= 0 ? 'text-blue-600' : 'text-red-600'">
                {{ fmt(financials.balance) }}
              </p>
              <p class="text-[11px] text-slate-400 mt-0.5 font-medium">Баланс</p>
            </div>
          </div>
        </div>
      </div>

      <!-- ══ MAIN GRID: Milestones + Staff Payouts ════════════════════ -->
      <div class="grid grid-cols-2 gap-6">

        <!-- CLIENT MILESTONES -->
        <UCard>
          <template #header>
            <p class="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <UIcon name="i-ph-arrow-circle-down" class="w-4 h-4 text-green-500" />
              Платежи от заказчика
            </p>
          </template>
          <div class="space-y-3">
            <div
              v-for="ms in project?.clientMilestones" :key="ms.id"
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
                  <UBadge v-if="isOverdue(ms)" color="red" variant="soft" size="xs" icon="i-ph-warning">
                    Просрочен
                  </UBadge>
                </div>
                <p class="text-xs text-slate-400 mt-0.5">
                  {{ fmt(ms.amount) }} сум
                  <template v-if="ms.dueDate">
                    · срок <span :class="isOverdue(ms) ? 'text-red-500 font-medium' : ''">{{ ms.dueDate }}</span>
                  </template>
                  <template v-if="ms.paidAt"> · получен {{ ms.paidAt }}</template>
                </p>
              </div>
              <div class="flex items-center gap-2">
                <UBadge
                  :color="SPLIT_STATUS_MAP[ms.status].color as any"
                  :icon="SPLIT_STATUS_MAP[ms.status].icon"
                  variant="soft" size="xs"
                >
                  {{ SPLIT_STATUS_MAP[ms.status].label }}
                </UBadge>
                <UButton
                  v-if="ms.status !== 'paid'"
                  size="sm" color="green" variant="soft" icon="i-ph-check"
                  @click="payMilestone(ms.id)"
                >
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
                <span v-if="totalPending > 0" class="text-xs text-red-500 font-medium">
                  К выплате: {{ fmt(totalPending) }} сум
                </span>
                <UButton
                  v-if="totalPending > 0"
                  size="xs" color="red" variant="soft" icon="i-ph-paper-plane-right"
                  @click="payAllPending"
                >
                  Выплатить всем
                </UButton>
              </div>
            </div>
          </template>

          <div class="space-y-2 max-h-96 overflow-y-auto">
            <div v-if="staffPayoutGroups.length === 0" class="py-6 text-center text-slate-400 text-xs">
              Нет назначений с ценами
            </div>

            <div
              v-for="group in staffPayoutGroups" :key="group.staffId"
              class="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden"
            >
              <!-- Group header -->
              <button
                class="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                @click="toggleStaff(group.staffId)"
              >
                <div class="flex items-center gap-2">
                  <UAvatar :text="group.initials" size="xs" />
                  <div class="text-left">
                    <p class="text-sm font-medium text-slate-700 dark:text-slate-300">{{ group.staffName }}</p>
                    <p class="text-xs text-slate-400">Итого: {{ fmt(group.total) }} · Оплачено: {{ fmt(group.paid) }}</p>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <span v-if="group.pending > 0" class="text-xs font-medium text-red-500">{{ fmt(group.pending) }}</span>
                  <UButton
                    v-if="group.pending > 0"
                    size="xs" color="red" variant="ghost" icon="i-ph-paper-plane-right"
                    @click.stop="payAllForStaff(group)"
                  >
                    Выплатить
                  </UButton>
                  <UIcon
                    :name="expandedStaff.has(group.staffId) ? 'i-ph-caret-up' : 'i-ph-caret-down'"
                    class="w-4 h-4 text-slate-400"
                  />
                </div>
              </button>

              <!-- Splits expanded -->
              <div
                v-if="expandedStaff.has(group.staffId)"
                class="border-t border-slate-100 dark:border-slate-700 divide-y divide-slate-50 dark:divide-slate-800"
              >
                <div
                  v-for="s in group.splits" :key="`${s.taskId}-${s.splitId}`"
                  class="flex items-center justify-between px-3 py-2"
                  :class="s.status === 'paid' ? 'opacity-50' : ''"
                >
                  <div>
                    <p class="text-xs text-slate-600 dark:text-slate-400">
                      {{ s.taskName }} · <span class="font-medium">{{ s.splitLabel }}</span>
                    </p>
                  </div>
                  <div class="flex items-center gap-2">
                    <p class="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">{{ fmt(s.amount) }}</p>
                    <UBadge
                      :color="SPLIT_STATUS_MAP[s.status as keyof typeof SPLIT_STATUS_MAP].color as any"
                      variant="soft" size="xs"
                    >
                      {{ SPLIT_STATUS_MAP[s.status as keyof typeof SPLIT_STATUS_MAP].label }}
                    </UBadge>
                    <UButton
                      v-if="s.status !== 'paid'"
                      size="sm" color="red" variant="ghost" icon="i-ph-check"
                      @click="paySplit(s.taskId, s.splitId)"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </UCard>
      </div>

      <!-- TRANSACTION LOG -->
      <UCard>
        <template #header>
          <p class="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <UIcon name="i-ph-receipt" class="w-4 h-4" />
            Журнал транзакций
          </p>
        </template>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-xs text-slate-500 border-b border-slate-100 dark:border-slate-800">
                <th class="text-left pb-3 font-medium">Дата</th>
                <th class="text-left pb-3 font-medium">Тип</th>
                <th class="text-left pb-3 font-medium">Описание</th>
                <th class="text-right pb-3 font-medium">Сумма (сум)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="transactions.length === 0">
                <td colspan="4" class="py-6 text-center text-slate-400 text-xs">Нет транзакций</td>
              </tr>
              <tr
                v-for="tx in [...transactions].sort((a, b) => b.date.localeCompare(a.date))"
                :key="tx.id"
                class="border-b border-slate-50 dark:border-slate-800/50"
              >
                <td class="py-2.5 text-xs text-slate-500">{{ tx.date }}</td>
                <td class="py-2.5">
                  <UBadge
                    :color="tx.type === 'inflow' ? 'green' : 'red'"
                    variant="soft" size="xs"
                    :icon="tx.type === 'inflow' ? 'i-ph-arrow-circle-down' : 'i-ph-arrow-circle-up'"
                  >
                    {{ tx.type === 'inflow' ? 'Приход' : 'Расход' }}
                  </UBadge>
                </td>
                <td class="py-2.5 text-slate-700 dark:text-slate-300 text-xs">{{ tx.description }}</td>
                <td class="py-2.5 text-right font-mono font-semibold text-xs"
                  :class="tx.type === 'inflow' ? 'text-green-600' : 'text-red-500'"
                >
                  {{ tx.type === 'inflow' ? '+' : '-' }}{{ fmt(tx.amount) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>

    </div>
  </div>
</template>
