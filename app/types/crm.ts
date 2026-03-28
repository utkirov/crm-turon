export type Role = 'ceo' | 'pm' | 'financier' | 'staff'

// 4 design lifecycle stages
export type DesignStage = 'sketch' | 'working' | 'expertise' | 'construction'

// Specialist roles within a stage
export type StageRole = 'architect' | 'designer' | 'engineer' | 'constructor' | 'surveyor'

export type ProjectType = 'residential' | 'commercial' | 'education' | 'infrastructure'

export type PaymentStatus = 'pending' | 'partial' | 'paid'

export type ProjectStatus = 'active' | 'completed' | 'on_hold'

export type ServiceStatus = 'todo' | 'in_progress' | 'done'

export type TransactionType = 'inflow' | 'outflow'

export type TransactionCategory = 'client_payment' | 'staff_payment' | 'expense'

export type DocumentStatus = 'pending' | 'received' | 'na'

// ─── Catalog task (no fixed price — financier sets dynamically) ───────────────

export interface CatalogTask {
  id: string
  name: string
  stage: DesignStage
  role: StageRole
  defaultDays?: number   // typical duration in days (used as default deadline in create wizard)
}

// ─── Document template (catalog of required source docs per stage) ────────────

export interface DocumentTemplate {
  id: string
  name: string
  stage: DesignStage
}

// ─── Document instance in a project ──────────────────────────────────────────

export interface ProjectDocument {
  id: string
  templateId: string
  name: string
  stage: DesignStage
  status: DocumentStatus
  receivedDate?: string
  pendingReason?: string  // explanation when status=pending and date unknown
}

// ─── Staff ────────────────────────────────────────────────────────────────────

export interface StaffMember {
  id: string
  name: string
  role: Role
  specialization: string   // descriptive: 'Архитектор (ГАП)'
  position: string         // short title: 'ГАП', 'ГИП', 'ГКП', 'Директор', etc.
  initials: string
}

// ─── Payment splits (variable count: 2–5) ────────────────────────────────────

export interface PaymentSplit {
  id: string
  label: string
  percent: number
  amount: number    // price * percent / 100
  status: PaymentStatus
  paidAt?: string
}

// ─── Change request (task edit / price change requiring approvals) ────────────

export interface ChangeApproval {
  role: 'staff' | 'pm' | 'financier'
  staffId: string
  status: 'pending' | 'approved' | 'rejected'
  date?: string
  comment?: string
}

export interface ChangeRequest {
  id: string
  projectId: string
  taskId: string
  type: 'task_change' | 'price_change'
  proposedBy: string        // staffId of the proposer
  proposedAt: string        // ISO date string
  reason: string
  changes: Record<string, { from: unknown; to: unknown }>
  approvals: ChangeApproval[]
  status: 'pending' | 'approved' | 'rejected'
}

// ─── Project task (one task instance in a project) ────────────────────────────

export interface ProjectTask {
  id: string
  taskId: string           // ref to CatalogTask.id
  stage: DesignStage
  role: StageRole
  staffId: string | null
  price: number            // set by financier (0 = not yet priced)
  paymentSplits: PaymentSplit[]
  status: ServiceStatus
  deadline?: string
  pendingChangeId?: string // open ChangeRequest.id for this task
  note?: string            // staff comment/note on this task
  assignedAt?: string      // ISO date when staff was assigned
}

// ─── Client-side payments ─────────────────────────────────────────────────────

export interface ClientMilestone {
  id: string
  label: string
  percent: number
  amount: number
  status: PaymentStatus
  dueDate?: string
  paidAt?: string
}

// ─── Project ──────────────────────────────────────────────────────────────────

export interface CrmProject {
  id: string
  name: string
  client: string
  location: string
  type: ProjectType
  pmId: string
  contractAmount: number
  tasks: ProjectTask[]
  clientMilestones: ClientMilestone[]
  documents: ProjectDocument[]
  createdAt: string
  status: ProjectStatus
  contactPerson?: string
  contactPhone?: string
  contactEmail?: string
  startDate?: string
  plannedEndDate?: string
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export interface Transaction {
  id: string
  projectId: string
  type: TransactionType
  amount: number
  description: string
  date: string
  category: TransactionCategory
  staffId?: string
  milestoneId?: string
  taskId?: string
}

// ─── Computed aggregates ──────────────────────────────────────────────────────

export interface ProjectFinancials {
  contractAmount: number
  totalInflow: number
  totalOutflow: number
  balance: number
  paidPercent: number
}

export interface StaffEarningEntry {
  projectId: string
  projectName: string
  taskId: string
  taskName: string
  stage: DesignStage
  role: StageRole
  price: number
  earned: number
  pending: number
  splits: PaymentSplit[]
}

export interface CompanyHealth {
  totalRevenue: number
  totalExpenses: number
  totalProfit: number
  activeProjects: number
  totalContracts: number
}
