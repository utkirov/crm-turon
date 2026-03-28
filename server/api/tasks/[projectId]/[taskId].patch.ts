import { useDb } from '~~/server/utils/db'
import { projectTasks } from '~~/server/database/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const taskId = getRouterParam(event, 'taskId')!
  const body   = await readBody(event)
  const db     = useDb()

  const updates: Record<string, unknown> = {}
  const allowed = ['staffId', 'price', 'status', 'deadline', 'note', 'assignedAt', 'pendingChangeId']
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  await db.update(projectTasks).set(updates).where(eq(projectTasks.id, taskId))
  return { ok: true }
})
