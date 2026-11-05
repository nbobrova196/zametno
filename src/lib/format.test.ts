import { describe, expect, it } from 'vitest'
import { importantEventsWord, metricsWord, observationsWord } from './format'

describe('русские склонения', () => {
  it('склоняет «показатель»', () => {
    expect(metricsWord(1)).toBe('показатель')
    expect(metricsWord(2)).toBe('показателя')
    expect(metricsWord(5)).toBe('показателей')
    expect(metricsWord(11)).toBe('показателей')
    expect(metricsWord(21)).toBe('показатель')
  })

  it('склоняет «важное событие»', () => {
    expect(importantEventsWord(1)).toBe('важное событие')
    expect(importantEventsWord(2)).toBe('важных события')
    expect(importantEventsWord(5)).toBe('важных событий')
  })

  it('склоняет «наблюдение»', () => {
    expect(observationsWord(1)).toBe('наблюдение')
    expect(observationsWord(3)).toBe('наблюдения')
    expect(observationsWord(12)).toBe('наблюдений')
  })
})
