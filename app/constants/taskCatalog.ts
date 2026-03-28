import type { CatalogTask, DesignStage, StageRole } from '~/types/crm'

// ─── Task catalog (3-level: Stage → Role → Tasks) ────────────────────────────

export const TASK_CATALOG: CatalogTask[] = [
  // ── Эскизный проект (ЭП) ─────────────────────────────────────────────────
  { id: 'task-ep-arch-plans',    name: 'Разработка планировочных решений', stage: 'sketch',       role: 'architect' },
  { id: 'task-ep-arch-gp',       name: 'Разработка генерального плана',    stage: 'sketch',       role: 'architect' },
  { id: 'task-ep-arch-posadka',  name: 'Посадка здания на территорию',     stage: 'sketch',       role: 'architect' },
  { id: 'task-ep-arch-planshet', name: 'Презентационные планшеты',         stage: 'sketch',       role: 'architect' },
  { id: 'task-ep-des-3d',        name: '3D-визуализация',                  stage: 'sketch',       role: 'designer'  },
  { id: 'task-ep-des-facade',    name: 'Концепция фасадов',                stage: 'sketch',       role: 'designer'  },
  { id: 'task-ep-des-material',  name: 'Подбор материалов',                stage: 'sketch',       role: 'designer'  },

  // ── Рабочий проект (РП) ──────────────────────────────────────────────────
  { id: 'task-rp-arch-ar',       name: 'АР (Архитектурные решения)',       stage: 'working',      role: 'architect' },
  { id: 'task-rp-arch-razkaz',   name: 'Разрезы и фасады РП',             stage: 'working',      role: 'architect' },
  { id: 'task-rp-eng-kzh',       name: 'КЖ (ж/б конструкции)',            stage: 'working',      role: 'engineer'  },
  { id: 'task-rp-eng-vk',        name: 'ВК (водоснабжение и канализация)', stage: 'working',      role: 'engineer'  },
  { id: 'task-rp-eng-eo',        name: 'ЭО (электрооборудование)',         stage: 'working',      role: 'engineer'  },
  { id: 'task-rp-eng-ov',        name: 'ОВ (отопление и вентиляция)',      stage: 'working',      role: 'engineer'  },

  // ── Экспертиза ───────────────────────────────────────────────────────────
  { id: 'task-exp-arch-docs',    name: 'Подготовка документации на экспертизу', stage: 'expertise', role: 'architect' },
  { id: 'task-exp-surv-state',   name: 'Гос. экспертиза проекта',          stage: 'expertise',    role: 'surveyor'  },

  // ── Начало строительства ─────────────────────────────────────────────────
  { id: 'task-con-arch-passport',name: 'Строительный паспорт',             stage: 'construction', role: 'architect' },
  { id: 'task-con-arch-nadzor',  name: 'Авторский надзор',                 stage: 'construction', role: 'architect' },
]

export const TASK_MAP = Object.fromEntries(
  TASK_CATALOG.map(t => [t.id, t])
) as Record<string, CatalogTask>

// ─── Labels & icons ───────────────────────────────────────────────────────────

export const STAGE_LABELS: Record<DesignStage, string> = {
  sketch:       'Эскизный проект (ЭП)',
  working:      'Рабочий проект (РП)',
  expertise:    'Экспертиза',
  construction: 'Начало строительства',
}

export const STAGE_SHORT_LABELS: Record<DesignStage, string> = {
  sketch:       'Эскизный проект',
  working:      'Рабочий проект',
  expertise:    'Экспертиза',
  construction: 'Строительство',
}

export const STAGE_ICONS: Record<DesignStage, string> = {
  sketch:       'i-ph-pencil-ruler',
  working:      'i-ph-compass',
  expertise:    'i-ph-buildings',
  construction: 'i-ph-hard-hat',
}

export const ROLE_LABELS: Record<StageRole, string> = {
  architect:   'Архитектор',
  designer:    'Дизайнер',
  engineer:    'Инженер',
  constructor: 'Конструктор',
  surveyor:    'Эксперт/Инспектор',
}

export const ROLE_ICONS: Record<StageRole, string> = {
  architect:   'i-ph-compass',
  designer:    'i-ph-palette',
  engineer:    'i-ph-gear',
  constructor: 'i-ph-wrench',
  surveyor:    'i-ph-clipboard-text',
}

export const STAGES: DesignStage[] = ['sketch', 'working', 'expertise', 'construction']

// Tasks grouped by stage then role — useful for the wizard UI
export function getTasksByStageAndRole(stage: DesignStage): Map<StageRole, CatalogTask[]> {
  const map = new Map<StageRole, CatalogTask[]>()
  for (const task of TASK_CATALOG) {
    if (task.stage !== stage) continue
    if (!map.has(task.role)) map.set(task.role, [])
    map.get(task.role)!.push(task)
  }
  return map
}

// Roles present in a given stage
export function getRolesForStage(stage: DesignStage): StageRole[] {
  const roles = new Set<StageRole>()
  for (const task of TASK_CATALOG) {
    if (task.stage === stage) roles.add(task.role)
  }
  return Array.from(roles)
}
