import dayjs from 'dayjs'
import 'dayjs/locale/ru'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.locale('ru')
dayjs.extend(relativeTime)

export const fmtDate = (d?: string | null): string =>
  d ? dayjs(d).format('D MMM YYYY') : '—'

export const fmtDateShort = (d?: string | null): string =>
  d ? dayjs(d).format('D MMM') : '—'

export const fmtDateInput = (d?: string | null): string =>
  d ? dayjs(d).format('YYYY-MM-DD') : ''

export const isOverdue = (d?: string | null): boolean =>
  d ? dayjs(d).isBefore(dayjs(), 'day') : false

export const daysUntil = (d?: string | null): number | null =>
  d ? dayjs(d).diff(dayjs(), 'day') : null

export const fromNow = (d?: string | null): string =>
  d ? dayjs(d).fromNow() : '—'

export const today = (): string => dayjs().format('YYYY-MM-DD')

/** Returns month label like "Янв 2026" */
export const monthLabel = (d: string): string => dayjs(d).format('MMM YYYY')

/** Group an array by month key (YYYY-MM) */
export const groupByMonth = <T>(items: T[], getDate: (i: T) => string): Record<string, T[]> => {
  const map: Record<string, T[]> = {}
  for (const item of items) {
    const key = dayjs(getDate(item)).format('YYYY-MM')
    ;(map[key] ??= []).push(item)
  }
  return map
}

/** Last N months as YYYY-MM strings (current month last) */
export const lastNMonths = (n = 6): string[] => {
  return Array.from({ length: n }, (_, i) =>
    dayjs().subtract(n - 1 - i, 'month').format('YYYY-MM')
  )
}
