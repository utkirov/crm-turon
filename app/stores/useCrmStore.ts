import { defineStore } from 'pinia'
import dayjs from 'dayjs'
import { TASK_CATALOG as INITIAL_TASK_CATALOG, TASK_MAP as STATIC_TASK_MAP } from '~/constants/taskCatalog'
import { MOCK_STAFF } from '~/stores/useAuthStore'
import type {
  CrmProject, Transaction, ProjectTask, PaymentSplit,
  PaymentStatus, ClientMilestone, ProjectFinancials, StaffEarningEntry, CompanyHealth,
  DesignStage, ServiceStatus, DocumentTemplate, ProjectDocument, DocumentStatus,
  CatalogTask, StaffMember, ChangeRequest, ChangeApproval
} from '~/types/crm'

// ─── Mock Data ────────────────────────────────────────────────────────────────

function makeSplit(id: string, label: string, pct: number, total: number, status: PaymentStatus, paidAt?: string): PaymentSplit {
  return { id, label, percent: pct, amount: Math.round(total * pct / 100), status, paidAt }
}

const MOCK_DOC_TEMPLATES: DocumentTemplate[] = [
  // sketch
  { id: 'doc-sketch-1', name: 'ТЗ на проектирование',       stage: 'sketch' },
  { id: 'doc-sketch-2', name: 'Топографическая съёмка',      stage: 'sketch' },
  { id: 'doc-sketch-3', name: 'Геологический отчёт',         stage: 'sketch' },
  { id: 'doc-sketch-4', name: 'Свидетельство на землю',      stage: 'sketch' },
  // working
  { id: 'doc-work-1',   name: 'Утверждённый эскизный проект', stage: 'working' },
  { id: 'doc-work-2',   name: 'Технические условия (ТУ)',    stage: 'working' },
  { id: 'doc-work-3',   name: 'Нормы пожарной безопасности', stage: 'working' },
  // expertise
  { id: 'doc-exp-1',    name: 'Согласованный ЭП',            stage: 'expertise' },
  { id: 'doc-exp-2',    name: 'Экспертное задание',          stage: 'expertise' },
  // construction
  { id: 'doc-con-1',    name: 'Разрешение на строительство', stage: 'construction' },
  { id: 'doc-con-2',    name: 'Акт на земельный участок',    stage: 'construction' },
  { id: 'doc-con-3',    name: 'Строительный паспорт',        stage: 'construction' },
]

