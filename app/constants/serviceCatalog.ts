import type { Service } from '~/types/crm'

export const SERVICE_CATALOG: Service[] = [
  // ─── Эскизный проект (ЭП) ────────────────────────────────────────────────
  {
    id: 'svc-facades',
    name: 'Фасады',
    nameUz: 'Fasadlar',
    category: 'sketch',
    basePrice: 8_000_000,
    unit: 'лист'
  },
  {
    id: 'svc-plans',
    name: 'Планировки этажей',
    nameUz: 'Qavat rejalari',
    category: 'sketch',
    basePrice: 5_000_000,
    unit: 'этаж'
  },
  {
    id: 'svc-3d',
    name: '3D-визуализация',
    nameUz: '3D-vizualizatsiya',
    category: 'sketch',
    basePrice: 15_000_000,
    unit: 'комплект'
  },
  {
    id: 'svc-sitemap',
    name: 'Ситуационный план',
    nameUz: 'Joylashuv rejasi',
    category: 'sketch',
    basePrice: 3_000_000,
    unit: 'лист'
  },
  // ─── Рабочий проект (РП) ─────────────────────────────────────────────────
  {
    id: 'svc-ar',
    name: 'АР (Архитектурные решения)',
    nameUz: 'AR (Arxitektura yechimlari)',
    category: 'working',
    basePrice: 20_000_000,
    unit: 'комплект'
  },
  {
    id: 'svc-kzh',
    name: 'КЖ (Конструкции железобетонные)',
    nameUz: 'KZh (Temir-beton konstruksiyalar)',
    category: 'working',
    basePrice: 25_000_000,
    unit: 'комплект'
  },
  {
    id: 'svc-vk',
    name: 'ВК (Водоснабжение и канализация)',
    nameUz: 'VK (Suv ta\'minoti va kanalizatsiya)',
    category: 'working',
    basePrice: 12_000_000,
    unit: 'комплект'
  },
  {
    id: 'svc-eo',
    name: 'ЭО (Электрооборудование)',
    nameUz: 'EO (Elektr jihozlar)',
    category: 'working',
    basePrice: 14_000_000,
    unit: 'комплект'
  },
  // ─── Экспертиза ───────────────────────────────────────────────────────────
  {
    id: 'svc-expertise',
    name: 'Гос. экспертиза проекта',
    nameUz: 'Davlat ekspertizasi',
    category: 'expertise',
    basePrice: 10_000_000,
    unit: 'комплект'
  },
  // ─── Регистрация ──────────────────────────────────────────────────────────
  {
    id: 'svc-passport',
    name: 'Строительный паспорт',
    nameUz: 'Qurilish pasporti',
    category: 'registration',
    basePrice: 6_000_000,
    unit: 'комплект'
  }
]

export const SERVICE_MAP = Object.fromEntries(
  SERVICE_CATALOG.map(s => [s.id, s])
) as Record<string, Service>

export const CATEGORY_LABELS: Record<string, string> = {
  sketch: 'Эскизный проект (ЭП)',
  working: 'Рабочий проект (РП)',
  expertise: 'Экспертиза',
  registration: 'Регистрация'
}

export const CATEGORY_ICONS: Record<string, string> = {
  sketch: 'i-ph-pencil-ruler',
  working: 'i-ph-compass',
  expertise: 'i-ph-buildings',
  registration: 'i-ph-certificate'
}
