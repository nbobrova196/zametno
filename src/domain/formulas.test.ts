import { describe, expect, it } from 'vitest'
import { FORMULAS, FORMULA_SOURCES, FORMULA_SUBJECTS, formulaToText } from './formulas'

describe('справочник формул', () => {
  it('не содержит повторяющихся идентификаторов', () => {
    const ids = FORMULAS.map((formula) => formula.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('у каждой формулы заполнены название, выражение, обозначения и единицы', () => {
    for (const formula of FORMULAS) {
      expect(formula.title.trim().length, formula.id).toBeGreaterThan(0)
      expect(formula.expression.trim().length, formula.id).toBeGreaterThan(0)
      expect(formula.legend.trim().length, formula.id).toBeGreaterThan(0)
      expect(formula.units.trim().length, formula.id).toBeGreaterThan(0)
      expect(formula.topic.trim().length, formula.id).toBeGreaterThan(0)
    }
  })

  it('ссылается только на существующие проверенные источники', () => {
    const sourceIds = new Set(FORMULA_SOURCES.map((source) => source.id))
    for (const formula of FORMULAS) {
      expect(formula.sourceIds.length, formula.id).toBeGreaterThan(0)
      for (const sourceId of formula.sourceIds) {
        expect(sourceIds.has(sourceId), `${formula.id} → ${sourceId}`).toBe(true)
      }
    }
  })

  it('использует только известные разделы', () => {
    const subjects = new Set(FORMULA_SUBJECTS.map((subject) => subject.id))
    for (const formula of FORMULAS) {
      expect(subjects.has(formula.subject), formula.id).toBe(true)
    }
  })

  it('собирает текст для заметки из формулы, обозначений и единиц', () => {
    const speed = FORMULAS.find((formula) => formula.id === 'speed')
    expect(speed).toBeDefined()
    const text = formulaToText(speed!)
    expect(text).toContain('Скорость: v = s / t')
    expect(text).toContain('v — скорость, s — путь, t — время.')
    expect(text).toContain('Единицы: v — м/с, s — м, t — с.')
  })
})
