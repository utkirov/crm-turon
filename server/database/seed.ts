import type { Database } from 'better-sqlite3'

export function seedDatabase(sqlite: Database) {
  const countRow = sqlite.prepare('SELECT COUNT(*) as c FROM staff').get() as { c: number }
  if (countRow.c > 0) return // already seeded

  // ── Staff ────────────────────────────────────────────────────────────────
  const insertStaff = sqlite.prepare(`
    INSERT INTO staff (id, name, role, specialization, position, initials)
    VALUES (@id, @name, @role, @specialization, @position, @initials)
  `)
  const staffRows = [
    { id: 'akbar',   name: 'Акбар Юсупов',    role: 'ceo',       specialization: 'Директор',               position: 'Директор',  initials: 'АЮ' },
    { id: 'dilshod', name: 'Дильшод Рашидов', role: 'pm',        specialization: 'Главный архитектор (ГИП)', position: 'ГИП',       initials: 'ДР' },
    { id: 'malika',  name: 'Малика Каримова',  role: 'financier', specialization: 'Финансист',               position: 'Финансист', initials: 'МК' },
    { id: 'ivan',    name: 'Иван Петров',      role: 'staff',     specialization: 'Архитектор (ГАП)',        position: 'ГАП',       initials: 'ИП' },
    { id: 'aziz',    name: 'Азиз Каримов',     role: 'staff',     specialization: 'Конструктор',             position: 'ГКП',       initials: 'АК' },
  ]
  for (const s of staffRows) insertStaff.run(s)

  // ── Projects ─────────────────────────────────────────────────────────────
  const insertProject = sqlite.prepare(`
    INSERT INTO projects (id, name, client, location, type, pm_id, contract_amount, status,
      contact_person, contact_phone, contact_email, start_date, planned_end_date, created_at)
    VALUES (@id, @name, @client, @location, @type, @pmId, @contractAmount, @status,
      @contactPerson, @contactPhone, @contactEmail, @startDate, @plannedEndDate, @createdAt)
  `)
  insertProject.run({
    id: 'proj-001', name: 'ЖК «Нур Сити»', client: 'ООО «Turon Build»',
    location: 'Ташкент, Юнусабадский р-н', type: 'residential', pmId: 'dilshod',
    contractAmount: 450_000_000, status: 'active',
    contactPerson: 'Бобур Хасанов', contactPhone: '+998 90 123-45-67',
    contactEmail: 'b.hasanov@turonbuild.uz', startDate: '2026-01-10',
    plannedEndDate: '2026-06-01', createdAt: '2026-01-10',
  })
  insertProject.run({
    id: 'proj-002', name: 'БЦ «Silk Road»', client: 'АО «Silk Invest»',
    location: 'Ташкент, Мирзо-Улугбекский р-н', type: 'commercial', pmId: 'dilshod',
    contractAmount: 280_000_000, status: 'active',
    contactPerson: 'Нилуфар Джалилова', contactPhone: '+998 93 456-78-90',
    contactEmail: 'n.jalilova@silkinvest.uz', startDate: '2026-02-05',
    plannedEndDate: '2026-07-01', createdAt: '2026-02-05',
  })

  // ── Client milestones ────────────────────────────────────────────────────
  const insertMs = sqlite.prepare(`
    INSERT INTO client_milestones (id, project_id, label, percent, amount, status, due_date, paid_at)
    VALUES (@id, @projectId, @label, @percent, @amount, @status, @dueDate, @paidAt)
  `)
  const milestones = [
    { id: 'ms-001-1', projectId: 'proj-001', label: 'Аванс (30%)',     percent: 30, amount: 135_000_000, status: 'paid',    dueDate: '2026-01-20', paidAt: '2026-01-18' },
    { id: 'ms-001-2', projectId: 'proj-001', label: 'Сдача ЭП (40%)',  percent: 40, amount: 180_000_000, status: 'pending', dueDate: '2026-03-01', paidAt: null },
    { id: 'ms-001-3', projectId: 'proj-001', label: 'Финальный (30%)', percent: 30, amount: 135_000_000, status: 'pending', dueDate: '2026-05-01', paidAt: null },
    { id: 'ms-002-1', projectId: 'proj-002', label: 'Аванс (30%)',     percent: 30, amount: 84_000_000,  status: 'paid',    dueDate: '2026-02-10', paidAt: '2026-02-08' },
    { id: 'ms-002-2', projectId: 'proj-002', label: 'Финальный (70%)', percent: 70, amount: 196_000_000, status: 'pending', dueDate: '2026-05-15', paidAt: null },
  ]
  for (const m of milestones) insertMs.run(m)

  // ── Project tasks ────────────────────────────────────────────────────────
  const insertTask = sqlite.prepare(`
    INSERT INTO project_tasks (id, project_id, task_id, stage, role, staff_id, price, status, deadline, note, assigned_at)
    VALUES (@id, @projectId, @taskId, @stage, @role, @staffId, @price, @status, @deadline, @note, @assignedAt)
  `)
  const tasks = [
    { id: 'pt-001-1', projectId: 'proj-001', taskId: 'task-ep-arch-plans',   stage: 'sketch',  role: 'architect', staffId: 'ivan', price: 5_000_000,  status: 'done',        deadline: '2026-02-15', note: null, assignedAt: '2026-01-10' },
    { id: 'pt-001-2', projectId: 'proj-001', taskId: 'task-ep-arch-gp',      stage: 'sketch',  role: 'architect', staffId: 'ivan', price: 4_000_000,  status: 'in_progress', deadline: '2026-02-28', note: null, assignedAt: '2026-01-10' },
    { id: 'pt-001-3', projectId: 'proj-001', taskId: 'task-ep-arch-planshet',stage: 'sketch',  role: 'architect', staffId: 'ivan', price: 0,          status: 'todo',        deadline: '2026-03-10', note: null, assignedAt: null },
    { id: 'pt-001-4', projectId: 'proj-001', taskId: 'task-rp-eng-kzh',      stage: 'working', role: 'engineer',  staffId: 'aziz', price: 10_000_000, status: 'todo',        deadline: '2026-04-15', note: null, assignedAt: null },
    { id: 'pt-002-1', projectId: 'proj-002', taskId: 'task-ep-des-3d',       stage: 'sketch',  role: 'designer',  staffId: 'ivan', price: 15_000_000, status: 'in_progress', deadline: '2026-03-20', note: null, assignedAt: '2026-02-05' },
    { id: 'pt-002-2', projectId: 'proj-002', taskId: 'task-ep-des-facade',   stage: 'sketch',  role: 'designer',  staffId: 'ivan', price: 0,          status: 'todo',        deadline: '2026-04-01', note: null, assignedAt: null },
  ]
  for (const t of tasks) insertTask.run(t)

  // ── Payment splits ───────────────────────────────────────────────────────
  const insertSplit = sqlite.prepare(`
    INSERT INTO payment_splits (id, task_id, label, percent, amount, status, paid_at)
    VALUES (@id, @taskId, @label, @percent, @amount, @status, @paidAt)
  `)
  const splits = [
    { id: 'sp-001-1-1', taskId: 'pt-001-1', label: 'Аванс',         percent: 30, amount: 1_500_000, status: 'paid',    paidAt: '2026-01-19' },
    { id: 'sp-001-1-2', taskId: 'pt-001-1', label: 'Промежуточный', percent: 40, amount: 2_000_000, status: 'paid',    paidAt: '2026-02-10' },
    { id: 'sp-001-1-3', taskId: 'pt-001-1', label: 'Финальный',     percent: 30, amount: 1_500_000, status: 'pending', paidAt: null },
    { id: 'sp-001-2-1', taskId: 'pt-001-2', label: 'Аванс',         percent: 30, amount: 1_200_000, status: 'paid',    paidAt: '2026-01-19' },
    { id: 'sp-001-2-2', taskId: 'pt-001-2', label: 'Промежуточный', percent: 40, amount: 1_600_000, status: 'pending', paidAt: null },
    { id: 'sp-001-2-3', taskId: 'pt-001-2', label: 'Финальный',     percent: 30, amount: 1_200_000, status: 'pending', paidAt: null },
    { id: 'sp-001-4-1', taskId: 'pt-001-4', label: 'Аванс',         percent: 30, amount: 3_000_000, status: 'pending', paidAt: null },
    { id: 'sp-001-4-2', taskId: 'pt-001-4', label: 'Промежуточный', percent: 40, amount: 4_000_000, status: 'pending', paidAt: null },
    { id: 'sp-001-4-3', taskId: 'pt-001-4', label: 'Финальный',     percent: 30, amount: 3_000_000, status: 'pending', paidAt: null },
    { id: 'sp-002-1-1', taskId: 'pt-002-1', label: 'Аванс',         percent: 50, amount: 7_500_000, status: 'paid',    paidAt: '2026-02-09' },
    { id: 'sp-002-1-2', taskId: 'pt-002-1', label: 'Финальный',     percent: 50, amount: 7_500_000, status: 'pending', paidAt: null },
  ]
  for (const s of splits) insertSplit.run(s)

  // ── Project documents ────────────────────────────────────────────────────
  const insertDoc = sqlite.prepare(`
    INSERT INTO project_documents (id, project_id, template_id, name, stage, status, received_date, pending_reason)
    VALUES (@id, @projectId, @templateId, @name, @stage, @status, @receivedDate, @pendingReason)
  `)
  const docs = [
    { id: 'pd-001-1', projectId: 'proj-001', templateId: 'doc-sketch-1', name: 'ТЗ на проектирование',  stage: 'sketch', status: 'received', receivedDate: '2026-01-12', pendingReason: null },
    { id: 'pd-001-2', projectId: 'proj-001', templateId: 'doc-sketch-2', name: 'Топографическая съёмка', stage: 'sketch', status: 'pending',  receivedDate: null, pendingReason: 'Заказчик задерживает предоставление' },
    { id: 'pd-001-3', projectId: 'proj-001', templateId: 'doc-sketch-3', name: 'Геологический отчёт',   stage: 'sketch', status: 'pending',  receivedDate: null, pendingReason: null },
    { id: 'pd-002-1', projectId: 'proj-002', templateId: 'doc-sketch-1', name: 'ТЗ на проектирование',  stage: 'sketch', status: 'received', receivedDate: '2026-02-06', pendingReason: null },
    { id: 'pd-002-2', projectId: 'proj-002', templateId: 'doc-sketch-4', name: 'Свидетельство на землю', stage: 'sketch', status: 'pending',  receivedDate: null, pendingReason: null },
  ]
  for (const d of docs) insertDoc.run(d)

  // ── Transactions ─────────────────────────────────────────────────────────
  const insertTx = sqlite.prepare(`
    INSERT INTO transactions (id, project_id, type, amount, description, date, category, staff_id, milestone_id, task_id)
    VALUES (@id, @projectId, @type, @amount, @description, @date, @category, @staffId, @milestoneId, @taskId)
  `)
  const transactions = [
    { id: 'tx-001', projectId: 'proj-001', type: 'inflow',  amount: 135_000_000, description: 'Аванс от клиента (30%)',        date: '2026-01-18', category: 'client_payment', staffId: null,   milestoneId: 'ms-001-1', taskId: null },
    { id: 'tx-002', projectId: 'proj-002', type: 'inflow',  amount: 84_000_000,  description: 'Аванс от клиента (30%)',        date: '2026-02-08', category: 'client_payment', staffId: null,   milestoneId: 'ms-002-1', taskId: null },
    { id: 'tx-003', projectId: 'proj-001', type: 'outflow', amount: 1_500_000,   description: 'Аванс Ивану — Планировки',      date: '2026-01-19', category: 'staff_payment',  staffId: 'ivan', milestoneId: null, taskId: 'pt-001-1' },
    { id: 'tx-004', projectId: 'proj-001', type: 'outflow', amount: 2_000_000,   description: 'Промеж. Ивану — Планировки',    date: '2026-02-10', category: 'staff_payment',  staffId: 'ivan', milestoneId: null, taskId: 'pt-001-1' },
    { id: 'tx-005', projectId: 'proj-001', type: 'outflow', amount: 1_200_000,   description: 'Аванс Ивану — Ген. план',       date: '2026-01-19', category: 'staff_payment',  staffId: 'ivan', milestoneId: null, taskId: 'pt-001-2' },
    { id: 'tx-006', projectId: 'proj-002', type: 'outflow', amount: 7_500_000,   description: 'Аванс Ивану — 3D-визуализация', date: '2026-02-09', category: 'staff_payment',  staffId: 'ivan', milestoneId: null, taskId: 'pt-002-1' },
  ]
  for (const tx of transactions) insertTx.run(tx)
}
