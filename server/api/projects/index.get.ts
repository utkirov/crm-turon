import { useDb } from '~~/server/utils/db'
import { projects, clientMilestones, projectTasks, paymentSplits, projectDocuments } from '~~/server/database/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async () => {
  const db = useDb()

  const allProjects    = await db.select().from(projects)
  const allMilestones  = await db.select().from(clientMilestones)
  const allTasks       = await db.select().from(projectTasks)
  const allSplits      = await db.select().from(paymentSplits)
  const allDocs        = await db.select().from(projectDocuments)

  return allProjects.map(p => ({
    ...p,
    clientMilestones: allMilestones.filter(m => m.projectId === p.id),
    tasks: allTasks
      .filter(t => t.projectId === p.id)
      .map(t => ({
        ...t,
        paymentSplits: allSplits.filter(s => s.taskId === t.id),
      })),
    documents: allDocs.filter(d => d.projectId === p.id),
  }))
})
