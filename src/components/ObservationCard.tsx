import type { Mark, Metric, Observation, Photo } from '../db/types'
import { dayLabel, formatNumber, formatTime } from '../lib/format'
import { PhotoImage } from './PhotoImage'
import { Badge, Card } from './ui'

const kindLabel: Record<Observation['kind'], string | null> = {
  observation: null,
  no_changes: 'Изменений не заметил',
  skipped: 'Не наблюдал',
  care: 'Уход',
}

export function ObservationCard({
  observation,
  photos,
  marks,
  metrics,
}: {
  observation: Observation
  photos: Photo[]
  marks: Mark[]
  metrics: Metric[]
}) {
  const marksById = new Map(marks.map((mark) => [mark.id, mark]))
  const metricsById = new Map(metrics.map((metric) => [metric.id, metric]))
  const label = kindLabel[observation.kind]
  const hasBody =
    photos.length > 0 ||
    Boolean(observation.note) ||
    observation.markIds.length > 0 ||
    observation.measurements.length > 0

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-ink">{dayLabel(observation.observedAt)}</span>
          <span className="text-xs text-muted">{formatTime(observation.observedAt)}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {observation.isImportant ? <Badge tone="amber">★ Важное</Badge> : null}
          {label ? <Badge tone={observation.kind === 'no_changes' ? 'amber' : 'neutral'}>{label}</Badge> : null}
        </div>
      </div>

      {hasBody ? (
        <div className="space-y-3 px-4 py-4">
          {photos.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {photos.slice(0, 4).map((photo) => (
                <PhotoImage
                  key={photo.id}
                  photo={photo}
                  className="aspect-[4/3] w-full rounded-xl object-cover"
                />
              ))}
            </div>
          ) : null}

          {observation.note ? (
            <p className="text-sm leading-relaxed whitespace-pre-line text-ink">{observation.note}</p>
          ) : null}

          {observation.markIds.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {observation.markIds.map((id) => {
                const mark = marksById.get(id)
                return mark ? <Badge key={id} tone="green">{mark.label}</Badge> : null
              })}
            </div>
          ) : null}

          {observation.measurements.length > 0 ? (
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
              {observation.measurements.map((measurement) => {
                const metric = metricsById.get(measurement.metricId)
                if (!metric) return null
                return (
                  <span key={measurement.metricId} className="text-muted">
                    {metric.name}: <span className="font-medium text-ink">{formatNumber(measurement.value)} {metric.unit}</span>
                  </span>
                )
              })}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="px-4 py-3 text-sm text-muted">
          Запись без подробностей — главное, что день отмечен.
        </div>
      )}
    </Card>
  )
}