const MOCK_PROJECTS: CrmProject[] = [
  {
    id: 'proj-001',
    name: 'ЖК «Нур Сити»',
    client: 'ООО «Turon Build»',
    location: 'Ташкент, Юнусабадский р-н',
    type: 'residential',
    pmId: 'dilshod',
    contractAmount: 450_000_000,
    status: 'active',
    createdAt: '2026-01-10',
    contactPerson: 'Бобур Хасанов',
    contactPhone: '+998 90 123-45-67',
    contactEmail: 'b.hasanov@turonbuild.uz',
    clientMilestones: [
      { id: 'ms-001-1', label: 'Аванс (30%)',      percent: 30, amount: 135_000_000, status: 'paid',    dueDate: '2026-01-20', paidAt: '2026-01-18' },
      { id: 'ms-001-2', label: 'Сдача ЭП (40%)',   percent: 40, amount: 180_000_000, status: 'pending', dueDate: '2026-03-01' },
      { id: 'ms-001-3', label: 'Финальный (30%)',  percent: 30, amount: 135_000_000, status: 'pending', dueDate: '2026-05-01' },
    ],
    documents: [
      { id: 'pd-001-1', templateId: 'doc-sketch-1', name: 'ТЗ на проектирование',  stage: 'sketch', status: 'received', receivedDate: '2026-01-12' },
      { id: 'pd-001-2', templateId: 'doc-sketch-2', name: 'Топографическая съёмка', stage: 'sketch', status: 'pending',  pendingReason: 'Заказчик задерживает предоставление' },
      { id: 'pd-001-3', templateId: 'doc-sketch-3', name: 'Геологический отчёт',   stage: 'sketch', status: 'pending' },
    ],
    tasks: [
      {
        id: 'pt-001-1', taskId: 'task-ep-arch-plans',
        stage: 'sketch', role: 'architect', staffId: 'ivan',
        price: 5_000_000, status: 'done', deadline: '2026-02-15',
        paymentSplits: [
          makeSplit('sp-001-1-1', 'Аванс',         30, 5_000_000, 'paid',    '2026-01-19'),
          makeSplit('sp-001-1-2', 'Промежуточный', 40, 5_000_000, 'paid',    '2026-02-10'),
          makeSplit('sp-001-1-3', 'Финальный',     30, 5_000_000, 'pending'),
        ],
      },
      {
        id: 'pt-001-2', taskId: 'task-ep-arch-gp',
        stage: 'sketch', role: 'architect', staffId: 'ivan',
        price: 4_000_000, status: 'in_progress', deadline: '2026-02-28',
        paymentSplits: [
          makeSplit('sp-001-2-1', 'Аванс',         30, 4_000_000, 'paid',    '2026-01-19'),
          makeSplit('sp-001-2-2', 'Промежуточный', 40, 4_000_000, 'pending'),
          makeSplit('sp-001-2-3', 'Финальный',     30, 4_000_000, 'pending'),
        ],
      },
      {
        id: 'pt-001-3', taskId: 'task-ep-arch-planshet',
        stage: 'sketch', role: 'architect', staffId: 'ivan',
        price: 0, status: 'todo', deadline: '2026-03-10', paymentSplits: [],
      },
      {
        id: 'pt-001-4', taskId: 'task-rp-eng-kzh',
        stage: 'working', role: 'engineer', staffId: 'aziz',
        price: 10_000_000, status: 'todo', deadline: '2026-04-15',
        paymentSplits: [
          makeSplit('sp-001-4-1', 'Аванс',         30, 10_000_000, 'pending'),
          makeSplit('sp-001-4-2', 'Промежуточный', 40, 10_000_000, 'pending'),
          makeSplit('sp-001-4-3', 'Финальный',     30, 10_000_000, 'pending'),
        ],
      },
    ],
  },
  {
    id: 'proj-002',
    name: 'БЦ «Silk Road»',
    client: 'АО «Silk Invest»',
    location: 'Ташкент, Мирзо-Улугбекский р-н',
    type: 'commercial',
    pmId: 'dilshod',
    contractAmount: 280_000_000,
    status: 'active',
    createdAt: '2026-02-05',
    contactPerson: 'Нилуфар Джалилова',
    contactPhone: '+998 93 456-78-90',
    contactEmail: 'n.jalilova@silkinvest.uz',
    clientMilestones: [
      { id: 'ms-002-1', label: 'Аванс (30%)',     percent: 30, amount: 84_000_000,  status: 'paid',    dueDate: '2026-02-10', paidAt: '2026-02-08' },
      { id: 'ms-002-2', label: 'Финальный (70%)', percent: 70, amount: 196_000_000, status: 'pending', dueDate: '2026-05-15' },
    ],
    documents: [
      { id: 'pd-002-1', templateId: 'doc-sketch-1', name: 'ТЗ на проектирование', stage: 'sketch', status: 'received', receivedDate: '2026-02-06' },
      { id: 'pd-002-2', templateId: 'doc-sketch-4', name: 'Свидетельство на землю', stage: 'sketch', status: 'pending', pendingReason: '' },
    ],
    tasks: [
      {
        id: 'pt-002-1', taskId: 'task-ep-des-3d',
        stage: 'sketch', role: 'designer', staffId: 'ivan',
        price: 15_000_000, status: 'in_progress', deadline: '2026-03-20',
        paymentSplits: [
          makeSplit('sp-002-1-1', 'Аванс',     50, 15_000_000, 'paid', '2026-02-09'),
          makeSplit('sp-002-1-2', 'Финальный', 50, 15_000_000, 'pending'),
        ],
      },
      {
        id: 'pt-002-2', taskId: 'task-ep-des-facade',
        stage: 'sketch', role: 'designer', staffId: 'ivan',
        price: 0, status: 'todo', deadline: '2026-04-01', paymentSplits: [],
      },
    ],
  },
]

