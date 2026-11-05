import { useMemo, useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { Reminder, ReminderKind } from '../db/types'
import {
  clearReminderSnooze,
  createReminder,
  deleteReminder,
  listReminderLogs,
  listReminders,
  setReminderActive,
  updateReminder,
} from '../domain/reminderActions'
import {
  WEEKDAYS,
  careHistory,
  nextReminderDate,
  todayKey,
  weekdayIds,
  weekdaySummary,
} from '../domain/reminders'
import { dayLabel, formatTime } from '../lib/format'
import { useProject } from '../lib/useProject'
import { Badge, Button, Card, EmptyState, Field, Input, cn } from '../components/ui'

interface FormState {
  kind: ReminderKind
  title: string
  weekdays: number[]
  time: string
  startDate: string
  endDate: string
}

function emptyForm(): FormState {
  return {
    kind: 'observation',
    title: '',
    weekdays: weekdayIds(),
    time: '09:00',
    startDate: todayKey(),
    endDate: '',
  }
}

function formFromReminder(reminder: Reminder): FormState {
  return {
    kind: reminder.kind,
    title: reminder.title,
    weekdays: reminder.weekdays,
    time: reminder.time,
    startDate: reminder.startDate,
    endDate: reminder.endDate ?? '',
  }
}

const kindMeta: Record<ReminderKind, { emoji: string; title: string; description: string; placeholder: string }> = {
  observation: {
    emoji: '📷',
    title: 'Наблюдение',
    description: 'Напомнить сделать фото, заметку или измерение.',
    placeholder: 'Например: сфотографировать растение',
  },
  care: {
    emoji: '💧',
    title: 'Уход',
    description: 'Полить, покормить или сделать другое привычное дело.',
    placeholder: 'Например: полить фасоль',
  },
}

function nextDateLabel(reminder: Reminder) {
  if (!reminder.active) return 'Напоминание на паузе'
  if (reminder.endDate && todayKey() > reminder.endDate) return 'Расписание закончилось'

  const next = nextReminderDate(reminder)
  if (!next) return 'Нет ближайшей даты'

  const label = dayLabel(next.getTime()).toLowerCase()
  if (label === 'сегодня' || label === 'вчера') {
    return `Ближайшее: ${label}`
  }
  return `Ближайшее: ${format(next, 'd MMMM', { locale: ru })}`
}

export function RemindersScreen() {
  const { projectId } = useParams()
  const project = useProject(projectId)

  const reminders = useLiveQuery(
    () => (projectId ? listReminders(projectId) : Promise.resolve([] as Reminder[])),
    [projectId],
  )
  const logs = useLiveQuery(
    () => (projectId ? listReminderLogs(projectId) : Promise.resolve([])),
    [projectId],
  )

  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string>()
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<string>()

  const careLogs = useMemo(
    () => careHistory(logs ?? [], reminders ?? []),
    [logs, reminders],
  )

  if (!project || !projectId || !reminders || !logs) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-6 w-56 animate-pulse rounded bg-line" />
        <div className="h-40 animate-pulse rounded-2xl bg-line" />
      </div>
    )
  }

  function openNew() {
    setEditingId(undefined)
    setForm(emptyForm())
    setError('')
    setOpen(true)
  }

  function openEdit(reminder: Reminder) {
    setEditingId(reminder.id)
    setForm(formFromReminder(reminder))
    setError('')
    setOpen(true)
  }

  function closeForm() {
    setOpen(false)
    setEditingId(undefined)
    setError('')
  }

  function patchForm(patch: Partial<FormState>) {
    setForm((current) => ({ ...current, ...patch }))
  }

  function toggleDay(day: number) {
    setForm((current) => ({
      ...current,
      weekdays: current.weekdays.includes(day)
        ? current.weekdays.filter((item) => item !== day)
        : [...current.weekdays, day].sort((a, b) => a - b),
    }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!projectId) return
    if (!form.title.trim()) {
      setError('Напиши коротко, о чём напомнить.')
      return
    }
    if (form.weekdays.length === 0) {
      setError('Выбери хотя бы один день недели.')
      return
    }
    if (form.endDate && form.endDate < form.startDate) {
      setError('Последний день не может быть раньше первого.')
      return
    }

    setSaving(true)
    setError('')
    try {
      if (editingId) {
        await updateReminder(editingId, {
          kind: form.kind,
          title: form.title.trim(),
          weekdays: form.weekdays,
          time: form.time,
          startDate: form.startDate,
          endDate: form.endDate || undefined,
        })
      } else {
        await createReminder({
          projectId,
          kind: form.kind,
          title: form.title,
          weekdays: form.weekdays,
          time: form.time,
          startDate: form.startDate,
          endDate: form.endDate || undefined,
        })
      }
      closeForm()
    } catch {
      setError('Не получилось сохранить напоминание. Попробуй ещё раз.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(reminderId: string) {
    await deleteReminder(reminderId)
    setDeletingId(undefined)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-ink">Расписание проекта</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Напомним в выбранные дни. Сделать задачу можно на экране «Сегодня» — даже если
            уведомление не пришло.
          </p>
        </div>
        <Button onClick={openNew} size="lg">
          + Напоминание
        </Button>
      </div>

      <Card className="border-forest-100 bg-forest-50 p-4">
        <p className="text-sm leading-relaxed text-forest-700">
          Уведомление браузера может появиться, только пока «Заметно» открыто. Расписание и список
          дел в разделе «Сегодня» работают всегда. На Android и компьютере можно разрешить
          уведомления на экране «Сегодня».
        </p>
      </Card>

      {open ? (
        <Card className="space-y-5 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-xl text-ink">
                {editingId ? 'Изменить напоминание' : 'Новое напоминание'}
              </h3>
              <p className="mt-1 text-sm text-muted">Это займёт меньше минуты.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={closeForm}>
              Закрыть
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(kindMeta) as ReminderKind[]).map((kind) => {
                const meta = kindMeta[kind]
                const active = form.kind === kind
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => patchForm({ kind })}
                    aria-pressed={active}
                    className={cn(
                      'rounded-xl border p-3.5 text-left transition-colors',
                      active
                        ? 'border-forest-400 bg-forest-50'
                        : 'border-line bg-surface hover:border-forest-200',
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-ink">
                      <span aria-hidden="true">{meta.emoji}</span>
                      {meta.title}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted">
                      {meta.description}
                    </span>
                  </button>
                )
              })}
            </div>

            <Field label="О чём напомнить" htmlFor="reminder-title">
              <Input
                id="reminder-title"
                value={form.title}
                onChange={(event) => patchForm({ title: event.target.value })}
                placeholder={kindMeta[form.kind].placeholder}
                maxLength={120}
              />
            </Field>

            <div className="space-y-2">
              <span className="block text-sm font-medium text-ink">Дни недели</span>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((weekday) => {
                  const active = form.weekdays.includes(weekday.id)
                  return (
                    <button
                      key={weekday.id}
                      type="button"
                      onClick={() => toggleDay(weekday.id)}
                      aria-pressed={active}
                      aria-label={weekday.label}
                      className={cn(
                        'min-h-11 min-w-11 rounded-full border px-3 py-2 text-sm transition-colors',
                        active
                          ? 'border-forest-600 bg-forest-600 text-white'
                          : 'border-line bg-surface text-muted hover:border-forest-300',
                      )}
                    >
                      {weekday.short}
                    </button>
                  )
                })}
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => patchForm({ weekdays: weekdayIds() })}
                  className="text-forest-700 underline decoration-forest-200 underline-offset-4"
                >
                  Каждый день
                </button>
                <button
                  type="button"
                  onClick={() => patchForm({ weekdays: [1, 2, 3, 4, 5] })}
                  className="text-forest-700 underline decoration-forest-200 underline-offset-4"
                >
                  По будням
                </button>
                <button
                  type="button"
                  onClick={() => patchForm({ weekdays: [6, 7] })}
                  className="text-forest-700 underline decoration-forest-200 underline-offset-4"
                >
                  По выходным
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Время" htmlFor="reminder-time">
                <Input
                  id="reminder-time"
                  type="time"
                  value={form.time}
                  onChange={(event) => patchForm({ time: event.target.value })}
                  required
                />
              </Field>
              <Field label="Первый день" htmlFor="reminder-start">
                <Input
                  id="reminder-start"
                  type="date"
                  value={form.startDate}
                  onChange={(event) => patchForm({ startDate: event.target.value })}
                  required
                />
              </Field>
            </div>

            <Field
              label="Последний день"
              htmlFor="reminder-end"
              hint="Необязательно. После этой даты напоминание замолчит."
            >
              <Input
                id="reminder-end"
                type="date"
                value={form.endDate}
                min={form.startDate || undefined}
                onChange={(event) => patchForm({ endDate: event.target.value })}
              />
            </Field>

            {error ? (
              <p
                className="rounded-xl border border-clay/30 bg-clay/10 px-4 py-3 text-sm text-clay"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" size="lg" disabled={saving}>
                {saving ? 'Сохраняю…' : editingId ? 'Сохранить' : 'Добавить'}
              </Button>
              <Button type="button" variant="secondary" onClick={closeForm}>
                Отмена
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {reminders.length === 0 ? (
        <EmptyState
          emoji="⏰"
          title="Расписание пока не настроено"
          description="Добавь напоминание о наблюдении или уходе. Оно появится на экране «Сегодня» и в карточке проекта."
          action={
            <Button onClick={openNew} size="lg">
              Настроить напоминание
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {reminders.map((reminder) => {
            const meta = kindMeta[reminder.kind]
            const snoozed = Boolean(reminder.snoozedUntil && reminder.snoozedUntil >= todayKey())
            return (
              <Card key={reminder.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <span className="text-2xl" aria-hidden="true">
                      {meta.emoji}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-lg text-ink">{reminder.title}</h3>
                        <Badge tone={reminder.kind === 'care' ? 'amber' : 'green'}>
                          {meta.title}
                        </Badge>
                        {!reminder.active ? <Badge tone="neutral">Пауза</Badge> : null}
                        {snoozed ? <Badge tone="amber">Перенесено</Badge> : null}
                      </div>
                      <p className="mt-1 text-sm text-muted">
                        {weekdaySummary(reminder.weekdays)} · {reminder.time}
                      </p>
                      <p className="mt-1 text-xs text-muted">{nextDateLabel(reminder)}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <Button variant="secondary" size="sm" onClick={() => openEdit(reminder)}>
                      Изменить
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void setReminderActive(reminder.id, !reminder.active)}
                    >
                      {reminder.active ? 'Пауза' : 'Включить'}
                    </Button>
                    {snoozed ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void clearReminderSnooze(reminder.id)}
                      >
                        Вернуть на сегодня
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeletingId(reminder.id)}
                    >
                      Удалить
                    </Button>
                  </div>
                </div>

                {deletingId === reminder.id ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-clay/20 bg-clay/5 p-3">
                    <p className="mr-auto text-sm text-muted">
                      Удалить напоминание и его отметки?
                    </p>
                    <Button variant="danger" size="sm" onClick={() => void handleDelete(reminder.id)}>
                      Да, удалить
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setDeletingId(undefined)}>
                      Оставить
                    </Button>
                  </div>
                ) : null}
              </Card>
            )
          })}
        </div>
      )}

      {careLogs.length > 0 ? (
        <Card className="space-y-3 p-5">
          <div>
            <h3 className="font-display text-xl text-ink">История ухода</h3>
            <p className="mt-1 text-sm text-muted">Последние выполненные дела по этому проекту.</p>
          </div>
          <ul className="divide-y divide-line">
            {careLogs.map(({ log, reminder }) => (
              <li key={log.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
                <span className="text-sm font-medium text-ink">{reminder?.title ?? 'Уход'}</span>
                <span className="text-xs text-muted">
                  {format(parseISO(log.date), 'd MMMM', { locale: ru })}, {formatTime(log.completedAt)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <p className="text-sm text-muted">
        Посмотреть задачи на сегодня можно{' '}
        <Link
          to="/today"
          className="font-medium text-forest-700 underline decoration-forest-200 underline-offset-4"
        >
          на экране «Сегодня»
        </Link>
        .
      </p>
    </div>
  )
}
