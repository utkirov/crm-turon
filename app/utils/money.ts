const FMT = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })

/** Format number as "1 234 567" */
export const fmtMoney = (n: number): string => FMT.format(n)

/** Format number as "1.2 млн" or "450 000" */
export const fmtMoneyM = (n: number): string =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1).replace('.0', '')} млн`
    : FMT.format(n)

/** Format number as "1 234 567 сум" */
export const fmtMoneySum = (n: number): string => `${FMT.format(n)} сум`

/** Parse formatted string back to integer */
export const parseMoney = (s: string): number =>
  parseInt(s.replace(/\D/g, ''), 10) || 0

/** Format input value with spaces between thousands while typing */
export const formatMoneyInput = (raw: string): string => {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  return FMT.format(parseInt(digits, 10))
}
