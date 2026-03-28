import { useDb } from '~~/server/utils/db'
import { transactions } from '~~/server/database/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const projectId = getQuery(event).projectId as string | undefined
  const db = useDb()

  if (projectId) {
    return db.select().from(transactions).where(eq(transactions.projectId, projectId))
  }
  return db.select().from(transactions)
})
