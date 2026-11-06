import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { db } from '../db/db'
import type { Mark, Metric, Observation, Photo, Project, Reminder, ReminderLog } from '../db/types'
import { dayKey } from '../lib/format'

export const ARCHIVE_VERSION = 1

interface PhotoEntry {
  id: string
  observationId: string
  width: number
  height: number
  order: number
  createdAt: number
  file: string
  thumbFile: string
}

interface ArchiveManifest {
  app: 'zametno'
  version: number
  exportedAt: number
  project: Project
  metrics: Metric[]
  marks: Mark[]
  observations: Observation[]
  photos: PhotoEntry[]
  reminders: Reminder[]
  reminderLogs: ReminderLog[]
}

export interface ExportResult {
  blob: Blob
  filename: string
}

export function safeArchiveName(title: string) {
  const clean = title
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return `${clean || 'Заметно'} — заметно.zip`
}

export async function exportProjectArchive(projectId: string): Promise<ExportResult> {
  const project = await db.projects.get(projectId)
  if (!project) throw new Error('Проект не найден')

  const [metrics, marks, observations, photos, reminders, reminderLogs] = await Promise.all([
    db.metrics.where('projectId').equals(projectId).toArray(),
    db.marks.where('projectId').equals(projectId).toArray(),
    db.observations.where('projectId').equals(projectId).toArray(),
    db.photos.where('projectId').equals(projectId).toArray(),
    db.reminders.where('projectId').equals(projectId).toArray(),
    db.reminderLogs.where('projectId').equals(projectId).toArray(),
  ])

  const files: Record<string, Uint8Array> = {}
  const photoEntries: PhotoEntry[] = []

  for (const photo of photos) {
    const file = `photos/${photo.id}.jpg`
    const thumbFile = `photos/${photo.id}.thumb.jpg`
    files[file] = new Uint8Array(await photo.blob.arrayBuffer())
    files[thumbFile] = new Uint8Array(await photo.thumb.arrayBuffer())
    photoEntries.push({
      id: photo.id,
      observationId: photo.observationId,
      width: photo.width,
      height: photo.height,
      order: photo.order,
      createdAt: photo.createdAt,
      file,
      thumbFile,
    })
  }

  const manifest: ArchiveManifest = {
    app: 'zametno',
    version: ARCHIVE_VERSION,
    exportedAt: Date.now(),
    project,
    metrics,
    marks,
    observations,
    photos: photoEntries,
    reminders,
    reminderLogs,
  }

  files['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2))
  const zipped = zipSync(files, { level: 6 })

  return {
    blob: new Blob([zipped], { type: 'application/zip' }),
    filename: safeArchiveName(project.title),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function parseManifest(raw: string): ArchiveManifest {
  const data: unknown = JSON.parse(raw)
  if (!isRecord(data)) throw new Error('Архив повреждён: нет описания проекта')
  if (
    data.app !== 'zametno' ||
    typeof data.version !== 'number' ||
    data.version < 1 ||
    data.version > ARCHIVE_VERSION
  ) {
    throw new Error('Это архив другой версии или другого приложения')
  }
  if (!isRecord(data.project) || typeof data.project.title !== 'string') {
    throw new Error('Архив повреждён: нет названия проекта')
  }
  const list = (key: string) => (Array.isArray(data[key]) ? (data[key] as unknown[]) : [])
  if (list('observations').some((item) => !isRecord(item))) {
    throw new Error('Архив повреждён: записи наблюдений не читаются')
  }

  return {
    app: 'zametno',
    version: ARCHIVE_VERSION,
    exportedAt: typeof data.exportedAt === 'number' ? data.exportedAt : Date.now(),
    project: data.project as unknown as Project,
    metrics: list('metrics') as unknown as Metric[],
    marks: list('marks') as unknown as Mark[],
    observations: list('observations') as unknown as Observation[],
    photos: list('photos') as unknown as PhotoEntry[],
    reminders: list('reminders') as unknown as Reminder[],
    reminderLogs: list('reminderLogs') as unknown as ReminderLog[],
  }
}

export async function importProjectArchive(file: File): Promise<string> {
  if (file.size > 400 * 1024 * 1024) {
    throw new Error('Архив больше 400 МБ — браузер может не справиться с таким файлом')
  }

  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(new Uint8Array(await file.arrayBuffer()))
  } catch {
    throw new Error('Не получилось прочитать архив. Выбери файл, скачанный из «Заметно».')
  }

  const manifestBytes = files['manifest.json']
  if (!manifestBytes) throw new Error('В архиве нет описания проекта')

  let manifest: ArchiveManifest
  try {
    manifest = parseManifest(strFromU8(manifestBytes))
  } catch (error) {
    if (error instanceof Error) throw error
    throw new Error('Описание проекта в архиве повреждено')
  }

  const now = Date.now()
  const projectId = crypto.randomUUID()
  const observationIds = new Map<string, string>()
  const photoIds = new Map<string, string>()
  const metricIds = new Map<string, string>()
  const markIds = new Map<string, string>()
  const reminderIds = new Map<string, string>()

  const newObservationId = (oldId: string) => {
    const existing = observationIds.get(oldId)
    if (existing) return existing
    const id = crypto.randomUUID()
    observationIds.set(oldId, id)
    return id
  }
  const newPhotoId = (oldId: string) => {
    const existing = photoIds.get(oldId)
    if (existing) return existing
    const id = crypto.randomUUID()
    photoIds.set(oldId, id)
    return id
  }

  for (const metric of manifest.metrics) metricIds.set(metric.id, crypto.randomUUID())
  for (const mark of manifest.marks) markIds.set(mark.id, crypto.randomUUID())
  for (const reminder of manifest.reminders) reminderIds.set(reminder.id, crypto.randomUUID())
  for (const observation of manifest.observations) newObservationId(observation.id)
  for (const photo of manifest.photos) newPhotoId(photo.id)

  const observations: Observation[] = manifest.observations.map((observation) => ({
    ...observation,
    id: newObservationId(observation.id),
    projectId,
    markIds: (observation.markIds ?? [])
      .map((id) => markIds.get(id))
      .filter((id): id is string => Boolean(id)),
    measurements: (observation.measurements ?? []).flatMap((measurement) => {
      const metricId = metricIds.get(measurement.metricId)
      return metricId ? [{ ...measurement, metricId }] : []
    }),
  }))

  const photos: Photo[] = []
  for (const entry of manifest.photos) {
    const blob = files[entry.file]
    const thumb = files[entry.thumbFile] ?? blob
    if (!blob) continue
    photos.push({
      id: newPhotoId(entry.id),
      projectId,
      observationId: newObservationId(entry.observationId),
      blob: new Blob([new Uint8Array(blob)], { type: 'image/jpeg' }),
      thumb: new Blob([new Uint8Array(thumb)], { type: 'image/jpeg' }),
      width: entry.width,
      height: entry.height,
      order: entry.order,
      createdAt: entry.createdAt,
    })
  }

  const project: Project = {
    ...manifest.project,
    id: projectId,
    title: manifest.project.title.trim() || 'Импортированный проект',
    status: manifest.project.status === 'completed' ? 'paused' : manifest.project.status,
    coverPhotoId: manifest.project.coverPhotoId
      ? photoIds.get(manifest.project.coverPhotoId)
      : undefined,
    selectedObservationIds: manifest.project.selectedObservationIds
      ?.map((id) => observationIds.get(id))
      .filter((id): id is string => Boolean(id)),
    createdAt: manifest.project.createdAt ?? now,
    updatedAt: now,
  }

  const metrics: Metric[] = manifest.metrics.map((metric) => ({
    ...metric,
    id: metricIds.get(metric.id)!,
    projectId,
  }))

  const marks: Mark[] = manifest.marks.map((mark) => ({
    ...mark,
    id: markIds.get(mark.id)!,
    projectId,
  }))

  const reminders: Reminder[] = manifest.reminders.map((reminder) => ({
    ...reminder,
    id: reminderIds.get(reminder.id)!,
    projectId,
  }))

  const reminderLogs: ReminderLog[] = manifest.reminderLogs.flatMap((log) => {
    const reminderId = reminderIds.get(log.reminderId)
    if (!reminderId) return []
    return [
      {
        ...log,
        id: crypto.randomUUID(),
        projectId,
        reminderId,
        observationId: log.observationId
          ? observationIds.get(log.observationId)
          : undefined,
      },
    ]
  })

  await db.transaction(
    'rw',
    [db.projects, db.metrics, db.marks, db.observations, db.photos, db.reminders, db.reminderLogs],
    async () => {
      await db.projects.add(project)
      if (metrics.length > 0) await db.metrics.bulkAdd(metrics)
      if (marks.length > 0) await db.marks.bulkAdd(marks)
      if (observations.length > 0) await db.observations.bulkAdd(observations)
      if (photos.length > 0) await db.photos.bulkAdd(photos)
      if (reminders.length > 0) await db.reminders.bulkAdd(reminders)
      if (reminderLogs.length > 0) await db.reminderLogs.bulkAdd(reminderLogs)
    },
  )

  return projectId
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Сегодняшняя дата — для имени файла архива при необходимости. */
export function archiveDateLabel(date: Date = new Date()) {
  return dayKey(date.getTime())
}
