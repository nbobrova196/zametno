import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useParams } from 'react-router-dom'
import { db } from '../db/db'
import type { Mark, Metric, Observation, Photo, Reminder, ReminderLog } from '../db/types'
import { groupPhotosByObservation, listObservations } from '../domain/observations'
import { listReminders } from '../domain/reminderActions'
import { reminderDone, remindersForDate, todayKey } from '../domain/reminders'
import { getLastBackupAt, isBackupStale, daysSinceBackup } from '../lib/backup'
import { importantEventsWord, daysAgo, daysWord, observationsWord } from '../lib/format'
import { useProject } from '../lib/useProject'
import { ObservationCard } from '../components/ObservationCard'
import { ObservationActions } from '../components/ObservationActions'
import { Badge, EmptyState, buttonStyles, Card, Stat } from '../components/ui'

export function ProjectScreen() {
  const { projectId } = useParams()
  const project = useProject(projectId)

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
  const reminders = useLiveQuery(
    () => (projectId ? listReminders(projectId) : Promise.resolve([] as Reminder[])),
    [projectId],
    [],
  )
  const todayLogs = useLiveQuery(
    () => db.reminderLogs.where('date').equals(todayKey()).toArray(),
    [],
    [],
  )

  const [lastBackupAt, setLastBackupAt] = useState<number | null>(null)
  useEffect(() => {
    if (projectId) setLastBackupAt(getLastBackupAt(projectId))
  }, [projectId])

  if (!project || !projectId) return null

  const backupStale = observations.length > 0 && isBackupStale(lastBackupAt)

  const counted = observations.filter((observation) => observation.kind !== 'skipped')
  const important = observations.filter((observation) => observation.isImportant)
  const start = project.startDate ? new Date(project.startDate).getTime() : project.createdAt
  const days = Math.max(1, daysAgo(start) + 1)
  const todayTasks = remindersForDate(reminders, new Date())
  const photosByObservation = groupPhotosByObservation(photos)

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat value={counted.length} label={observationsWord(counted.length)} />
        <Stat value={days} label={daysWord(days)} />
        <Stat value={important.length} label={importantEventsWord(important.length)} />
      </div>

      {backupStale ? (
        <Card className="border-amber-200 bg-amber-100/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-lg text-ink">Пора сохранить копию</h2>
              <p className="mt-0.5 text-sm leading-relaxed text-muted">
                {lastBackupAt
                  ? `Последний архив — ${daysSinceBackup(lastBackupAt)} ${daysWord(
                      daysSinceBackup(lastBackupAt),
                    )} назад. `
                  : 'Резервной копии ещё не было. '}
                Скачай ZIP в настройках: если браузер очистит данные, проект можно будет
                восстановить только из архива.
              </p>
            </div>
            <Link
              to={`/p/${projectId}/settings`}
              className={buttonStyles('secondary', 'sm')}
            >
              К архиву
            </Link>
          </div>
        </Card>
      ) : null}

      {project.status === 'active' && todayTasks.length > 0 ? (
        <Card className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg text-ink">Сегодня по проекту</h2>
              <p className="mt-0.5 text-xs text-muted">
                {todayTasks.length} {todayTasks.length === 1 ? 'дело' : 'дела'} по расписанию
              </p>
            </div>
            <Link to="/today" className={buttonStyles('secondary', 'sm')}>
              Открыть «Сегодня»
            </Link>
          </div>
          <ul className="space-y-2">
            {todayTasks.slice(0, 3).map((reminder) => {
              const done = reminderDone(todayLogs as ReminderLog[], reminder.id, todayKey())
              return (
                <li key={reminder.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <span aria-hidden="true">{reminder.kind === 'care' ? '💧' : '📷'}</span>
                  <span className={done ? 'min-w-0 text-muted line-through' : 'min-w-0 text-ink'}>
                    {reminder.title}
                  </span>
                  <span className="text-xs text-muted">{reminder.time}</span>
                  {done ? <Badge tone="green">Сделано</Badge> : null}
                </li>
              )
            })}
          </ul>
        </Card>
      ) : null}

      {observations.length === 0 ? (
        <EmptyState
          emoji="📷"
          title="Первое наблюдение впереди"
          description="Сфотографируй объект и добавь короткую заметку. Даже «изменений не заметил» — это полезная запись: она покажет, что всё стабильно."
          action={
            <Link to={`/p/${projectId}/add`} className={buttonStyles('primary', 'lg')}>
              Добавить наблюдение
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Link
              to={`/p/${projectId}/add`}
              className="group rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-400"
            >
              <Card className="flex h-full items-start gap-4 p-5 transition-transform group-hover:-translate-y-0.5">
                <span className="text-3xl" aria-hidden="true">📷</span>
                <div>
                  <h2 className="font-display text-xl text-ink">Добавить наблюдение</h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    Фото, заметка, отметки и измерения — за пару минут.
                  </p>
                </div>
              </Card>
            </Link>

            <Link
              to={`/p/${projectId}/compare`}
              className="group rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-400"
            >
              <Card className="flex h-full items-start gap-4 p-5 transition-transform group-hover:-translate-y-0.5">
                <span className="text-3xl" aria-hidden="true">🎞️</span>
                <div>
                  <h2 className="font-display text-xl text-ink">Сравнить фото</h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    Поставь два снимка рядом и посмотри, что изменилось.
                  </p>
                </div>
              </Card>
            </Link>
          </div>

          <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-display text-2xl text-ink">Последние записи</h2>
              <Link
                to={`/p/${projectId}/history`}
                className="text-sm font-medium text-forest-700 underline decoration-forest-200 underline-offset-4"
              >
                Вся история
              </Link>
            </div>

            <div className="space-y-3">
              {observations.slice(0, 3).map((observation) => (
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
        </>
      )}
    </div>
  )
}
