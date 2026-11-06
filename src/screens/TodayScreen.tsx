import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { addDays, format, parseISO, startOfWeek } from 'date-fns'
import { ru } from 'date-fns/locale'
import { db } from '../db/db'
import type { Project, Reminder, ReminderLog } from '../db/types'
import {
  completeReminder,
  removeReminderLog,
  snoozeReminder,
} from '../domain/reminderActions'
import {
  nextReminderDate,
  reminderDone,
  remindersForDate,
  todayKey,
} from '../domain/reminders'
import { dayKey } from '../lib/format'
import {
  notificationPermission,
  notificationsSupported,
  requestNotificationPermission,
  useScheduledNotifications,
} from '../lib/notifications'
import { Badge, Button, Card, EmptyState, PageHeader, buttonStyles, cn } from '../components/ui'

const kindMeta = {
  observation: { emoji: '📷', label: 'Наблюдение' },
  care: { emoji: '💧', label: 'Уход' },
} as const

type Permission = ReturnType<typeof notificationPermission>

export function TodayScreen() {
  const [selectedKey, setSelectedKey] = useState(todayKey())
  const [permission, setPermission] = useState<Permission>(notificationPermission())

  const projects = useLiveQuery(() => db.projects.orderBy('updatedAt').reverse().toArray(), [])
  const reminders = useLiveQuery(() => db.reminders.toArray(), [])
  const logs = useLiveQuery(
    () => db.reminderLogs.where('date').equals(selectedKey).toArray(),
    [selectedKey],
  )

  const selectedDate = useMemo(() => parseISO(selectedKey), [selectedKey])
  const isToday = selectedKey === todayKey()
  const isPast = selectedKey < todayKey()
  const isFuture = selectedKey > todayKey()

  const activeProjects = useMemo(
    () => (projects ?? []).filter((project) => project.status === 'active'),
    [projects],
  )
  const activeIds = useMemo(
    () => new Set(activeProjects.map((project) => project.id)),
    [activeProjects],
  )

  const weekDays = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, index) => addDays(start, index))
  }, [])

  const dayCounts = useMemo(() => {
    const all = reminders ?? []
    return new Map(
      weekDays.map((day) => [
        dayKey(day.getTime()),
        remindersForDate(all, day).filter((reminder) => activeIds.has(reminder.projectId)).length,
      ]),
    )
  }, [reminders, weekDays, activeIds])

  const dueReminders = useMemo(
    () =>
      remindersForDate(reminders ?? [], selectedDate).filter((reminder) =>
        activeIds.has(reminder.projectId),
      ),
    [reminders, selectedDate, activeIds],
  )

  const groups = useMemo(() => {
    const projectsById = new Map(activeProjects.map((project) => [project.id, project]))
    const byProject = new Map<string, Reminder[]>()

    for (const reminder of dueReminders) {
      const list = byProject.get(reminder.projectId) ?? []
      list.push(reminder)
      byProject.set(reminder.projectId, list)
    }

    return [...byProject.entries()]
      .map(([projectId, tasks]) => ({
        project: projectsById.get(projectId),
        tasks,
      }))
      .filter((group): group is { project: Project; tasks: Reminder[] } => Boolean(group.project))
  }, [dueReminders, activeProjects])

  const upcoming = useMemo(() => {
    const items: Array<{ project: Project; reminder: Reminder; date: Date }> = []
    for (const project of activeProjects) {
      for (const reminder of (reminders ?? []).filter(
        (item) => item.projectId === project.id && item.active,
      )) {
        const date = nextReminderDate(reminder)
        if (!date) continue
        if (dayKey(date.getTime()) === selectedKey) continue
        items.push({ project, reminder, date })
      }
    }
    return items
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 5)
  }, [activeProjects, reminders, selectedKey])

  const notificationItems = useMemo(() => {
    if (!isToday) return []
    return dueReminders
      .filter((reminder) => !reminderDone((logs ?? []) as ReminderLog[], reminder.id, selectedKey))
      .map((reminder) => {
        const project = activeProjects.find((item) => item.id === reminder.projectId)
        const [hours, minutes] = reminder.time.split(':').map(Number)
        const at = new Date(selectedDate)
        at.setHours(hours || 0, minutes || 0, 0, 0)
        return {
          id: `${reminder.id}-${selectedKey}`,
          title: project?.title ?? 'Заметно',
          body: reminder.title,
          at: at.getTime(),
        }
      })
  }, [isToday, dueReminders, logs, selectedKey, activeProjects, selectedDate])

  useScheduledNotifications(notificationItems, permission === 'granted')

  async function enableNotifications() {
    const result = await requestNotificationPermission()
    setPermission(result === 'unsupported' ? 'unsupported' : result)
  }

  async function markDone(reminder: Reminder) {
    await completeReminder({
      reminderId: reminder.id,
      projectId: reminder.projectId,
      date: selectedKey,
    })
  }

  async function undoDone(reminder: Reminder) {
    await removeReminderLog(reminder.id, selectedKey)
  }

  if (!projects || !reminders || !logs) {
    return (
      <div className="mx-auto max-w-4xl space-y-4" aria-busy="true">
        <div className="h-8 w-56 animate-pulse rounded bg-line" />
        <div className="h-24 animate-pulse rounded-2xl bg-line" />
        <div className="h-40 animate-pulse rounded-2xl bg-line" />
      </div>
    )
  }

  const selectedLabel = isToday
    ? 'Сегодня'
    : format(selectedDate, 'EEEE, d MMMM', { locale: ru })
  const firstProject = activeProjects[0]

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="Расписание"
        title={selectedLabel}
        description="Короткий список дел по активным проектам. Отмечай сделанное — история ухода сохранится."
        actions={
          <div className="flex flex-wrap gap-2">
            {!isToday ? (
              <Button variant="secondary" size="md" onClick={() => setSelectedKey(todayKey())}>
                Сегодня
              </Button>
            ) : null}
            <Link to="/" className={buttonStyles('secondary', 'md')}>
              К проектам
            </Link>
          </div>
        }
      />

      <Card className="mb-5 p-3">
        <p className="mb-2 px-1 text-xs font-medium text-muted">Эта неделя</p>
        <div className="grid grid-cols-7 gap-1.5">
          {weekDays.map((day) => {
            const key = dayKey(day.getTime())
            const active = key === selectedKey
            const today = key === todayKey()
            const count = dayCounts.get(key) ?? 0
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedKey(key)}
                aria-pressed={active}
                aria-label={format(day, 'd MMMM, EEEE', { locale: ru })}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-xl border px-1 py-2.5 transition-colors',
                  active
                    ? 'border-forest-600 bg-forest-600 text-white'
                    : 'border-transparent text-muted hover:border-forest-200 hover:bg-forest-50',
                )}
              >
                <span className={cn('text-[11px] uppercase', active ? 'text-white/80' : 'text-muted')}>
                  {format(day, 'EEEEEE', { locale: ru })}
                </span>
                <span
                  className={cn(
                    'font-display text-xl leading-none',
                    active ? 'text-white' : today ? 'text-forest-700' : 'text-ink',
                  )}
                >
                  {format(day, 'd')}
                </span>
                <span
                  className={cn(
                    'grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] leading-none',
                    count > 0
                      ? active
                        ? 'bg-white/20 text-white'
                        : 'bg-forest-100 text-forest-700'
                      : 'text-transparent',
                  )}
                  aria-hidden="true"
                >
                  {count > 0 ? count : '·'}
                </span>
              </button>
            )
          })}
        </div>
      </Card>

      {notificationsSupported() ? (
        <Card className="mb-5 space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium text-ink">Уведомления</h2>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">
                Работают, только пока приложение открыто. Это ограничение браузера, не приложения.
              </p>
            </div>
            {permission === 'granted' ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="green">Включены</Badge>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    new Notification('Заметно', {
                      body: 'Уведомления работают. Задачи на день — в этом списке.',
                      icon: '/icons/icon-192.png',
                    })
                  }
                >
                  Проверить
                </Button>
              </div>
            ) : permission === 'denied' ? (
              <span className="text-xs text-muted">
                Запрещены в настройках браузера — список дел всё равно работает.
              </span>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => void enableNotifications()}>
                Включить уведомления
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <Card className="mb-5 p-4">
          <p className="text-sm leading-relaxed text-muted">
            Этот браузер не поддерживает уведомления. Экран «Сегодня» и расписание работают без них.
          </p>
        </Card>
      )}

      {activeProjects.length === 0 ? (
        <EmptyState
          emoji="🌤️"
          title="Нет активных проектов"
          description="Все проекты на паузе или завершены. Верни проект в работу, чтобы снова увидеть задачи."
          action={
            <Link to="/" className={buttonStyles('primary', 'lg')}>
              На полку
            </Link>
          }
        />
      ) : groups.length === 0 ? (
        <EmptyState
          emoji={isFuture ? '🗓️' : '🍃'}
          title={
            isFuture
              ? 'На этот день пока пусто'
              : isPast
                ? 'Задач не было'
                : 'На сегодня задач нет'
          }
          description={
            isFuture
              ? 'Можно посмотреть расписание проекта и добавить напоминание на этот день.'
              : isPast
                ? 'В этот день напоминаний не было. Выбери другой день недели или вернись к сегодняшнему.'
                : 'Это нормально: напоминания помогают, но не заменяют наблюдения. Можно добавить запись в любой момент.'
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link to="/" className={buttonStyles('secondary', 'md')}>
                Выбрать проект
              </Link>
              {firstProject ? (
                <Link
                  to={`/p/${firstProject.id}/reminders`}
                  className={buttonStyles('primary', 'md')}
                >
                  Настроить напоминания
                </Link>
              ) : null}
            </div>
          }
        />
      ) : (
        <div className="space-y-4">
          {groups.map(({ project, tasks }) => (
            <Card key={project.id} className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
                <Link
                  to={`/p/${project.id}`}
                  className="min-w-0 break-words font-display text-lg text-ink underline decoration-transparent underline-offset-4 hover:decoration-forest-300"
                >
                  {project.title}
                </Link>
                <span className="text-xs text-muted">
                  {tasks.length} {tasks.length === 1 ? 'дело' : 'дела'}
                </span>
              </div>

              <ul className="divide-y divide-line">
                {tasks.map((reminder) => {
                  const meta = kindMeta[reminder.kind]
                  const done = reminderDone(logs, reminder.id, selectedKey)
                  return (
                    <li key={reminder.id} className="space-y-3 px-4 py-4">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl" aria-hidden="true">
                          {meta.emoji}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-ink">{reminder.title}</p>
                            {done ? <Badge tone="green">Сделано</Badge> : null}
                          </div>
                          <p className="mt-0.5 text-xs text-muted">
                            {reminder.time} · {meta.label}
                          </p>
                        </div>
                      </div>

                      {isFuture ? (
                        <p className="text-xs text-muted">Задача появится в этот день.</p>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          {reminder.kind === 'observation' ? (
                            <Link
                              to={`/p/${project.id}/add?reminder=${reminder.id}&date=${selectedKey}`}
                              className={buttonStyles('primary', 'sm')}
                            >
                              Добавить наблюдение
                            </Link>
                          ) : null}

                          {done ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => void undoDone(reminder)}
                            >
                              Отменить
                            </Button>
                          ) : (
                            <>
                              <Button
                                variant={reminder.kind === 'care' ? 'primary' : 'secondary'}
                                size="sm"
                                onClick={() => void markDone(reminder)}
                              >
                                Сделано
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => void snoozeReminder(reminder.id)}
                              >
                                Перенести на завтра
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </Card>
          ))}
        </div>
      )}

      {upcoming.length > 0 ? (
        <Card className="mt-5 space-y-3 p-5">
          <div>
            <h2 className="font-display text-xl text-ink">Дальше по расписанию</h2>
            <p className="mt-1 text-sm text-muted">Ближайшие напоминания по активным проектам.</p>
          </div>
          <ul className="divide-y divide-line">
            {upcoming.map(({ project, reminder, date }) => (
              <li
                key={`${reminder.id}-${dayKey(date.getTime())}`}
                className="flex flex-wrap items-baseline justify-between gap-2 py-2.5"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink">{reminder.title}</span>
                  <span className="block text-xs text-muted">{project.title}</span>
                </span>
                <span className="text-xs text-muted">
                  {format(date, 'd MMMM, EEEEEE', { locale: ru })} · {reminder.time}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  )
}
