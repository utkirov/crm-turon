import { useDb } from '~~/server/utils/db'
import { projects, clientMilestones, projectTasks, paymentSplits, projectDocuments } from '~~/server/database/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const db = useDb()

  const [project] = await db.select().from(projects).where(eq(projects.id, id))
  if (!project) throw createError({ statusCode: 404, message: 'Project not found' })

  const [mss, tasks, docs] = await Promise.all([
    db.select().from(clientMilestones).where(eq(clientMilestones.projectId, id)),
    db.select().from(projectTasks).where(eq(projectTasks.projectId, id)),
    db.select().from(projectDocuments).where(eq(projectDocuments.projectId, id)),
  ])
  const splits = await db.select().from(paymentSplits)

  return {
    ...project,
    clientMilestones: mss,
    tasks: tasks.map(t => ({
      ...t,
      paymentSplits: splits.filter(s => s.taskId === t.id),
    })),
    documents: docs,
  }
})