const MOCK_TRANSACTIONS: Transaction[] = [
  { id: 'tx-001', projectId: 'proj-001', type: 'inflow',  amount: 135_000_000, description: 'Аванс от клиента (30%)',          date: '2026-01-18', category: 'client_payment', milestoneId: 'ms-001-1' },
  { id: 'tx-002', projectId: 'proj-002', type: 'inflow',  amount: 84_000_000,  description: 'Аванс от клиента (30%)',          date: '2026-02-08', category: 'client_payment', milestoneId: 'ms-002-1' },
  { id: 'tx-003', projectId: 'proj-001', type: 'outflow', amount: 1_500_000,   description: 'Аванс Ивану — Планировки',        date: '2026-01-19', category: 'staff_payment',  staffId: 'ivan', taskId: 'pt-001-1' },
  { id: 'tx-004', projectId: 'proj-001', type: 'outflow', amount: 2_000_000,   description: 'Промеж. Ивану — Планировки',      date: '2026-02-10', category: 'staff_payment',  staffId: 'ivan', taskId: 'pt-001-1' },
  { id: 'tx-005', projectId: 'proj-001', type: 'outflow', amount: 1_200_000,   description: 'Аванс Ивану — Ген. план',          date: '2026-01-19', category: 'staff_payment',  staffId: 'ivan', taskId: 'pt-001-2' },
  { id: 'tx-006', projectId: 'proj-002', type: 'outflow', amount: 7_500_000,   description: 'Аванс Ивану — 3D-визуализация',   date: '2026-02-09', category: 'staff_payment',  staffId: 'ivan', taskId: 'pt-002-1' },
]

// ─── Store ────────────────────────────────────────────────────────────────────

