import type { ProjectStage } from '~/types/project'

export interface StageInfo {
  id: ProjectStage
  label: string
  labelUz: string
  color: string
  icon: string
}

export const STAGES: StageInfo[] = [
  {
    id: 1,
    label: 'Исходные данные',
    labelUz: 'Dastlabki ma\'lumotlar',
    color: 'slate',
    icon: 'i-ph-file-magnifying-glass'
  },
  {
    id: 2,
    label: 'Эскизный проект',
    labelUz: 'Eskiz loyiha',
    color: 'purple',
    icon: 'i-ph-pencil-ruler'
  },
  {
    id: 3,
    label: 'Согласование',
    labelUz: 'Muvofiqlashtirish',
    color: 'amber',
    icon: 'i-ph-stamp'
  },
  {
    id: 4,
    label: 'Ишчи лойиҳа',
    labelUz: 'Ish loyihasi',
    color: 'blue',
    icon: 'i-ph-compass'
  },
  {
    id: 5,
    label: 'Экспертиза и ГАСН',
    labelUz: 'Ekspertiza va GASN',
    color: 'indigo',
    icon: 'i-ph-buildings'
  },
  {
    id: 6,
    label: 'Строительство и надзор',
    labelUz: 'Qurilish va nazorat',
    color: 'orange',
    icon: 'i-ph-hard-hat'
  },
  {
    id: 7,
    label: 'Сдача объекта',
    labelUz: 'Obyektni topshirish',
    color: 'green',
    icon: 'i-ph-check-circle'
  }
]

export const STAGE_MAP = Object.fromEntries(STAGES.map(s => [s.id, s])) as Record<ProjectStage, StageInfo>
