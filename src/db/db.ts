import Dexie, { type Table } from 'dexie'
import type { Mark, Metric, Observation, Photo, Project, Reminder, ReminderLog } from './types'

export class ZametnoDb extends Dexie {
  projects!: Table<Project, string>
  metrics!: Table<Metric, string>
  marks!: Table<Mark, string>
  observations!: Table<Observation, string>
  photos!: Table<Photo, string>
  reminders!: Table<Reminder, string>
  reminderLogs!: Table<ReminderLog, string>

  constructor(name = 'zametno') {
    super(name)
    this.version(1).stores({
      projects: 'id, updatedAt, status',
      metrics: 'id, projectId',
      marks: 'id, projectId',
      observations: 'id, projectId, observedAt, kind',
      photos: 'id, projectId, observationId',
    })
    this.version(2).stores({
      reminders: 'id, projectId, active',
      reminderLogs: 'id, projectId, reminderId, date, &[reminderId+date]',
    })
  }
}

export const db = new ZametnoDb()

export async function deleteProjectCascade(projectId: string) {
  await db.transaction(
    'rw',
    [db.projects, db.metrics, db.marks, db.observations, db.photos, db.reminders, db.reminderLogs],
    async () => {
      await db.photos.where('projectId').equals(projectId).delete()
      await db.observations.where('projectId').equals(projectId).delete()
      await db.metrics.where('projectId').equals(projectId).delete()
      await db.marks.where('projectId').equals(projectId).delete()
      await db.reminders.where('projectId').equals(projectId).delete()
      await db.reminderLogs.where('projectId').equals(projectId).delete()
      await db.projects.delete(projectId)
    },
  )
}

export function touchProject(projectId: string) {
  return db.projects.update(projectId, { updatedAt: Date.now() })
}
