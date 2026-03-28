import { useDb } from '~~/server/utils/db'
import { staff } from '~~/server/database/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await useSession(event, { password: useRuntimeConfig().sessionSecret })
  const staffId = session.data?.staffId as string | undefined
  if (!staffId) return null

  const db = useDb()
  const [member] = await db.select().from(staff).where(eq(staff.id, staffId))
  return member ?? null
})
