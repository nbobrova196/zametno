import type { Metric, Observation, Photo, PresentationTheme, Project } from '../db/types'
import { formatDay, formatNumber, formatRange, observationsWord } from '../lib/format'
import { getTemplate } from './templates'

export interface PresentationThemeOption {
  id: PresentationTheme
  title: string
  description: string
  bg: string
  ink: string
  muted: string
  accent: string
  photoBg: string
}

export const PRESENTATION_THEMES: PresentationThemeOption[] = [
  {
    id: 'paper',
    title: 'Бумага',
    description: 'Тёплый светлый фон — как страница дневника.',
    bg: '#f7f4ee',
    ink: '#1c1b19',
    muted: '#6b665e',
    accent: '#1f5f4f',
    photoBg: '#e3ddd2',
  },
  {
    id: 'forest',
    title: 'Лес',
    description: 'Глубокий зелёный и светлый текст. Хорошо для показа.',
    bg: '#1f5f4f',
    ink: '#f7f4ee',
    muted: '#d9e8e1',
    accent: '#e0a03a',
    photoBg: '#1a4c40',
  },
  {
    id: 'sky',
    title: 'Небо',
    description: 'Спокойный голубой фон для проектов о погоде и не только.',
    bg: '#eef3f7',
    ink: '#22344a',
    muted: '#5b6f86',
    accent: '#3c5a7d',
    photoBg: '#dbe6f2',
  },
]

export function getPresentationTheme(id: PresentationTheme | undefined) {
  return PRESENTATION_THEMES.find((theme) => theme.id === id) ?? PRESENTATION_THEMES[0]
}

export type SlideKind = 'title' | 'question' | 'method' | 'observations' | 'conclusion' | 'next'

export interface SlidePhoto {
  photo: Photo
  caption: string
}

export interface Slide {
  id: string
  kind: SlideKind
  eyebrow: string
  title: string
  text?: string
  bullets?: string[]
  photos?: SlidePhoto[]
  footer?: string
}

const kindLabels: Partial<Record<Observation['kind'], string>> = {
  no_changes: 'Изменений не заметил',
  care: 'Уход',
}

export function defaultSelectedObservationIds(
  project: Project,
  observations: Observation[],
): string[] {
  const available = observations.filter((observation) => observation.kind !== 'skipped')
  const saved = project.selectedObservationIds?.filter((id) =>
    available.some((observation) => observation.id === id),
  )
  if (project.selectedObservationIds !== undefined) {
    return (saved ?? []).slice(0, 6)
  }

  const important = available.filter((observation) => observation.isImportant)
  if (important.length > 0) return important.slice(0, 6).map((observation) => observation.id)

  return available.slice(0, 3).map((observation) => observation.id)
}

function shortNote(note: string | undefined, limit = 80) {
  if (!note) return ''
  const flat = note.replace(/\s+/g, ' ').trim()
  return flat.length > limit ? `${flat.slice(0, limit - 1)}…` : flat
}

function observationCaption(observation: Observation) {
  const parts = [formatDay(observation.observedAt)]
  const note = shortNote(observation.note)
  if (note) parts.push(note)
  else if (kindLabels[observation.kind]) parts.push(kindLabels[observation.kind]!)
  return parts.join(' · ')
}

function representatives<T>(items: T[], limit: number): T[] {
  if (items.length <= limit) return items
  return [items[0], items[Math.floor(items.length / 2)], items[items.length - 1]]
}

function metricSummary(metric: Metric, observations: Observation[]) {
  const values = observations
    .flatMap((observation) =>
      observation.measurements
        .filter((measurement) => measurement.metricId === metric.id)
        .map((measurement) => ({ at: observation.observedAt, value: measurement.value })),
    )
    .sort((a, b) => a.at - b.at)

  if (values.length === 0) return null
  const first = values[0]
  const last = values[values.length - 1]
  if (first.value === last.value) {
    return `${metric.name}: ${formatNumber(last.value)} ${metric.unit}`
  }
  return `${metric.name}: ${formatNumber(first.value)} → ${formatNumber(last.value)} ${metric.unit}`
}

