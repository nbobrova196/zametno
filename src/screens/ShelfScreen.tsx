import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type ChangeEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import type { Photo, Project } from '../db/types'
import { getTemplate } from '../domain/templates'
import { daysAgo, daysWord, observationsWord } from '../lib/format'
import { markBackupDone } from '../lib/backup'
import { PhotoImage } from '../components/PhotoImage'
import { Badge, buttonStyles, Card, EmptyState, PageHeader, cn } from '../components/ui'

function ProjectCard({
  project,
  count,
  cover,
}: {
  project: Project
  count: number
  cover?: Photo
}) {
  const template = getTemplate(project.templateId)
  const start = project.startDate ? new Date(project.startDate).getTime() : project.createdAt
  const days = Math.max(1, daysAgo(start) + 1)

  return (
    <Link
      to={`/p/${project.id}`}
      className="group block min-w-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-400 focus-visible:ring-offset-2"
    >
      <Card className="h-full overflow-hidden transition-transform group-hover:-translate-y-0.5">
        <div className="relative h-36 bg-paper">
          {cover ? (
            <PhotoImage
              photo={cover}
              className="h-full w-full object-cover"
              alt={`Обложка проекта «${project.title}»`}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-5xl" aria-hidden="true">
              {template?.emoji ?? '🔎'}
            </div>
          )}
          <span
            className="absolute inset-x-0 top-0 h-1.5"
            style={{ backgroundColor: project.color }}
            aria-hidden="true"
          />
        </div>

        <div className="space-y-2 px-4 py-4">
          <div className="flex items-start justify-between gap-2">
            <h2
              className="line-clamp-3 min-w-0 flex-1 break-words font-display text-xl leading-snug text-ink"
              title={project.title}
            >
              {project.title}
            </h2>
            {project.mode === 'research' ? <Badge tone="green">Исследование</Badge> : null}
          </div>
          {project.subjectName ? (
            <p className="line-clamp-2 break-words text-sm text-muted">{project.subjectName}</p>
          ) : null}
          {project.question ? (
            <p className="line-clamp-3 break-words text-sm leading-relaxed text-ink/80">
              {project.question}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 text-xs text-muted">
            <span>
              {count} {observationsWord(count)}
            </span>
            <span>·</span>
            <span>
              {days} {daysWord(days)}
            </span>
          </div>
        </div>
      </Card>
    </Link>
  )
}

export function ShelfScreen() {
  const navigate = useNavigate()
  const projects = useLiveQuery(() => db.projects.orderBy('updatedAt').reverse().toArray(), [], [])
  const observations = useLiveQuery(() => db.observations.toArray(), [], [])
  const photos = useLiveQuery(() => db.photos.toArray(), [], [])
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [archiveError, setArchiveError] = useState('')
  const [notice, setNotice] = useState('')

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setImporting(true)
    setArchiveError('')
    setNotice('')
    try {
      const { importArchive } = await import('../domain/archive')
      const result = await importArchive(file)
      if (result.bundle) {
        setNotice(`Импортировано проектов: ${result.projectIds.length}. Они уже на полке.`)
      } else if (result.projectIds[0]) {
        navigate(`/p/${result.projectIds[0]}`)
      }
    } catch (error) {
      setArchiveError(
        error instanceof Error ? error.message : 'Не получилось импортировать архив.',
      )
    } finally {
      setImporting(false)
    }
  }

  async function handleExportAll() {
    if (projects.length === 0) return

    setExporting(true)
    setArchiveError('')
    setNotice('')
    try {
      const { downloadBlob, exportAllProjectsArchive } = await import('../domain/archive')
      const { blob, filename } = await exportAllProjectsArchive()
      downloadBlob(blob, filename)

      const now = Date.now()
      for (const project of projects) markBackupDone(project.id, now)

      setNotice(
        `Скачан архив со всеми проектами: «${filename}». Сохрани его в надёжном месте — из него можно восстановить всю полку.`,
      )
    } catch (error) {
      setArchiveError(
        error instanceof Error ? error.message : 'Не получилось собрать архив. Попробуй ещё раз.',
      )
    } finally {
      setExporting(false)
    }
  }

  const counts = new Map<string, number>()
  for (const observation of observations) {
    if (observation.kind === 'skipped') continue
    counts.set(observation.projectId, (counts.get(observation.projectId) ?? 0) + 1)
  }

  const coverByProject = new Map<string, Photo>()
  for (const photo of photos) {
    const current = coverByProject.get(photo.projectId)
    if (!current || current.createdAt < photo.createdAt) coverByProject.set(photo.projectId, photo)
  }

  return (
    <div>
      <PageHeader
        eyebrow="Полка"
        title="Мои наблюдения"
        description="Выбери проект, чтобы продолжить. Или начни новый — с вопроса, на который интересно ответить."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {projects.length > 0 ? (
              <button
                type="button"
                className={buttonStyles('secondary', 'md')}
                onClick={handleExportAll}
                disabled={exporting || importing}
                title="Скачать один ZIP со всеми проектами"
              >
                {exporting ? 'Собираю архив…' : 'Скачать все'}
              </button>
            ) : null}
            <label
              className={cn(
                buttonStyles('secondary', 'md'),
                importing || exporting ? 'pointer-events-none opacity-50' : 'cursor-pointer',
              )}
            >
              {importing ? 'Импортирую…' : 'Импортировать'}
              <input
                type="file"
                accept=".zip,application/zip"
                className="sr-only"
                disabled={importing || exporting}
                onChange={handleImport}
              />
            </label>
            <Link to="/new" className={buttonStyles('primary', 'md')}>
              + Новый проект
            </Link>
          </div>
        }
      />

      {notice ? (
        <p
          className="mb-5 rounded-xl border border-forest-100 bg-forest-50 px-4 py-3 text-sm text-forest-700"
          role="status"
        >
          {notice}
        </p>
      ) : null}

      {archiveError ? (
        <p
          className="mb-5 rounded-xl border border-clay/30 bg-clay/10 px-4 py-3 text-sm text-clay"
          role="alert"
        >
          {archiveError}
        </p>
      ) : null}

      {projects.length === 0 ? (
        <EmptyState
          emoji="🔎"
          title="Здесь пока пусто"
          description="Создай первый проект: выбери тему, задай вопрос и добавляй фотографии с заметками. Изменения станут видны через несколько записей."
          action={
            <Link to="/new" className={buttonStyles('primary', 'lg')}>
              Создать проект
            </Link>
          }
        />
      ) : (
        <div className="grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(min(100%,16rem),1fr))]">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              count={counts.get(project.id) ?? 0}
              cover={coverByProject.get(project.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
