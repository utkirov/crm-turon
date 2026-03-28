import { useDb } from '~~/server/utils/db'
import { transactions } from '~~/server/database/schema'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const db = useDb()

  const tx = {
    id:          `tx-${Date.now()}`,
    projectId:   body.projectId,
    type:        body.type,
    amount:      body.amount,
    description: body.description,
    date:        body.date ?? new Date().toISOString().slice(0, 10),
    category:    body.category,
    staffId:     body.staffId ?? null,
    milestoneId: body.milestoneId ?? null,
    taskId:      body.taskId ?? null,
  }

  await db.insert(transactions).values(tx)
  return tx
})