export function buildPresentation({
  project,
  observations,
  photos,
  metrics,
  selectedIds,
}: {
  project: Project
  observations: Observation[]
  photos: Photo[]
  metrics: Metric[]
  selectedIds: string[]
}): Slide[] {
  const template = getTemplate(project.templateId)
  const available = observations.filter((observation) => observation.kind !== 'skipped')
  const selectedSet = new Set(selectedIds)
  const selected = available
    .filter((observation) => selectedSet.has(observation.id))
    .sort((a, b) => a.observedAt - b.observedAt)

  const photosByObservation = new Map<string, Photo>()
  for (const photo of photos) {
    if (!photosByObservation.has(photo.observationId)) {
      photosByObservation.set(photo.observationId, photo)
    }
  }

  const coverPhoto =
    photos.find((photo) => photo.id === project.coverPhotoId) ??
    selected.map((observation) => photosByObservation.get(observation.id)).find(Boolean) ??
    photos[0]

  const slides: Slide[] = []

  slides.push({
    id: 'title',
    kind: 'title',
    eyebrow: 'Моё исследование',
    title: project.title,
    text: project.authorName ? `Автор: ${project.authorName}` : undefined,
    photos: coverPhoto
      ? [
          {
            photo: coverPhoto,
            caption: project.subjectName || template?.title || 'Наблюдение',
          },
        ]
      : undefined,
    footer: template ? `${template.emoji} ${template.title}` : undefined,
  })

  if (project.question || project.hypothesis) {
    slides.push({
      id: 'question',
      kind: 'question',
      eyebrow: 'Мой вопрос',
      title: 'Что хотелось выяснить',
      text: project.question || undefined,
      bullets: project.hypothesis ? [`Предположение: ${project.hypothesis}`] : undefined,
    })
  }

  const start = project.startDate ? new Date(project.startDate).getTime() : project.createdAt
  const lastObservation = available.reduce(
    (latest, observation) => Math.max(latest, observation.observedAt),
    0,
  )
  const end = project.endDate
    ? new Date(project.endDate).getTime()
    : (lastObservation || project.createdAt)

  const measurementSummaries = metrics
    .map((metric) => metricSummary(metric, available))
    .filter((summary): summary is string => summary !== null)

  const methodBullets = [
    `Объект: ${project.subjectName || template?.title || 'наблюдение'}`,
    `Срок: ${formatRange(start, end)}`,
    `Записей: ${available.length} ${observationsWord(available.length)}`,
    measurementSummaries.length > 0
      ? `Измерения: ${measurementSummaries.join('; ')}`
      : 'Измерения: не использовались',
  ]

  slides.push({
    id: 'method',
    kind: 'method',
    eyebrow: 'Как я наблюдал',
    title: 'Ход наблюдения',
    text: project.description || undefined,
    bullets: methodBullets,
  })

  if (selected.length > 0) {
    const chosen = representatives(selected, 3)
    const slidePhotos = chosen
      .map((observation) => {
        const photo = photosByObservation.get(observation.id)
        return photo ? { photo, caption: observationCaption(observation) } : null
      })
      .filter((item): item is SlidePhoto => item !== null)

    const bulletFallback = selected
      .slice(-3)
      .map((observation) => observationCaption(observation))

    slides.push({
      id: 'observations',
      kind: 'observations',
      eyebrow: 'Основные наблюдения',
      title: 'Что происходило',
      photos: slidePhotos.length > 0 ? slidePhotos : undefined,
      bullets: slidePhotos.length > 0 ? undefined : bulletFallback,
      footer:
        selected.length > 3
          ? `Показаны 3 из ${selected.length}. Остальные записи остались в истории.`
          : undefined,
    })
  }

  if (project.conclusion?.trim()) {
    const supporting = selected.filter((observation) => observation.isImportant)
    const confirmations = (supporting.length > 0 ? supporting : selected)
      .slice(-3)
      .map((observation) => formatDay(observation.observedAt))

    slides.push({
      id: 'conclusion',
      kind: 'conclusion',
      eyebrow: 'Что я выяснил',
      title: 'Мой вывод',
      text: project.conclusion,
      bullets:
        confirmations.length > 0
          ? [`Подтверждают записи: ${confirmations.join(', ')}`]
          : undefined,
    })
  }

  if (project.nextSteps?.trim()) {
    slides.push({
      id: 'next',
      kind: 'next',
      eyebrow: 'Что дальше',
      title: 'Продолжение',
      text: project.nextSteps,
    })
  }

  if (slides.length < 3) {
    slides.push({
      id: 'next-fallback',
      kind: 'next',
      eyebrow: 'Что дальше',
      title: 'Продолжение',
      bullets: [
        'Что осталось неизвестным?',
        'Что хотелось бы проверить дальше?',
        'Какой опыт стоит повторить?',
      ],
    })
  }

  return slides
}
