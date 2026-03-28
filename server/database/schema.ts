import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

// ─── Staff (seed data, not modified via UI) ────────────────────────────────
export const staff = sqliteTable('staff', {
  id:             text('id').primaryKey(),
  name:           text('name').notNull(),
  role:           text('role').notNull(),           // ceo | pm | financier | staff
  specialization: text('specialization').notNull(),
  position:       text('position').notNull(),
  initials:       text('initials').notNull(),
})

// ─── Projects ──────────────────────────────────────────────────────────────
export const projects = sqliteTable('projects', {
  id:             text('id').primaryKey(),
  name:           text('name').notNull(),
  client:         text('client').notNull(),
  location:       text('location').notNull(),
  type:           text('type').notNull(),            // residential | commercial | education | infrastructure
  pmId:           text('pm_id').notNull().references(() => staff.id),
  contractAmount: real('contract_amount').notNull().default(0),
  status:         text('status').notNull().default('active'), // active | completed | on_hold
  contactPerson:  text('contact_person'),
  contactPhone:   text('contact_phone'),
  contactEmail:   text('contact_email'),
  startDate:      text('start_date'),
  plannedEndDate: text('planned_end_date'),
  createdAt:      text('created_at').notNull(),
})

// ─── Client milestones ─────────────────────────────────────────────────────
export const clientMilestones = sqliteTable('client_milestones', {
  id:        text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  label:     text('label').notNull(),
  percent:   real('percent').notNull(),
  amount:    real('amount').notNull(),
  status:    text('status').notNull().default('pending'), // pending | partial | paid
  dueDate:   text('due_date'),
  paidAt:    text('paid_at'),
})

// ─── Project tasks ─────────────────────────────────────────────────────────
export const projectTasks = sqliteTable('project_tasks', {
  id:              text('id').primaryKey(),
  projectId:       text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  taskId:          text('task_id').notNull(),         // ref to catalog
  stage:           text('stage').notNull(),            // sketch | working | expertise | construction
  role:            text('role').notNull(),             // architect | designer | engineer | constructor | surveyor
  staffId:         text('staff_id').references(() => staff.id),
  price:           real('price').notNull().default(0),
  status:          text('status').notNull().default('todo'), // todo | in_progress | done
  deadline:        text('deadline'),
  note:            text('note'),
  assignedAt:      text('assigned_at'),
  pendingChangeId: text('pending_change_id'),
})

// ─── Payment splits ────────────────────────────────────────────────────────
export const paymentSplits = sqliteTable('payment_splits', {
  id:       text('id').primaryKey(),
  taskId:   text('task_id').notNull().references(() => projectTasks.id, { onDelete: 'cascade' }),
  label:    text('label').notNull(),
  percent:  real('percent').notNull(),
  amount:   real('amount').notNull(),
  status:   text('status').notNull().default('pending'), // pending | partial | paid
  paidAt:   text('paid_at'),
})

// ─── Project documents ─────────────────────────────────────────────────────
export const projectDocuments = sqliteTable('project_documents', {
  id:            text('id').primaryKey(),
  projectId:     text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  templateId:    text('template_id').notNull(),
  name:          text('name').notNull(),
  stage:         text('stage').notNull(),
  status:        text('status').notNull().default('pending'), // pending | received | na
  receivedDate:  text('received_date'),
  pendingReason: text('pending_reason'),
})

// ─── Change requests ───────────────────────────────────────────────────────
export const changeRequests = sqliteTable('change_requests', {
  id:          text('id').primaryKey(),
  projectId:   text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  taskId:      text('task_id').notNull(),
  type:        text('type').notNull(),           // task_change | price_change
  proposedBy:  text('proposed_by').notNull(),
  proposedAt:  text('proposed_at').notNull(),
  reason:      text('reason').notNull(),
  changesJson: text('changes_json').notNull(),   // JSON blob for Record<string,{from,to}>
  status:      text('status').notNull().default('pending'), // pending | approved | rejected
})

// ─── Change approvals ──────────────────────────────────────────────────────
export const changeApprovals = sqliteTable('change_approvals', {
  id:        text('id').primaryKey(),
  requestId: text('request_id').notNull().references(() => changeRequests.id, { onDelete: 'cascade' }),
  role:      text('role').notNull(),            // staff | pm | financier
  staffId:   text('staff_id').notNull(),
  status:    text('status').notNull().default('pending'), // pending | approved | rejected
  date:      text('date'),
  comment:   text('comment'),
})

// ─── Transactions ──────────────────────────────────────────────────────────
export const transactions = sqliteTable('transactions', {
  id:          text('id').primaryKey(),
  projectId:   text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  type:        text('type').notNull(),           // inflow | outflow
  amount:      real('amount').notNull(),
  description: text('description').notNull(),
  date:        text('date').notNull(),
  category:    text('category').notNull(),       // client_payment | staff_payment | expense
  staffId:     text('staff_id').references(() => staff.id),
  milestoneId: text('milestone_id'),
  taskId:      text('task_id'),
})
