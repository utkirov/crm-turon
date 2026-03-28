import { defineStore } from 'pinia'
import type { Project, ProjectStage, DocumentStatus } from '~/types/project'

function makeStages(): import('~/types/project').StageData[] {
  return [
    {
      stage: 1,
      checklist: [
        { id: 'cadastre', label: 'Кадастровый документ', done: false },
        { id: 'apz', label: 'АПЗ (архитектурно-планировочное задание)', done: false },
        { id: 'tech', label: 'Технические условия', done: false },
        { id: 'topo', label: 'Топографическая съёмка', done: false },
        { id: 'geology', label: 'Геологические изыскания', done: false },
        { id: 'ecology', label: 'Экологическое заключение', done: false }
      ],
      documents: [
        { id: 'cadastre_doc', name: 'Кадастровый паспорт', status: 'pending' },
        { id: 'apz_doc', name: 'АПЗ', status: 'pending' },
        { id: 'tech_conditions', name: 'Тех. условия', status: 'pending' }
      ]
    },
    {
      stage: 2,
      checklist: [
        { id: 'layouts', label: 'Планировочные решения', done: false },
        { id: '3d', label: '3D визуализация', done: false },
        { id: 'board', label: 'Презентационный планшет', done: false }
      ],
      documents: [
        { id: 'layout_doc', name: 'Планировки (PDF)', status: 'pending' },
        { id: '3d_doc', name: '3D рендеры', status: 'pending' },
        { id: 'board_doc', name: 'Планшет А1', status: 'pending' }
      ]
    },
    {
      stage: 3,
      checklist: [
        { id: 'ses', label: 'СЭС (Санитарно-эпидемиологическая служба)', done: false },
        { id: 'fire', label: 'Пожарная инспекция', done: false },
        { id: 'ecology_appr', label: 'Экологический комитет', done: false },
        { id: 'soviet', label: 'Городской Совет', done: false }
      ],
      documents: [
        { id: 'ses_doc', name: 'Заключение СЭС', status: 'pending' },
        { id: 'fire_doc', name: 'Заключение пожарных', status: 'pending' },
        { id: 'eco_doc', name: 'Экологическое согласование', status: 'pending' },
        { id: 'soviet_doc', name: 'Постановление горсовета', status: 'pending' }
      ]
    },
    {
      stage: 4,
      checklist: [
        { id: 'gp', label: 'ГП (Генеральный план)', done: false },
        { id: 'ar', label: 'АР (Архитектурные решения)', done: false },
        { id: 'kzh', label: 'КЖ (Конструкции железобетонные)', done: false },
        { id: 'vk', label: 'ВК (Водоснабжение и канализация)', done: false },
        { id: 'ob', label: 'ОВ (Отопление и вентиляция)', done: false },
        { id: 'eo', label: 'ЭО (Электрооборудование)', done: false },
        { id: 'nbsh', label: 'НБШС (Наружные сети)', done: false },
        { id: 'fes', label: 'ФЭС (Фасады)', done: false },
        { id: 'vn', label: 'ВН (Внутренние сети)', done: false },
        { id: 'smeta', label: 'Смета', done: false }
      ],
      documents: [
        { id: 'gp_doc', name: 'ГП', status: 'pending' },
        { id: 'ar_doc', name: 'АР', status: 'pending' },
        { id: 'kzh_doc', name: 'КЖ', status: 'pending' },
        { id: 'vk_doc', name: 'ВК', status: 'pending' },
        { id: 'ob_doc', name: 'ОВ', status: 'pending' },
        { id: 'eo_doc', name: 'ЭО', status: 'pending' },
        { id: 'nbsh_doc', name: 'НБШС', status: 'pending' },
        { id: 'fes_doc', name: 'ФЭС', status: 'pending' },
        { id: 'vn_doc', name: 'ВН', status: 'pending' },
        { id: 'smeta_doc', name: 'Смета', status: 'pending' }
      ]
    },
    {
      stage: 5,
      checklist: [
        { id: 'ecp', label: 'Загрузка ЭЦП документов', done: false },
        { id: 'fee', label: 'Оплата 0.1% сбора', done: false },
        { id: 'mygov', label: 'Регистрация на my.gov.uz', done: false }
      ],
      documents: [
        { id: 'ecp_doc', name: 'ЭЦП пакет документов', status: 'pending' },
        { id: 'fee_receipt', name: 'Квитанция об оплате 0.1%', status: 'pending' },
        { id: 'expertise_cert', name: 'Положительное заключение экспертизы', status: 'pending' }
      ]
    },
    {
      stage: 6,
      checklist: [
        { id: 'field_log', label: 'Журнал авторского надзора', done: false },
        { id: 'site_visits', label: 'Выезды на объект', done: false }
      ],
      documents: [
        { id: 'supervision_log', name: 'Журнал авторского надзора', status: 'pending' },
        { id: 'act_hidden', name: 'Акты скрытых работ', status: 'pending' }
      ]
    },
    {
      stage: 7,
      checklist: [
        { id: 'final_dec', label: 'Итоговая декларация', done: false },
        { id: 'acceptance_act', label: 'Акт сдачи-приёмки', done: false }
      ],
      documents: [
        { id: 'final_declaration', name: 'Итоговая декларация', status: 'pending' },
        { id: 'acceptance_doc', name: 'Акт приёмочной комиссии', status: 'pending' }
      ]
    }
  ]
}

