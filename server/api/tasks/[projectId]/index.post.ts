import { useDb } from '~~/server/utils/db'
import { projectTasks, paymentSplits } from '~~/server/database/schema'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'projectId')!
  const body = await readBody(event)
  const db = useDb()

  // body.tasks: Array<{ taskId, stage, role, staffId?, price?, deadline?, splits? }>
  const created = []
  for (const t of body.tasks ?? []) {
    const taskRow = {
      id:              `pt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      projectId,
      taskId:          t.taskId,
      stage:           t.stage,
      role:            t.role,
      staffId:         t.staffId ?? null,
      price:           t.price ?? 0,
      status:          'todo',
      deadline:        t.deadline ?? null,
      note:            t.note ?? null,
      assignedAt:      t.staffId ? new Date().toISOString().slice(0, 10) : null,
      pendingChangeId: null,
    }
    await db.insert(projectTasks).values(taskRow)

    const splitRows = []
    for (const sp of t.splits ?? []) {
      const splitRow = {
        id:      `sp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        taskId:  taskRow.id,
        label:   sp.label,
        percent: sp.percent,
        amount:  sp.amount,
        status:  'pending',
        paidAt:  null,
      }
      await db.insert(paymentSplits).values(splitRow)
      splitRows.push(splitRow)
    }
    created.push({ ...taskRow, paymentSplits: splitRows })
  }

  return created
})
