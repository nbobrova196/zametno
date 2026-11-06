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

export interface ImportResult {
  projectIds: string[]
  /** true, если импортирован архив со всеми проектами. */
  bundle: boolean
}

interface ArchiveBundleEntry {
  id: string
  title: string
  manifest: string
}

interface ArchiveBundle {
  app: 'zametno'
  kind: 'bundle'
  version: number
  exportedAt: number
  projects: ArchiveBundleEntry[]
}

interface CollectedProject {
  manifest: ArchiveManifest
  /** Пути внутри ZIP: photos/<id>.jpg и photos/<id>.thumb.jpg */
  files: Record<string, Uint8Array>
}

export function safeArchiveName(title: string) {
  const clean = title
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return `${clean || 'Заметно'} — заметно.zip`
}

async function collectProject(projectId: string): Promise<CollectedProject> {
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

  return { manifest, files }
}

export async function exportProjectArchive(projectId: string): Promise<ExportResult> {
  const { manifest, files } = await collectProject(projectId)
  files['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2))
  const zipped = zipSync(files, { level: 6 })

  return {
    blob: new Blob([zipped], { type: 'application/zip' }),
    filename: safeArchiveName(manifest.project.title),
  }
}

/** Один ZIP со всеми проектами: bundle.json + папка на каждый проект. */
export async function exportAllProjectsArchive(): Promise<ExportResult> {
  const projects = await db.projects.orderBy('updatedAt').reverse().toArray()
  if (projects.length === 0) throw new Error('На полке пока нет проектов')

  const files: Record<string, Uint8Array> = {}
  const entries: ArchiveBundleEntry[] = []

  for (const project of projects) {
    const collected = await collectProject(project.id)
    const folder = `projects/${project.id}`

    files[`${folder}/manifest.json`] = strToU8(JSON.stringify(collected.manifest, null, 2))
    for (const [path, bytes] of Object.entries(collected.files)) {
      files[`${folder}/${path}`] = bytes
    }

    entries.push({
      id: project.id,
      title: project.title,
      manifest: `${folder}/manifest.json`,
    })
  }

  const bundle: ArchiveBundle = {
    app: 'zametno',
    kind: 'bundle',
    version: ARCHIVE_VERSION,
    exportedAt: Date.now(),
    projects: entries,
  }
  files['bundle.json'] = strToU8(JSON.stringify(bundle, null, 2))

  const zipped = zipSync(files, { level: 6 })

  return {
    blob: new Blob([zipped], { type: 'application/zip' }),
    filename: `Заметно — все проекты — ${archiveDateLabel()}.zip`,
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

async function importManifest(
  manifest: ArchiveManifest,
  files: Record<string, Uint8Array>,
  prefix: string,
): Promise<string> {
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
    const blob = files[prefix + entry.file]
    const thumb = files[prefix + entry.thumbFile] ?? blob
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

function parseArchiveManifest(bytes: Uint8Array): ArchiveManifest {
  try {
    return parseManifest(strFromU8(bytes))
  } catch (error) {
    if (error instanceof Error) throw error
    throw new Error('Описание проекта в архиве повреждено')
  }
}

async function importBundle(
  files: Record<string, Uint8Array>,
  bytes: Uint8Array,
): Promise<ImportResult> {
  let raw: unknown
  try {
    raw = JSON.parse(strFromU8(bytes))
  } catch {
    throw new Error('Описание архива повреждено')
  }

  if (
    !isRecord(raw) ||
    raw.app !== 'zametno' ||
    raw.kind !== 'bundle' ||
    typeof raw.version !== 'number' ||
    raw.version < 1 ||
    raw.version > ARCHIVE_VERSION
  ) {
    throw new Error('Это архив другой версии или другого приложения')
  }

  const list = Array.isArray(raw.projects) ? raw.projects : []
  if (list.length === 0) throw new Error('В архиве нет проектов')

  const prepared: Array<{ manifest: ArchiveManifest; prefix: string }> = []
  for (const item of list) {
    if (!isRecord(item) || typeof item.manifest !== 'string') {
      throw new Error('Архив повреждён: не удалось найти проект')
    }
    const manifestBytes = files[item.manifest]
    if (!manifestBytes) throw new Error('Архив повреждён: нет описания одного из проектов')
    const slash = item.manifest.lastIndexOf('/')
    prepared.push({
      manifest: parseArchiveManifest(manifestBytes),
      prefix: slash >= 0 ? item.manifest.slice(0, slash + 1) : '',
    })
  }

  const projectIds: string[] = []
  for (const project of prepared) {
    projectIds.push(await importManifest(project.manifest, files, project.prefix))
  }

  return { projectIds, bundle: true }
}

export async function importArchive(file: File): Promise<ImportResult> {
  if (file.size > 400 * 1024 * 1024) {
    throw new Error('Архив больше 400 МБ — браузер может не справиться с таким файлом')
  }

  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(new Uint8Array(await file.arrayBuffer()))
  } catch {
    throw new Error('Не получилось прочитать архив. Выбери файл, скачанный из «Заметно».')
  }

  const bundleBytes = files['bundle.json']
  if (bundleBytes) return importBundle(files, bundleBytes)

  const manifestBytes = files['manifest.json']
  if (!manifestBytes) throw new Error('В архиве нет описания проекта')

  const projectId = await importManifest(parseArchiveManifest(manifestBytes), files, '')
  return { projectIds: [projectId], bundle: false }
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
