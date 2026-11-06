import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useParams } from 'react-router-dom'
import { db } from '../db/db'
import type { Mark, Metric, Observation, Photo } from '../db/types'
import { listObservations } from '../domain/observations'
import { dayKey, dayLabel } from '../lib/format'
import { ObservationCard } from '../components/ObservationCard'
import { ObservationActions } from '../components/ObservationActions'
import { EmptyState, buttonStyles, cn } from '../components/ui'

export function HistoryScreen() {
  const { projectId } = useParams()
  const observations = useLiveQuery(
    () => (projectId ? listObservations(projectId) : Promise.resolve([] as Observation[])),
    [projectId],
    [],
  )
  const photos = useLiveQuery(
    () => (projectId ? db.photos.where('projectId').equals(projectId).toArray() : Promise.resolve([] as Photo[])),
    [projectId],
    [],
  )
  const marks = useLiveQuery(
    () => (projectId ? db.marks.where('projectId').equals(projectId).toArray() : Promise.resolve([] as Mark[])),
    [projectId],
    [],
  )
  const metrics = useLiveQuery(
    () => (projectId ? db.metrics.where('projectId').equals(projectId).toArray() : Promise.resolve([] as Metric[])),
    [projectId],
    [],
  )

  const [importantOnly, setImportantOnly] = useState(false)

  if (!projectId) return null

  const visible = importantOnly ? observations.filter((item) => item.isImportant) : observations

  const photosByObservation = new Map<string, Photo[]>()
  for (const photo of photos) {
    const list = photosByObservation.get(photo.observationId) ?? []
    list.push(photo)
    photosByObservation.set(photo.observationId, list)
  }

  const groups: Array<{ key: string; label: string; timestamp: number; items: typeof visible }> = []
  for (const observation of visible) {
    const key = dayKey(observation.observedAt)
    const last = groups[groups.length - 1]
    if (last && last.key === key) {
      last.items.push(observation)
    } else {
      groups.push({
        key,
        label: dayLabel(observation.observedAt),
        timestamp: observation.observedAt,
        items: [observation],
      })
    }
  }

  if (observations.length === 0) {
    return (
      <EmptyState
        emoji="🗓️"
        title="История пока пустая"
        description="Здесь появятся все записи по дням: фото, заметки, измерения и пропуски."
        action={
          <Link to={`/p/${projectId}/add`} className={buttonStyles('primary', 'lg')}>
            Добавить первое наблюдение
          </Link>
        }
      />
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-full border border-line bg-surface p-1">
          {[
            { id: false, label: 'Все записи' },
            { id: true, label: 'Только важные' },
          ].map((option) => (
            <button
              key={String(option.id)}
              type="button"
              onClick={() => setImportantOnly(option.id)}
              aria-pressed={importantOnly === option.id}
              className={cn(
                'inline-flex min-h-11 items-center rounded-full px-3.5 py-1.5 text-sm transition-colors',
                importantOnly === option.id
                  ? 'bg-forest-600 text-white'
                  : 'text-muted hover:text-ink',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <Link to={`/p/${projectId}/add`} className={buttonStyles('secondary', 'sm')}>
          + Добавить
        </Link>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          emoji="★"
          title="Важных событий пока нет"
          description="Отмечай важное при добавлении записи — оно появится здесь и пригодится для презентации."
        />
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.key} className="space-y-3">
              <h2 className="font-display text-xl text-ink">{group.label}</h2>
              <div className="space-y-3">
                {group.items.map((observation) => (
                  <ObservationCard
                    key={observation.id}
                    observation={observation}
                    photos={photosByObservation.get(observation.id) ?? []}
                    marks={marks}
                    metrics={metrics}
                    actions={
                      <ObservationActions
                        projectId={projectId}
                        observationId={observation.id}
                      />
                    }
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
