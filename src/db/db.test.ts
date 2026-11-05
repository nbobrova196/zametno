import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { beforeEach, describe, expect, it } from 'vitest'
import { ZametnoDb } from './db'
import type { Project, Reminder } from './types'

const NAME = 'zametno-migration-test'

const project: Project = {
  id: 'p1',
  title: 'Фасоль на подоконнике',
  subjectName: 'фасоль',
  templateId: 'plant',
  mode: 'research',
  status: 'active',
  color: '#1f5f4f',
  createdAt: 1,
  updatedAt: 1,
}

beforeEach(async () => {
  await Dexie.delete(NAME)
})

describe('миграция Dexie', () => {
  it('сохраняет проекты версии 1 и добавляет таблицы напоминаний', async () => {
    const v1 = new Dexie(NAME)
    v1.version(1).stores({
      projects: 'id, updatedAt, status',
      metrics: 'id, projectId',
      marks: 'id, projectId',
      observations: 'id, projectId, observedAt, kind',
      photos: 'id, projectId, observationId',
    })
    await v1.table<Project, string>('projects').add(project)
    v1.close()

    const upgraded = new ZametnoDb(NAME)
    await upgraded.open()

    expect(await upgraded.projects.count()).toBe(1)
    expect((await upgraded.projects.get('p1'))?.title).toBe('Фасоль на подоконнике')

    const reminder: Reminder = {
      id: 'r1',
      projectId: 'p1',
      kind: 'care',
      title: 'Полить фасоль',
      weekdays: [1, 3, 5],
      time: '09:00',
      startDate: '2026-11-04',
      active: true,
      createdAt: 1,
      updatedAt: 1,
    }
    await upgraded.reminders.add(reminder)

    expect(await upgraded.reminders.count()).toBe(1)
    expect((await upgraded.reminders.get('r1'))?.weekdays).toEqual([1, 3, 5])
    upgraded.close()
  })
})
