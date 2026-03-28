import { useDb } from '~~/server/utils/db'
import { projects } from '~~/server/database/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id   = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const db   = useDb()

  const updates: Record<string, unknown> = {}
  const allowed = ['name', 'client', 'location', 'type', 'pmId', 'contractAmount',
                   'status', 'contactPerson', 'contactPhone', 'contactEmail',
                   'startDate', 'plannedEndDate']
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  await db.update(projects).set(updates).where(eq(projects.id, id))
  return { ok: true }
})
