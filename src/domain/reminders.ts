import { addDays, getISODay, parseISO, startOfDay } from 'date-fns'
import type { Reminder, ReminderLog } from '../db/types'
import { dayKey } from '../lib/format'

export const WEEKDAYS: Array<{ id: number; short: string; label: string }> = [
  { id: 1, short: 'Пн', label: 'Понедельник' },
  { id: 2, short: 'Вт', label: 'Вторник' },
  { id: 3, short: 'Ср', label: 'Среда' },
  { id: 4, short: 'Чт', label: 'Четверг' },
  { id: 5, short: 'Пт', label: 'Пятница' },
  { id: 6, short: 'Сб', label: 'Суббота' },
  { id: 7, short: 'Вс', label: 'Воскресенье' },
]

export function todayKey(date: Date = new Date()) {
  return dayKey(date.getTime())
}

export function weekdayIds() {
  return WEEKDAYS.map((weekday) => weekday.id)
}

export function isReminderDue(reminder: Reminder, date: Date = new Date()) {
  if (!reminder.active || reminder.weekdays.length === 0) return false

  const key = dayKey(date.getTime())
  if (key < reminder.startDate) return false
  if (reminder.endDate && key > reminder.endDate) return false
  if (reminder.snoozedUntil && key < reminder.snoozedUntil) return false

  return reminder.weekdays.includes(getISODay(date))
}

export function remindersForDate(reminders: Reminder[], date: Date) {
  return reminders
    .filter((reminder) => isReminderDue(reminder, date))
    .sort((a, b) => a.time.localeCompare(b.time) || a.title.localeCompare(b.title, 'ru'))
}

/**
 * Ближайший день, когда напоминание сработает. Сканирует не больше трёх лет,
 * чтобы не зациклиться на пустом или закончившемся расписании.
 */
export function nextReminderDate(reminder: Reminder, from: Date = new Date()): Date | null {
  if (!reminder.active || reminder.weekdays.length === 0) return null

  let date = startOfDay(from)
  const start = parseISO(reminder.startDate)
  if (date < start) date = start

  if (reminder.snoozedUntil) {
    const snoozedUntil = parseISO(reminder.snoozedUntil)
    if (date < snoozedUntil) date = snoozedUntil
  }

  for (let step = 0; step < 366 * 3; step++) {
    const key = dayKey(date.getTime())
    if (reminder.endDate && key > reminder.endDate) return null
    if (isReminderDue(reminder, date)) return date
    date = addDays(date, 1)
  }

  return null
}

export function weekdaySummary(weekdays: number[]) {
  const sorted = [...new Set(weekdays)].sort((a, b) => a - b)
  if (sorted.length === 0) return 'дни не выбраны'
  if (sorted.length === 7) return 'каждый день'
  if (sorted.length === 5 && sorted.every((day) => day <= 5)) return 'по будням'
  if (sorted.length === 2 && sorted[0] === 6 && sorted[1] === 7) return 'по выходным'

  return sorted
    .map((day) => WEEKDAYS.find((weekday) => weekday.id === day)?.short)
    .filter(Boolean)
    .join(', ')
}

export function reminderDone(logs: ReminderLog[], reminderId: string, date: string) {
  return logs.some((log) => log.reminderId === reminderId && log.date === date)
}

export function careHistory(logs: ReminderLog[], reminders: Reminder[], limit = 12) {
  const remindersById = new Map(reminders.map((reminder) => [reminder.id, reminder]))
  return [...logs]
    .filter((log) => remindersById.get(log.reminderId)?.kind === 'care')
    .sort((a, b) => b.completedAt - a.completedAt)
    .slice(0, limit)
    .map((log) => ({ log, reminder: remindersById.get(log.reminderId) }))
}

export function tomorrowKey(date: Date = new Date()) {
  return dayKey(addDays(date, 1).getTime())
}
