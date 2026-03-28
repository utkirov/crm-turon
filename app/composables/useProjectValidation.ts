import { z } from 'zod'
import type { Project, ProjectStage } from '~/types/project'

const documentStatusSchema = z.enum(['pending', 'uploaded', 'approved'])

const stageDocSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: documentStatusSchema,
  uploadedAt: z.string().optional()
})

const checklistItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  done: z.boolean()
})

// Stage-specific validation rules
const STAGE_RULES: Record<number, (stage: Project['stages'][number]) => { ok: boolean; errors: string[] }> = {
  1: (s) => {
    const errors: string[] = []
    const pending = s.checklist.filter(c => !c.done)
    if (pending.length > 0) errors.push(`Не заполнено: ${pending.map(c => c.label).join(', ')}`)
    return { ok: errors.length === 0, errors }
  },
  2: (s) => {
    const errors: string[] = []
    const notUploaded = s.documents.filter(d => d.status === 'pending')
    if (notUploaded.length > 0) errors.push(`Не загружено: ${notUploaded.map(d => d.name).join(', ')}`)
    return { ok: errors.length === 0, errors }
  },
  3: (s) => {
    const errors: string[] = []
    const notApproved = s.documents.filter(d => d.status !== 'approved')
    if (notApproved.length > 0) errors.push(`Не согласовано: ${notApproved.map(d => d.name).join(', ')}`)
    return { ok: errors.length === 0, errors }
  },
  4: (s) => {
    // Gate rule: AR, KZH, Smeta must be uploaded
    const errors: string[] = []
    const required = ['ar_doc', 'kzh_doc', 'smeta_doc']
    const missing = required.filter(id => {
      const doc = s.documents.find(d => d.id === id)
      return !doc || doc.status === 'pending'
    })
    if (missing.length > 0) {
      const names = missing.map(id => {
        const doc = s.documents.find(d => d.id === id)
        return doc?.name ?? id
      })
      errors.push(`Обязательно для Stage 5: загрузите ${names.join(', ')}`)
    }
    return { ok: errors.length === 0, errors }
  },
  5: (s) => {
    const errors: string[] = []
    if (!s.checklist.find(c => c.id === 'mygov')?.done) {
      errors.push('Необходима регистрация на my.gov.uz')
    }
    return { ok: errors.length === 0, errors }
  },
  6: (s) => {
    const errors: string[] = []
    if (!s.checklist.find(c => c.id === 'field_log')?.done) {
      errors.push('Журнал авторского надзора должен быть заполнен')
    }
    return { ok: errors.length === 0, errors }
  },
  7: () => ({ ok: true, errors: [] })
}

export function useProjectValidation() {
  function validateStage(project: Project, currentStage: ProjectStage): { ok: boolean; errors: string[] } {
    const stageData = project.stages.find(s => s.stage === currentStage)
    if (!stageData) return { ok: false, errors: ['Данные стадии не найдены'] }
    const rule = STAGE_RULES[currentStage]
    if (!rule) return { ok: true, errors: [] }
    return rule(stageData)
  }

  function canAdvance(project: Project): { ok: boolean; errors: string[] } {
    return validateStage(project, project.currentStage)
  }

  function stageProgress(project: Project, stageNum: ProjectStage): number {
    const stageData = project.stages.find(s => s.stage === stageNum)
    if (!stageData) return 0
    const total = stageData.checklist.length + stageData.documents.length
    if (total === 0) return 100
    const done = stageData.checklist.filter(c => c.done).length
      + stageData.documents.filter(d => d.status !== 'pending').length
    return Math.round((done / total) * 100)
  }

  return { validateStage, canAdvance, stageProgress }
}
