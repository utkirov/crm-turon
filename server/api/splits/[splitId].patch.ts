import { useDb } from '~~/server/utils/db'
import { paymentSplits } from '~~/server/database/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const splitId = getRouterParam(event, 'splitId')!
  const body    = await readBody(event)
  const db      = useDb()

  const updates: Record<string, unknown> = {}
  if ('status' in body) updates.status = body.status
  if ('paidAt' in body) updates.paidAt = body.paidAt

  await db.update(paymentSplits).set(updates).where(eq(paymentSplits.id, splitId))
  return { ok: true }
})
