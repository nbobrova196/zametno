import { describe, expect, it } from 'vitest'
import type { Reminder } from '../db/types'
import {
  nextReminderDate,
  remindersForDate,
  weekdaySummary,
  isReminderDue,
  todayKey,
} from './reminders'

function reminder(patch: Partial<Reminder> = {}): Reminder {
  return {
    id: 'r1',
    projectId: 'p1',
    kind: 'observation',
    title: 'Проверить растение',
    weekdays: [1],
    time: '09:00',
    startDate: '2026-01-01',
    active: true,
    createdAt: 0,
    updatedAt: 0,
    ...patch,
  }
}

describe('nextReminderDate', () => {
  it('находит ближайший понедельник', () => {
    const next = nextReminderDate(reminder(), new Date(2026, 10, 1))
    expect(next && todayKey(next)).toBe('2026-11-02')
  })

  it('переходит через границу месяца', () => {
    const next = nextReminderDate(reminder(), new Date(2026, 0, 30))
    expect(next && todayKey(next)).toBe('2026-02-02')
  })

  it('переходит через границу года', () => {
    const next = nextReminderDate(reminder({ weekdays: [5] }), new Date(2026, 11, 31))
    expect(next && todayKey(next)).toBe('2027-01-01')
  })

  it('учитывает дату старта', () => {
    const next = nextReminderDate(
      reminder({ weekdays: [2], startDate: '2026-11-10' }),
      new Date(2026, 10, 2),
    )
    expect(next && todayKey(next)).toBe('2026-11-10')
  })

  it('учитывает перенос', () => {
    const next = nextReminderDate(
      reminder({ snoozedUntil: '2026-11-09' }),
      new Date(2026, 10, 2),
    )
    expect(next && todayKey(next)).toBe('2026-11-09')
  })

  it('возвращает null после окончания расписания', () => {
    const next = nextReminderDate(
      reminder({ endDate: '2026-11-03' }),
      new Date(2026, 10, 4),
    )
    expect(next).toBeNull()
  })
})

describe('isReminderDue', () => {
  it('срабатывает в выбранный день недели', () => {
    expect(isReminderDue(reminder(), new Date(2026, 10, 2))).toBe(true)
    expect(isReminderDue(reminder(), new Date(2026, 10, 3))).toBe(false)
  })

  it('не срабатывает на паузе и в день переноса', () => {
    expect(isReminderDue(reminder({ active: false }), new Date(2026, 10, 2))).toBe(false)
    expect(
      isReminderDue(reminder({ snoozedUntil: '2026-11-03' }), new Date(2026, 10, 2)),
    ).toBe(false)
  })
})

describe('remindersForDate', () => {
  it('фильтрует и сортирует по времени', () => {
    const due = remindersForDate(
      [
        reminder({ id: 'late', time: '18:00' }),
        reminder({ id: 'early', time: '08:00' }),
        reminder({ id: 'paused', time: '10:00', active: false }),
      ],
      new Date(2026, 10, 2),
    )
    expect(due.map((item) => item.id)).toEqual(['early', 'late'])
  })
})

describe('weekdaySummary', () => {
  it('кратко описывает расписание', () => {
    expect(weekdaySummary([1, 2, 3, 4, 5, 6, 7])).toBe('каждый день')
    expect(weekdaySummary([1, 2, 3, 4, 5])).toBe('по будням')
    expect(weekdaySummary([6, 7])).toBe('по выходным')
    expect(weekdaySummary([1, 4])).toBe('Пн, Чт')
  })
})
