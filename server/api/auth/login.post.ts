import { useDb } from '~~/server/utils/db'
import { staff } from '~~/server/database/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { staffId } = await readBody<{ staffId: string }>(event)

  const db = useDb()
  const [member] = await db.select().from(staff).where(eq(staff.id, staffId))
  if (!member) throw createError({ statusCode: 401, message: 'Staff member not found' })

  const session = await useSession(event, { password: useRuntimeConfig().sessionSecret })
  await session.update({ staffId })

  return { ok: true, staffId }
})
