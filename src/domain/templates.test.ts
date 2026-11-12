import { describe, expect, it } from 'vitest'
import { TEMPLATES, getTemplate } from './templates'

describe('темы проектов', () => {
  it('не содержит повторяющихся идентификаторов', () => {
    const ids = TEMPLATES.map((template) => template.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('у каждой темы заполнены название, описание, вопрос и цвет', () => {
    for (const template of TEMPLATES) {
      expect(template.title.trim().length, template.id).toBeGreaterThan(0)
      expect(template.summary.trim().length, template.id).toBeGreaterThan(0)
      expect(template.exampleQuestion.trim().length, template.id).toBeGreaterThan(0)
      expect(template.color, template.id).toMatch(/^#[0-9a-f]{6}$/i)
      expect(template.marks.length, template.id).toBeGreaterThan(0)
    }
  })

  it('есть темы по физике и химии с формулами', () => {
    const physics = getTemplate('physics')
    const chemistry = getTemplate('chemistry')

    expect(physics?.title).toBe('Физика')
    expect(chemistry?.title).toBe('Химия')
    expect(physics?.hasFormulas).toBe(true)
    expect(chemistry?.hasFormulas).toBe(true)
    expect(physics?.metrics.length).toBeGreaterThan(0)
    expect(chemistry?.metrics.length).toBeGreaterThan(0)
  })

  it('есть тема «Окружающий мир» с наблюдениями и измерениями', () => {
    const world = getTemplate('world')

    expect(world?.title).toBe('Окружающий мир')
    expect(world?.marks.length).toBeGreaterThan(0)
    expect(world?.metrics.length).toBeGreaterThan(0)
  })

  it('у измерений есть название и единица', () => {
    for (const template of TEMPLATES) {
      for (const metric of template.metrics) {
        expect(metric.name.trim().length, template.id).toBeGreaterThan(0)
        expect(metric.unit.trim().length, template.id).toBeGreaterThan(0)
      }
    }
  })
})
