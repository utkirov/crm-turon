import { useDb } from '~~/server/utils/db'
import { staff } from '~~/server/database/schema'

export default defineEventHandler(async () => {
  const db = useDb()
  return db.select().from(staff)
})
