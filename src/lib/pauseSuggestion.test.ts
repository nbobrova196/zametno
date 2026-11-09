import { describe, expect, it } from 'vitest'
import {
  PAUSE_AFTER_DAYS,
  daysWithoutEntries,
  lastEntryAt,
  shouldSuggestPause,
} from './pauseSuggestion'

const DAY = 86_400_000
const now = Date.UTC(2026, 10, 9, 12)

function project(status: 'active' | 'paused' | 'completed' = 'active', createdAt = now - 30 * DAY) {
  return { status, createdAt }
}

function entry(observedAt: number, createdAt = observedAt) {
  return { observedAt, createdAt }
}

describe('подсказка о паузе', () => {
  it('считает последнюю активность по самой свежей записи', () => {
    expect(lastEntryAt(project('active', 1), [entry(5), entry(9), entry(3)])).toBe(9)
    expect(lastEntryAt(project('active', 1), [])).toBe(1)
  })

  it('считает полные дни без записей', () => {
    expect(daysWithoutEntries(project('active', now - 20 * DAY), [], now)).toBe(20)
    expect(daysWithoutEntries(project('active', now - 30 * DAY), [entry(now - 3 * DAY)], now)).toBe(3)
    expect(daysWithoutEntries(project('active', now), [], now)).toBe(0)
  })

  it('предлагает паузу только активному проекту после 14 дней', () => {
    expect(shouldSuggestPause(project('active', now - 13 * DAY), [], null, now)).toBe(false)
    expect(shouldSuggestPause(project('active', now - PAUSE_AFTER_DAYS * DAY), [], null, now)).toBe(true)
    expect(shouldSuggestPause(project('paused', now - 30 * DAY), [], null, now)).toBe(false)
    expect(shouldSuggestPause(project('completed', now - 30 * DAY), [], null, now)).toBe(false)
  })

  it('не предлагает паузу, пока действует отсрочка', () => {
    expect(shouldSuggestPause(project('active', now - 30 * DAY), [], now + DAY, now)).toBe(false)
    expect(shouldSuggestPause(project('active', now - 30 * DAY), [], now - DAY, now)).toBe(true)
  })

  it('не предлагает паузу, если недавно была запись', () => {
    expect(
      shouldSuggestPause(project('active', now - 60 * DAY), [entry(now - 2 * DAY)], null, now),
    ).toBe(false)
  })
})
