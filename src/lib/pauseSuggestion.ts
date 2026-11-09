import type { Observation, Project } from '../db/types'

/** Через сколько дней без записей мягко предложить паузу. */
export const PAUSE_AFTER_DAYS = 14
/** Сколько дней не повторять предложение после «Продолжаю». */
export const PAUSE_SNOOZE_DAYS = 14

const DAY = 86_400_000
const SNOOZE_PREFIX = 'zametno:pause-snooze:'

type ActivityProject = Pick<Project, 'status' | 'createdAt'>
type ActivityObservation = Pick<Observation, 'observedAt' | 'createdAt'>

/** Последняя активность: запись наблюдения или создание проекта. */
export function lastEntryAt(project: Pick<Project, 'createdAt'>, observations: ActivityObservation[]) {
  return observations.reduce(
    (latest, observation) => Math.max(latest, observation.observedAt, observation.createdAt),
    project.createdAt,
  )
}

/** Сколько полных дней прошло с последней записи. */
export function daysWithoutEntries(
  project: Pick<Project, 'createdAt'>,
  observations: ActivityObservation[],
  now = Date.now(),
) {
  return Math.max(0, Math.floor((now - lastEntryAt(project, observations)) / DAY))
}

export function shouldSuggestPause(
  project: ActivityProject,
  observations: ActivityObservation[],
  snoozedUntil: number | null = null,
  now = Date.now(),
) {
  if (project.status !== 'active') return false
  if (snoozedUntil && now < snoozedUntil) return false
  return daysWithoutEntries(project, observations, now) >= PAUSE_AFTER_DAYS
}

export function getPauseSnoozeUntil(projectId: string, now = Date.now()) {
  try {
    const raw = window.localStorage.getItem(SNOOZE_PREFIX + projectId)
    const value = raw ? Number(raw) : 0
    return Number.isFinite(value) && value > now ? value : null
  } catch {
    return null
  }
}

export function snoozePauseSuggestion(projectId: string, now = Date.now()) {
  try {
    window.localStorage.setItem(SNOOZE_PREFIX + projectId, String(now + PAUSE_SNOOZE_DAYS * DAY))
  } catch {
    // Подсказка — вспомогательная функция: без localStorage просто не запоминаем отказ.
  }
}
