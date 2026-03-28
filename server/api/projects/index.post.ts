import { useDb } from '~~/server/utils/db'
import { projects } from '~~/server/database/schema'

const VALID_TYPES = ['residential', 'commercial', 'industrial', 'infrastructure', 'interior'] as const
const VALID_STATUSES = ['active', 'on_hold', 'completed', 'cancelled'] as const

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const db = useDb()

  // Validate required fields
  if (!body.name || typeof body.name !== 'string' || body.name.trim().length < 2) {
    throw createError({ statusCode: 400, message: 'Поле "name" обязательно (минимум 2 символа)' })
  }
  if (!body.client || typeof body.client !== 'string' || body.client.trim().length < 2) {
    throw createError({ statusCode: 400, message: 'Поле "client" обязательно' })
  }
  const amount = Number(body.contractAmount)
  if (!isFinite(amount) || amount < 0) {
    throw createError({ statusCode: 400, message: 'contractAmount должен быть неотрицательным числом' })
  }
  if (body.type && !VALID_TYPES.includes(body.type)) {
    throw createError({ statusCode: 400, message: `Недопустимый тип проекта: ${body.type}` })
  }
  if (body.status && !VALID_STATUSES.includes(body.status)) {
    throw createError({ statusCode: 400, message: `Недопустимый статус: ${body.status}` })
  }

  const id = body.id ?? `proj-${Date.now()}`
  const newProject = {
    id,
    name:           body.name.trim(),
    client:         body.client.trim(),
    location:       body.location ?? null,
    type:           body.type ?? 'residential',
    pmId:           body.pmId ?? null,
    contractAmount: amount,
    status:         body.status ?? 'active',
    contactPerson:  body.contactPerson ?? null,
    contactPhone:   body.contactPhone ?? null,
    contactEmail:   body.contactEmail ?? null,
    startDate:      body.startDate ?? null,
    plannedEndDate: body.plannedEndDate ?? null,
    createdAt:      body.createdAt ?? new Date().toISOString().slice(0, 10),
  }

  await db.insert(projects).values(newProject)
  return { ...newProject, clientMilestones: [], tasks: [], documents: [] }
})