const MOCK_PROJECTS: Project[] = [
  {
    id: 'proj-001',
    name: 'Жилой комплекс «Нур Сити»',
    client: 'ООО «Turon Build»',
    location: 'Ташкент, Юнусабадский р-н',
    description: '16-этажный жилой комплекс, 240 квартир',
    currentStage: 1,
    createdAt: '2026-01-10',
    stages: makeStages()
  },
  {
    id: 'proj-002',
    name: 'Бизнес-центр «Silk Road»',
    client: 'АО «Silk Invest»',
    location: 'Ташкент, Мирзо-Улугбекский р-н',
    description: 'Офисный центр класса А, 8 этажей',
    currentStage: 3,
    createdAt: '2025-11-20',
    stages: (() => {
      const s = makeStages()
      // Stage 1 complete
      s[0].checklist.forEach(c => { c.done = true })
      s[0].documents.forEach(d => { d.status = 'approved' })
      // Stage 2 complete
      s[1].checklist.forEach(c => { c.done = true })
      s[1].documents.forEach(d => { d.status = 'uploaded' })
      // Stage 3 partially done
      s[2].checklist[0].done = true
      s[2].checklist[1].done = true
      s[2].documents[0].status = 'approved'
      s[2].documents[1].status = 'uploaded'
      return s
    })()
  },
  {
    id: 'proj-003',
    name: 'Школа №214 (реконструкция)',
    client: 'Министерство народного образования',
    location: 'Самарканд, Сиёб тумани',
    description: 'Реконструкция здания школы на 800 учеников',
    currentStage: 5,
    createdAt: '2025-08-05',
    stages: (() => {
      const s = makeStages()
      // Stages 1–3 complete
      for (let i = 0; i < 3; i++) {
        s[i].checklist.forEach(c => { c.done = true })
        s[i].documents.forEach(d => { d.status = 'approved' })
      }
      // Stage 4 — AR, KZH, Smeta uploaded (gate requirement met)
      s[3].checklist.forEach(c => { c.done = true })
      s[3].documents.forEach(d => { d.status = 'uploaded' })
      // Stage 5 in progress
      s[4].checklist[0].done = true
      s[4].documents[0].status = 'uploaded'
      return s
    })()
  }
]

export const useProjectsStore = defineStore('projects', {
  state: () => ({
    projects: MOCK_PROJECTS as Project[]
  }),

  getters: {
    byStage: (state) => (stage: ProjectStage) =>
      state.projects.filter(p => p.currentStage === stage),

    getById: (state) => (id: string) =>
      state.projects.find(p => p.id === id)
  },

  actions: {
    createProject(data: { name: string; client: string; location: string; description?: string }) {
      const project: Project = {
        id: `proj-${Date.now()}`,
        ...data,
        currentStage: 1,
        createdAt: new Date().toISOString().split('T')[0],
        stages: makeStages()
      }
      this.projects.push(project)
      return project
    },

    updateDocumentStatus(projectId: string, stageNum: ProjectStage, docId: string, status: DocumentStatus) {
      const project = this.projects.find(p => p.id === projectId)
      if (!project) return
      const stage = project.stages.find(s => s.stage === stageNum)
      if (!stage) return
      const doc = stage.documents.find(d => d.id === docId)
      if (!doc) return
      doc.status = status
      if (status === 'uploaded') doc.uploadedAt = new Date().toISOString()
    },

    updateChecklistItem(projectId: string, stageNum: ProjectStage, itemId: string, done: boolean) {
      const project = this.projects.find(p => p.id === projectId)
      if (!project) return
      const stage = project.stages.find(s => s.stage === stageNum)
      if (!stage) return
      const item = stage.checklist.find(c => c.id === itemId)
      if (item) item.done = done
    },

    advanceStage(projectId: string) {
      const project = this.projects.find(p => p.id === projectId)
      if (!project || project.currentStage >= 7) return
      project.currentStage = (project.currentStage + 1) as ProjectStage
    }
  }
})