export const useCrmStore = defineStore('crm', {
  state: () => ({
    projects:          [] as CrmProject[],
    staff:             [] as StaffMember[],
    transactions:      [] as Transaction[],
    taskCatalog:       [...INITIAL_TASK_CATALOG] as CatalogTask[],
    documentTemplates: [...MOCK_DOC_TEMPLATES]   as DocumentTemplate[],
    changeRequests:    [] as ChangeRequest[],
    selectedProjectId: null as string | null,
    _loading:          false,
    _error:            null as string | null,
  }),

  getters: {
    // ── Task catalog helpers ─────────────────────────────────────────────────
    taskMap: (state): Record<string, CatalogTask> =>
      Object.fromEntries(state.taskCatalog.map(t => [t.id, t])),

    // ── Project lookups ──────────────────────────────────────────────────────
    getProjectById: (state) => (id: string) =>
      state.projects.find(p => p.id === id) ?? null,

    projectsByPm: (state) => (pmId: string) =>
      state.projects.filter(p => p.pmId === pmId),

    // ── Staff lookups ────────────────────────────────────────────────────────
    staffById: (state) => (id: string) =>
      state.staff.find(s => s.id === id) ?? null,

    staffWorkers: (state) =>
      state.staff.filter(s => s.role === 'staff'),

    // ── Financials ───────────────────────────────────────────────────────────
    projectFinancials: (state) => (projectId: string): ProjectFinancials => {
      const project = state.projects.find(p => p.id === projectId)
      if (!project) return { contractAmount: 0, totalInflow: 0, totalOutflow: 0, balance: 0, paidPercent: 0 }

      const totalInflow = project.clientMilestones
        .filter(m => m.status === 'paid')
        .reduce((s, m) => s + m.amount, 0)

      const totalOutflow = project.tasks.flatMap(t => t.paymentSplits)
        .filter(sp => sp.status === 'paid')
        .reduce((s, sp) => s + sp.amount, 0)

      return {
        contractAmount: project.contractAmount,
        totalInflow,
        totalOutflow,
        balance: totalInflow - totalOutflow,
        paidPercent: project.contractAmount > 0
          ? Math.round(totalInflow / project.contractAmount * 100)
          : 0,
      }
    },

    // ── Staff earnings ───────────────────────────────────────────────────────
    staffEarnings: (state) => (staffId: string): StaffEarningEntry[] => {
      const entries: StaffEarningEntry[] = []
      const taskMap = Object.fromEntries(state.taskCatalog.map(t => [t.id, t]))
      for (const project of state.projects) {
        for (const task of project.tasks) {
          if (task.staffId !== staffId) continue
          const catalogTask = taskMap[task.taskId]
          const earned  = task.paymentSplits.filter(sp => sp.status === 'paid').reduce((s, sp) => s + sp.amount, 0)
          const pending = task.paymentSplits.filter(sp => sp.status !== 'paid').reduce((s, sp) => s + sp.amount, 0)
          entries.push({
            projectId: project.id,
            projectName: project.name,
            taskId: task.id,
            taskName: catalogTask?.name ?? task.taskId,
            stage: task.stage,
            role: task.role,
            price: task.price,
            earned,
            pending,
            splits: task.paymentSplits,
          })
        }
      }
      return entries
    },

    // ── Tasks by staff ───────────────────────────────────────────────────────
    tasksByStaff: (state) => (staffId: string) => {
      const result: Array<{ project: CrmProject; task: ProjectTask }> = []
      for (const project of state.projects) {
        for (const task of project.tasks) {
          if (task.staffId === staffId) result.push({ project, task })
        }
      }
      return result
    },

    // ── Unpriced tasks ───────────────────────────────────────────────────────
    unpricedTasks: (state) => {
      const result: Array<{ project: CrmProject; task: ProjectTask }> = []
      for (const project of state.projects) {
        for (const task of project.tasks) {
          if (task.price === 0) result.push({ project, task })
        }
      }
      return result
    },

    // ── Transactions ─────────────────────────────────────────────────────────
    transactionsByProject: (state) => (projectId: string) =>
      state.transactions.filter(tx => tx.projectId === projectId),

    staffTransactions: (state) => (staffId: string) =>
      state.transactions.filter(tx => tx.staffId === staffId),

    // ── Change requests ──────────────────────────────────────────────────────
    pendingChangeRequests: (state) => (staffId: string) => {
      return state.changeRequests.filter(req =>
        req.status === 'pending' &&
        req.approvals.some(a => a.staffId === staffId && a.status === 'pending')
      )
    },

    pendingChangeCount: (state) => (staffId: string): number => {
      return state.changeRequests.filter(req =>
        req.status === 'pending' &&
        req.approvals.some(a => a.staffId === staffId && a.status === 'pending')
      ).length
    },

    // ── Company health ───────────────────────────────────────────────────────
    companyHealth: (state): CompanyHealth => {
      let totalRevenue = 0, totalExpenses = 0, totalContracts = 0, activeProjects = 0
      for (const p of state.projects) {
        totalContracts += p.contractAmount
        if (p.status === 'active') activeProjects++
        totalRevenue  += p.clientMilestones.filter(m => m.status === 'paid').reduce((s, m) => s + m.amount, 0)
        totalExpenses += p.tasks.flatMap(t => t.paymentSplits).filter(sp => sp.status === 'paid').reduce((s, sp) => s + sp.amount, 0)
      }
      return { totalRevenue, totalExpenses, totalProfit: totalRevenue - totalExpenses, activeProjects, totalContracts }
    },
  },

  actions: {
    // ── Fetch all data from server ────────────────────────────────────────────
    async fetchAll() {
      this._loading = true
      this._error   = null
      try {
        const [projectsData, transactionsData, staffData] = await Promise.all([
          $fetch<CrmProject[]>('/api/projects'),
          $fetch<Transaction[]>('/api/transactions'),
          $fetch<StaffMember[]>('/api/staff'),
        ])
        this.projects     = projectsData
        this.transactions = transactionsData
        this.staff        = staffData
      }
      catch (e: any) {
        this._error = e?.data?.message ?? e?.message ?? 'Ошибка загрузки данных'
      }
      finally {
        this._loading = false
      }
    },

    // ── Catalog management ────────────────────────────────────────────────────
    addCatalogTask(task: Omit<CatalogTask, 'id'>) {
      const id = `task-custom-${Date.now()}`
      this.taskCatalog.push({ ...task, id })
      return id
    },
    removeCatalogTask(id: string) {
      const idx = this.taskCatalog.findIndex(t => t.id === id)
      if (idx >= 0) this.taskCatalog.splice(idx, 1)
    },
    updateCatalogTask(id: string, changes: Partial<Omit<CatalogTask, 'id'>>) {
      const task = this.taskCatalog.find(t => t.id === id)
      if (task) Object.assign(task, changes)
    },

    // ── Staff management ──────────────────────────────────────────────────────
    addStaff(member: Omit<StaffMember, 'id' | 'initials'>) {
      const parts = member.name.trim().split(' ')
      const initials = parts.map(p => p[0]?.toUpperCase() ?? '').join('').slice(0, 2)
      const id = `staff-${Date.now()}`
      this.staff.push({ ...member, id, initials })
      return id
    },
    removeStaff(id: string) {
      const idx = this.staff.findIndex(s => s.id === id)
      if (idx >= 0) this.staff.splice(idx, 1)
    },
    updateStaff(id: string, changes: Partial<Omit<StaffMember, 'id'>>) {
      const member = this.staff.find(s => s.id === id)
      if (!member) return
      Object.assign(member, changes)
      // Recalculate initials if name changed
      if (changes.name) {
        const parts = changes.name.trim().split(' ')
        member.initials = parts.map(p => p[0]?.toUpperCase() ?? '').join('').slice(0, 2)
      }
    },

    // ── Document management ───────────────────────────────────────────────────
    addDocumentToProject(projectId: string, template: DocumentTemplate) {
      const project = this.projects.find(p => p.id === projectId)
      if (!project) return
      // Avoid duplicates
      if (project.documents.some(d => d.templateId === template.id)) return
      project.documents.push({
        id: `doc-${projectId}-${Date.now()}`,
        templateId: template.id,
        name: template.name,
        stage: template.stage,
        status: 'pending',
      })
    },
    removeDocumentFromProject(projectId: string, docId: string) {
      const project = this.projects.find(p => p.id === projectId)
      if (!project) return
      const idx = project.documents.findIndex(d => d.id === docId)
      if (idx >= 0) project.documents.splice(idx, 1)
    },
    updateDocumentStatus(
      projectId: string, docId: string,
      status: DocumentStatus, receivedDate?: string, pendingReason?: string,
    ) {
      const project = this.projects.find(p => p.id === projectId)
      if (!project) return
      const doc = project.documents.find(d => d.id === docId)
      if (!doc) return
      doc.status = status
      doc.receivedDate  = receivedDate
      doc.pendingReason = pendingReason
      $fetch(`/api/documents/${docId}`, { method: 'PATCH', body: { status, receivedDate: receivedDate ?? null, pendingReason: pendingReason ?? null } }).catch((e: any) => {
        useToast().add({ color: 'error', title: 'Не удалось обновить документ', description: e?.message })
      })
    },
    addDocumentTemplate(template: Omit<DocumentTemplate, 'id'>) {
      const id = `doc-tmpl-${Date.now()}`
      this.documentTemplates.push({ ...template, id })
      return id
    },
    removeDocumentTemplate(id: string) {
      const idx = this.documentTemplates.findIndex(t => t.id === id)
      if (idx >= 0) this.documentTemplates.splice(idx, 1)
    },

    // ── Create project ────────────────────────────────────────────────────────
    async createProject(data: {
      name: string; client: string; location: string; type: CrmProject['type']
      pmId: string; contractAmount: number
      startDate?: string; plannedEndDate?: string
      contactPerson?: string; contactPhone?: string; contactEmail?: string
      milestones: Array<{ label: string; percent: number; dueDate?: string }>
      tasks: Array<{ taskId: string; staffId: string | null; deadline?: string }>
      documents?: Array<{ templateId: string; name: string; stage: DesignStage }>
    }) {
      const id = `proj-${Date.now()}`
      const totalPct = data.milestones.reduce((s, m) => s + m.percent, 0)
      const taskMap = Object.fromEntries(this.taskCatalog.map(t => [t.id, t]))

      const project: CrmProject = {
        id, name: data.name, client: data.client, location: data.location,
        type: data.type, pmId: data.pmId, contractAmount: data.contractAmount,
        status: 'active', createdAt: dayjs().format('YYYY-MM-DD'),
        startDate: data.startDate, plannedEndDate: data.plannedEndDate,
        contactPerson: data.contactPerson, contactPhone: data.contactPhone,
        contactEmail: data.contactEmail,
        clientMilestones: data.milestones.map((m, i) => ({
          id: `${id}-ms-${i}`, label: m.label, percent: m.percent,
          amount: Math.round(data.contractAmount * m.percent / (totalPct || 100)),
          status: 'pending', dueDate: m.dueDate,
        })),
        tasks: data.tasks.map((t, i) => {
          const catalogTask = taskMap[t.taskId]
          return {
            id: `${id}-pt-${i}`, taskId: t.taskId,
            stage: catalogTask?.stage ?? 'sketch',
            role:  catalogTask?.role  ?? 'architect',
            staffId: t.staffId, price: 0, paymentSplits: [],
            status: 'todo', deadline: t.deadline,
          } satisfies ProjectTask
        }),
        documents: (data.documents ?? []).map((doc, i) => ({
          id: `${id}-doc-${i}`, templateId: doc.templateId,
          name: doc.name, stage: doc.stage, status: 'pending',
        } as ProjectDocument)),
      }

      this.projects.push(project)

      // Persist to server
      await $fetch('/api/projects', { method: 'POST', body: {
        id, name: data.name, client: data.client, location: data.location,
        type: data.type, pmId: data.pmId, contractAmount: data.contractAmount,
        status: 'active', startDate: data.startDate, plannedEndDate: data.plannedEndDate,
        contactPerson: data.contactPerson, contactPhone: data.contactPhone,
        contactEmail: data.contactEmail, createdAt: project.createdAt,
      }}).catch((e: any) => {
        useToast().add({ color: 'error', title: 'Проект не сохранён на сервере', description: e?.message })
      })

      return id
    },

    // ── Set task price (Financier) ────────────────────────────────────────────
    setTaskPrice(projectId: string, taskId: string, price: number, splits: Array<{ label: string; percent: number }>) {
      const project = this.projects.find(p => p.id === projectId)
      if (!project) return
      const task = project.tasks.find(t => t.id === taskId)
      if (!task) return
      task.price = price
      task.paymentSplits = splits.map((sp, i) => ({
        id: `${taskId}-sp-${i}`, label: sp.label, percent: sp.percent,
        amount: Math.round(price * sp.percent / 100), status: 'pending' as PaymentStatus,
      }))
    },

    // ── Mark split paid ───────────────────────────────────────────────────────
    markSplitPaid(projectId: string, taskId: string, splitId: string) {
      const project = this.projects.find(p => p.id === projectId)
      if (!project) return
      const task = project.tasks.find(t => t.id === taskId)
      if (!task) return
      const split = task.paymentSplits.find(sp => sp.id === splitId)
      if (!split || split.status === 'paid') return
      const paidAt = dayjs().format('YYYY-MM-DD')
      split.status = 'paid'
      split.paidAt = paidAt
      const taskMap = Object.fromEntries(this.taskCatalog.map(t => [t.id, t]))
      const newTx: Transaction = {
        id: `tx-${Date.now()}`, projectId, type: 'outflow', amount: split.amount,
        description: `${split.label} — ${taskMap[task.taskId]?.name ?? task.taskId}`,
        date: paidAt, category: 'staff_payment',
        staffId: task.staffId ?? undefined, taskId,
      }
      this.transactions.push(newTx)

      // Sync to server
      $fetch(`/api/splits/${splitId}`, { method: 'PATCH', body: { status: 'paid', paidAt } }).catch((e: any) => {
        useToast().add({ color: 'error', title: 'Не удалось обновить выплату', description: e?.message })
      })
      $fetch('/api/transactions', { method: 'POST', body: newTx }).catch((e: any) => {
        useToast().add({ color: 'error', title: 'Не удалось записать транзакцию', description: e?.message })
      })
    },

    // ── Mark milestone paid ───────────────────────────────────────────────────
    markMilestonePaid(projectId: string, milestoneId: string) {
      const project = this.projects.find(p => p.id === projectId)
      if (!project) return
      const ms = project.clientMilestones.find(m => m.id === milestoneId)
      if (!ms || ms.status === 'paid') return
      const msPaidAt = dayjs().format('YYYY-MM-DD')
      ms.status = 'paid'
      ms.paidAt = msPaidAt
      const msTx: Transaction = {
        id: `tx-${Date.now()}`, projectId, type: 'inflow', amount: ms.amount,
        description: `${ms.label} — ${project.name}`,
        date: msPaidAt, category: 'client_payment', milestoneId,
      }
      this.transactions.push(msTx)

      // Sync to server
      $fetch(`/api/milestones/${milestoneId}`, { method: 'PATCH', body: { status: 'paid', paidAt: msPaidAt } }).catch((e: any) => {
        useToast().add({ color: 'error', title: 'Не удалось обновить транш', description: e?.message })
      })
      $fetch('/api/transactions', { method: 'POST', body: msTx }).catch((e: any) => {
        useToast().add({ color: 'error', title: 'Не удалось записать транзакцию', description: e?.message })
      })
    },

    // ── Update task status ────────────────────────────────────────────────────
    updateTaskStatus(projectId: string, taskId: string, status: ServiceStatus) {
      const project = this.projects.find(p => p.id === projectId)
      if (!project) return
      const task = project.tasks.find(t => t.id === taskId)
      if (task) {
        task.status = status
        $fetch(`/api/tasks/${projectId}/${taskId}`, { method: 'PATCH', body: { status } }).catch((e: any) => {
          useToast().add({ color: 'error', title: 'Не удалось обновить статус задачи', description: e?.message })
        })
      }
    },

    // ── Update task note (staff comment) ─────────────────────────────────────
    updateTaskNote(projectId: string, taskId: string, note: string) {
      const task = this.projects.find(p => p.id === projectId)?.tasks.find(t => t.id === taskId)
      if (task) task.note = note
    },

    // ── Selected project (used by financier pages) ───────────────────────────
    setSelectedProject(id: string | null) {
      this.selectedProjectId = id
    },

    // ── Update project status ─────────────────────────────────────────────────
    updateProjectStatus(projectId: string, status: CrmProject['status']) {
      const project = this.projects.find(p => p.id === projectId)
      if (project) {
        project.status = status
        $fetch(`/api/projects/${projectId}`, { method: 'PUT', body: { status } }).catch((e: any) => {
          useToast().add({ color: 'error', title: 'Не удалось обновить статус проекта', description: e?.message })
        })
      }
    },

    // ── Update project metadata ───────────────────────────────────────────────
    updateProject(projectId: string, changes: Partial<Pick<CrmProject,
      'name' | 'client' | 'location' | 'type' | 'contractAmount' |
      'startDate' | 'plannedEndDate' | 'contactPerson' | 'contactPhone' | 'contactEmail'
    >>) {
      const project = this.projects.find(p => p.id === projectId)
      if (project) {
        Object.assign(project, changes)
        $fetch(`/api/projects/${projectId}`, { method: 'PUT', body: changes }).catch((e: any) => {
          useToast().add({ color: 'error', title: 'Не удалось сохранить изменения проекта', description: e?.message })
        })
      }
    },

    // ── Add task to existing project ──────────────────────────────────────────
    addTaskToProject(projectId: string, data: { taskId: string; staffId?: string | null; deadline?: string }) {
      const project = this.projects.find(p => p.id === projectId)
      if (!project) return null
      const catalogTask = this.taskCatalog.find(t => t.id === data.taskId)
      if (!catalogTask) return null
      const taskId = `${projectId}-pt-${Date.now()}`
      const task: ProjectTask = {
        id: taskId, taskId: data.taskId,
        stage: catalogTask.stage, role: catalogTask.role,
        staffId: data.staffId ?? null, price: 0,
        paymentSplits: [], status: 'todo', deadline: data.deadline,
      }
      project.tasks.push(task)
      $fetch(`/api/tasks/${projectId}`, { method: 'POST', body: { tasks: [task] } }).catch((e: any) => {
        useToast().add({ color: 'error', title: 'Не удалось добавить задачу', description: e?.message })
      })
      return taskId
    },

    // ── Direct staff assignment (no change request) ───────────────────────────
    assignStaffToTask(projectId: string, taskId: string, staffId: string | null) {
      const project = this.projects.find(p => p.id === projectId)
      if (!project) return
      const task = project.tasks.find(t => t.id === taskId)
      if (task) task.staffId = staffId
    },

    // ── Cancel change request ─────────────────────────────────────────────────
    cancelChange(requestId: string) {
      const req = this.changeRequests.find(r => r.id === requestId)
      if (!req || req.status !== 'pending') return
      req.status = 'rejected'
      for (const p of this.projects) {
        const task = p.tasks.find(t => t.id === req.taskId)
        if (task && task.pendingChangeId === requestId) {
          task.pendingChangeId = undefined
        }
      }
    },

    // ── Change requests ───────────────────────────────────────────────────────
    proposeChange(
      projectId: string,
      taskId: string,
      type: 'task_change' | 'price_change',
      reason: string,
      changes: Record<string, { from: unknown; to: unknown }>,
      proposerStaffId: string,
    ) {
      const project = this.projects.find(p => p.id === projectId)
      if (!project) return null
      const task = project.tasks.find(t => t.id === taskId)
      if (!task) return null

      const approvals: ChangeApproval[] = []

      if (type === 'task_change') {
        // Only staff assignee needs to confirm
        if (task.staffId) {
          approvals.push({ role: 'staff', staffId: task.staffId, status: 'pending' })
        }
      } else {
        // price_change: staff + PM + financier all need to confirm
        if (task.staffId) {
          approvals.push({ role: 'staff', staffId: task.staffId, status: 'pending' })
        }
        approvals.push({ role: 'pm', staffId: project.pmId, status: 'pending' })
        // Find financier
        const financier = this.staff.find(s => s.role === 'financier')
        if (financier) approvals.push({ role: 'financier', staffId: financier.id, status: 'pending' })
      }

      const requestId = `cr-${Date.now()}`
      const request: ChangeRequest = {
        id: requestId, projectId, taskId, type, proposedBy: proposerStaffId,
        proposedAt: dayjs().format('YYYY-MM-DD'),
        reason, changes, approvals, status: 'pending',
      }

      this.changeRequests.push(request)
      task.pendingChangeId = requestId
      return requestId
    },

    approveChange(requestId: string, staffId: string, comment?: string) {
      const req = this.changeRequests.find(r => r.id === requestId)
      if (!req || req.status !== 'pending') return

      const approval = req.approvals.find(a => a.staffId === staffId)
      if (!approval || approval.status !== 'pending') return

      approval.status = 'approved'
      approval.date = dayjs().format('YYYY-MM-DD')
      if (comment) approval.comment = comment

      // Check if all approvals are done
      const allApproved = req.approvals.every(a => a.status === 'approved')
      if (allApproved) {
        req.status = 'approved'
        this._applyChange(req)
      }
    },

    rejectChange(requestId: string, staffId: string, comment?: string) {
      const req = this.changeRequests.find(r => r.id === requestId)
      if (!req || req.status !== 'pending') return

      const approval = req.approvals.find(a => a.staffId === staffId)
      if (!approval) return

      approval.status = 'rejected'
      approval.date = dayjs().format('YYYY-MM-DD')
      if (comment) approval.comment = comment

      req.status = 'rejected'
      // Clear pendingChangeId on task
      for (const p of this.projects) {
        const task = p.tasks.find(t => t.id === req.taskId)
        if (task && task.pendingChangeId === requestId) {
          task.pendingChangeId = undefined
        }
      }
    },

    _applyChange(req: ChangeRequest) {
      const project = this.projects.find(p => p.id === req.projectId)
      if (!project) return
      const task = project.tasks.find(t => t.id === req.taskId)
      if (!task) return

      for (const [field, { to }] of Object.entries(req.changes)) {
        if (field === 'price') {
          task.price = to as number
          // Recalculate split amounts
          task.paymentSplits = task.paymentSplits.map(sp => ({
            ...sp,
            amount: Math.round((to as number) * sp.percent / 100),
          }))
        } else if (field in task) {
          (task as Record<string, unknown>)[field] = to
        }
      }

      task.pendingChangeId = undefined
    },
  },

  persist: {
    pick: ['selectedProjectId'],
  },
})
