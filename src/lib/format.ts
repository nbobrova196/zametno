import { differenceInCalendarDays, format, isToday, isYesterday } from 'date-fns'
import { ru } from 'date-fns/locale'

const ruNumber = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 })

export function formatNumber(value: number) {
  return ruNumber.format(value)
}

export function formatDay(timestamp: number) {
  return format(timestamp, 'd MMMM', { locale: ru })
}

export function formatTime(timestamp: number) {
  return format(timestamp, 'HH:mm')
}

export function formatRange(start: number, end: number) {
  if (dayKey(start) === dayKey(end)) {
    return format(start, 'd MMMM yyyy', { locale: ru })
  }

  const sameYear = new Date(start).getFullYear() === new Date(end).getFullYear()
  if (sameYear) {
    return `${format(start, 'd MMMM', { locale: ru })} — ${format(end, 'd MMMM yyyy', { locale: ru })}`
  }

  return `${format(start, 'd MMMM yyyy', { locale: ru })} — ${format(end, 'd MMMM yyyy', { locale: ru })}`
}

export function formatFull(timestamp: number) {
  return format(timestamp, 'd MMMM yyyy, HH:mm', { locale: ru })
}

export function dayKey(timestamp: number) {
  return format(timestamp, 'yyyy-MM-dd')
}

export function dayLabel(timestamp: number) {
  if (isToday(timestamp)) return 'Сегодня'
  if (isYesterday(timestamp)) return 'Вчера'
  return format(timestamp, 'd MMMM', { locale: ru })
}

export function daysAgo(timestamp: number) {
  return differenceInCalendarDays(Date.now(), timestamp)
}

export function plural(count: number, one: string, few: string, many: string) {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

export function observationsWord(count: number) {
  return plural(count, 'наблюдение', 'наблюдения', 'наблюдений')
}

export function daysWord(count: number) {
  return plural(count, 'день', 'дня', 'дней')
}

export function metricsWord(count: number) {
  return plural(count, 'показатель', 'показателя', 'показателей')
}

export function importantEventsWord(count: number) {
  return plural(count, 'важное событие', 'важных события', 'важных событий')
}
