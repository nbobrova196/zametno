import { NavLink, Outlet, useParams } from 'react-router-dom'
import { useProject } from '../lib/useProject'
import { getTemplate } from '../domain/templates'
import { Badge, Card, buttonStyles, cn } from '../components/ui'

const tabs = [
  { to: '', label: 'Обзор', end: true },
  { to: 'history', label: 'История', end: false },
  { to: 'compare', label: 'Сравнение', end: false },
  { to: 'reminders', label: 'Напоминания', end: false },
  { to: 'summary', label: 'Итог', end: false },
  { to: 'settings', label: 'Настройки', end: false },
]

export function ProjectLayout() {
  const { projectId } = useParams()
  const project = useProject(projectId)

  if (project === undefined) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-line" />
        <div className="h-4 w-96 animate-pulse rounded bg-line" />
        <div className="h-40 animate-pulse rounded-2xl bg-line" />
      </div>
    )
  }

  if (project === null) {
    return (
      <Card className="p-8 text-center">
        <p className="text-3xl" aria-hidden="true">🫥</p>
        <h1 className="mt-3 font-display text-2xl">Проект не найден</h1>
        <p className="mt-2 text-sm text-muted">
          Возможно, он был удалён или открыт на другом устройстве.
        </p>
        <NavLink to="/" className={buttonStyles('secondary', 'md', 'mt-5')}>
          На полку
        </NavLink>
      </Card>
    )
  }

  const template = getTemplate(project.templateId)
  const base = `/p/${project.id}`

  return (
    <div>
      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>{template?.emoji}</span>
          <span>{template?.title}</span>
          {project.status === 'completed' ? <Badge tone="green">Завершён</Badge> : null}
          {project.status === 'paused' ? <Badge tone="amber">Пауза</Badge> : null}
          {project.mode === 'research' ? <Badge tone="green">Исследование</Badge> : null}
        </div>

        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 max-w-2xl space-y-1.5">
            <h1 className="break-words font-display text-3xl leading-tight text-ink xl:text-4xl">{project.title}</h1>
            {project.subjectName ? (
              <p className="break-words text-sm text-muted">{project.subjectName}</p>
            ) : null}
            {project.question ? (
              <p className="break-words text-base leading-relaxed text-ink/80">{project.question}</p>
            ) : null}
          </div>
          <NavLink to={`${base}/add`} className={buttonStyles('primary', 'lg', 'self-start xl:self-auto')}>
            + Наблюдение
          </NavLink>
        </div>
      </div>

      <nav className="mb-7 flex gap-1 overflow-x-auto border-b border-line pb-px" aria-label="Разделы проекта">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to ? `${base}/${tab.to}` : base}
            end={tab.end}
            className={({ isActive }) =>
              cn(
                'inline-flex min-h-11 shrink-0 items-center rounded-t-lg px-4 py-2.5 text-sm transition-colors',
                isActive
                  ? 'border-b-2 border-forest-600 font-medium text-forest-700'
                  : 'border-b-2 border-transparent text-muted hover:text-ink',
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  )
}
