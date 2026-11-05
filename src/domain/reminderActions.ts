import { db } from '../db/db'
import type { Reminder, ReminderKind, ReminderLog } from '../db/types'
import { todayKey, tomorrowKey } from './reminders'

export interface ReminderInput {
  projectId: string
  kind: ReminderKind
  title: string
  weekdays: number[]
  time: string
  startDate: string
  endDate?: string
}

export async function listReminders(projectId: string) {
  const reminders = await db.reminders.where('projectId').equals(projectId).toArray()
  return reminders.sort((a, b) => a.time.localeCompare(b.time))
}

export async function listReminderLogs(projectId: string) {
  return db.reminderLogs.where('projectId').equals(projectId).toArray()
}

export async function createReminder(input: ReminderInput) {
  const now = Date.now()
  const reminder: Reminder = {
    id: crypto.randomUUID(),
    projectId: input.projectId,
    kind: input.kind,
    title: input.title.trim(),
    weekdays: [...new Set(input.weekdays)].sort((a, b) => a - b),
    time: input.time || '09:00',
    startDate: input.startDate || todayKey(),
    endDate: input.endDate || undefined,
    active: true,
    createdAt: now,
    updatedAt: now,
  }

  await db.reminders.add(reminder)
  return reminder.id
}

export async function updateReminder(
  reminderId: string,
  patch: Partial<Pick<Reminder, 'kind' | 'title' | 'weekdays' | 'time' | 'startDate' | 'endDate' | 'active'>>,
) {
  await db.reminders.update(reminderId, {
    ...patch,
    weekdays: patch.weekdays ? [...new Set(patch.weekdays)].sort((a, b) => a - b) : undefined,
    updatedAt: Date.now(),
  })
}

export async function setReminderActive(reminderId: string, active: boolean) {
  await db.reminders.update(reminderId, { active, updatedAt: Date.now() })
}

export async function snoozeReminder(reminderId: string) {
  await db.reminders.update(reminderId, { snoozedUntil: tomorrowKey(), updatedAt: Date.now() })
}

export async function clearReminderSnooze(reminderId: string) {
  await db.reminders.update(reminderId, { snoozedUntil: undefined, updatedAt: Date.now() })
}

export async function deleteReminder(reminderId: string) {
  await db.transaction('rw', db.reminders, db.reminderLogs, async () => {
    await db.reminderLogs.where('reminderId').equals(reminderId).delete()
    await db.reminders.delete(reminderId)
  })
}

export async function completeReminder({
  reminderId,
  projectId,
  date,
  observationId,
}: {
  reminderId: string
  projectId: string
  date: string
  observationId?: string
}) {
  const existing = await db.reminderLogs
    .where('[reminderId+date]')
    .equals([reminderId, date])
    .first()
  if (existing) return existing.id

  const log: ReminderLog = {
    id: crypto.randomUUID(),
    projectId,
    reminderId,
    date,
    completedAt: Date.now(),
    observationId,
  }
  await db.reminderLogs.add(log)
  return log.id
}

export async function removeReminderLog(reminderId: string, date: string) {
  await db.reminderLogs.where('[reminderId+date]').equals([reminderId, date]).delete()
}
