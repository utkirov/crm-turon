import { useDb } from '~~/server/utils/db'
import { clientMilestones } from '~~/server/database/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const milestoneId = getRouterParam(event, 'milestoneId')!
  const body        = await readBody(event)
  const db          = useDb()

  const updates: Record<string, unknown> = {}
  if ('status' in body) updates.status = body.status
  if ('paidAt' in body) updates.paidAt = body.paidAt

  await db.update(clientMilestones).set(updates).where(eq(clientMilestones.id, milestoneId))
  return { ok: true }
})
