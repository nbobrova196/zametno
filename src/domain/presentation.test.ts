import { describe, expect, it } from 'vitest'
import type { Metric, Observation, Photo, Project } from '../db/types'
import { buildPresentation, defaultSelectedObservationIds } from './presentation'

export function makeProject(patch: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    title: 'Фасоль на подоконнике',
    subjectName: 'фасоль в горшке',
    templateId: 'plant',
    mode: 'research',
    status: 'active',
    color: '#1f5f4f',
    createdAt: new Date(2026, 10, 1).getTime(),
    updatedAt: new Date(2026, 10, 1).getTime(),
    ...patch,
  }
}

export function makeObservation(patch: Partial<Observation> = {}): Observation {
  return {
    id: 'o1',
    projectId: 'p1',
    kind: 'observation',
    observedAt: new Date(2026, 10, 2, 10).getTime(),
    createdAt: new Date(2026, 10, 2, 10).getTime(),
    markIds: [],
    measurements: [],
    isImportant: false,
    ...patch,
  }
}

function makePhoto(id: string, observationId: string): Photo {
  const blob = new Blob(['x'])
  return {
    id,
    projectId: 'p1',
    observationId,
    blob,
    thumb: blob,
    width: 1200,
    height: 900,
    order: 0,
    createdAt: new Date(2026, 10, 2).getTime(),
  }
}

const height: Metric = { id: 'm1', projectId: 'p1', name: 'Высота', unit: 'см', order: 0 }

describe('buildPresentation', () => {
  it('собирает минимум из трёх слайдов без данных', () => {
    const slides = buildPresentation({
      project: makeProject(),
      observations: [],
      photos: [],
      metrics: [],
      selectedIds: [],
    })

    expect(slides.map((slide) => slide.id)).toEqual(['title', 'method', 'next-fallback'])
    expect(slides[0].photos).toBeUndefined()
    expect(slides[1].bullets).toContain('Измерения: не использовались')
  })

  it('добавляет вопрос, наблюдения, вывод и продолжение при наличии данных', () => {
    const observations = [
      makeObservation({ id: 'o1', observedAt: new Date(2026, 10, 1).getTime() }),
      makeObservation({ id: 'o2', observedAt: new Date(2026, 10, 2).getTime(), isImportant: true }),
      makeObservation({
        id: 'o3',
        observedAt: new Date(2026, 10, 3).getTime(),
        note: 'Появился третий лист',
      }),
      makeObservation({ id: 'o4', observedAt: new Date(2026, 10, 4).getTime() }),
      makeObservation({ id: 'skip', kind: 'skipped' }),
    ]

    const slides = buildPresentation({
      project: makeProject({
        question: 'Как меняется фасоль?',
        hypothesis: 'Растёт равномерно',
        conclusion: 'Рост зависит от света',
        nextSteps: 'Проверить тень',
        startDate: '2026-11-01',
        endDate: '2026-11-04',
      }),
      observations,
      photos: [makePhoto('ph1', 'o1'), makePhoto('ph2', 'o3')],
      metrics: [height],
      selectedIds: ['o1', 'o2', 'o3', 'o4'],
    })

    expect(slides.map((slide) => slide.id)).toEqual([
      'title',
      'question',
      'method',
      'observations',
      'conclusion',
      'next',
    ])
    expect(slides[1].bullets).toEqual(['Предположение: Растёт равномерно'])
    expect(slides[2].bullets).toContain('Записей: 4 наблюдения')
    expect(slides[3].photos).toHaveLength(2)
    expect(slides[3].footer).toBe('Показаны 3 из 4. Остальные записи остались в истории.')
    expect(slides[4].bullets?.[0]).toContain('Подтверждают записи')
  })

  it('показывает изменение измерений в российском формате', () => {
    const observations = [
      makeObservation({
        id: 'o1',
        observedAt: new Date(2026, 10, 1).getTime(),
        measurements: [{ metricId: 'm1', value: 2.5 }],
      }),
      makeObservation({
        id: 'o2',
        observedAt: new Date(2026, 10, 3).getTime(),
        measurements: [{ metricId: 'm1', value: 4.2 }],
      }),
    ]

    const slides = buildPresentation({
      project: makeProject(),
      observations,
      photos: [],
      metrics: [height],
      selectedIds: [],
    })

    expect(slides[1].bullets).toContain('Измерения: Высота: 2,5 → 4,2 см')
  })

  it('делает текстовый слайд наблюдений, если фотографий нет', () => {
    const observation = makeObservation({ id: 'o1', note: 'Первый росток' })
    const slides = buildPresentation({
      project: makeProject(),
      observations: [observation],
      photos: [],
      metrics: [],
      selectedIds: ['o1'],
    })

    const observationsSlide = slides.find((slide) => slide.kind === 'observations')
    expect(observationsSlide?.photos).toBeUndefined()
    expect(observationsSlide?.bullets?.[0]).toContain('Первый росток')
  })
})

describe('defaultSelectedObservationIds', () => {
  const observations = [
    makeObservation({ id: 'o1' }),
    makeObservation({ id: 'o2', isImportant: true }),
    makeObservation({ id: 'o3' }),
    makeObservation({ id: 'o4' }),
  ]

  it('берёт важные записи, если выбор не сохранён', () => {
    expect(defaultSelectedObservationIds(makeProject(), observations)).toEqual(['o2'])
  })

  it('уважает сохранённый выбор и отбрасывает пропуски', () => {
    const project = makeProject({ selectedObservationIds: ['o1', 'skip', 'o3'] })
    expect(
      defaultSelectedObservationIds(project, [
        ...observations,
        makeObservation({ id: 'skip', kind: 'skipped' }),
      ]),
    ).toEqual(['o1', 'o3'])
  })

  it('не добавляет записи, если сохранён пустой выбор', () => {
    expect(defaultSelectedObservationIds(makeProject({ selectedObservationIds: [] }), observations)).toEqual([])
  })
})
