import { useDb } from '~~/server/utils/db'
import { projectDocuments } from '~~/server/database/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const docId = getRouterParam(event, 'docId')!
  const body  = await readBody(event)
  const db    = useDb()

  const updates: Record<string, unknown> = {}
  const allowed = ['status', 'receivedDate', 'pendingReason']
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  await db.update(projectDocuments).set(updates).where(eq(projectDocuments.id, docId))
  return { ok: true }
})
