import type { TemplateId } from '../db/types'

export interface TemplateMetric {
  name: string
  unit: string
}

export interface Template {
  id: TemplateId
  title: string
  emoji: string
  summary: string
  exampleQuestion: string
  color: string
  marks: string[]
  metrics: TemplateMetric[]
  hints: string[]
}

export const TEMPLATES: Template[] = [
  {
    id: 'animal',
    title: 'Домашнее животное',
    emoji: '🐢',
    summary: 'Поведение, место и привычки того, кто живёт рядом.',
    exampleQuestion: 'Где черепаха чаще отдыхает?',
    color: '#b4553f',
    marks: ['Отдыхает', 'Ест', 'Гуляет', 'Играет', 'Спрятался'],
    metrics: [],
    hints: [
      'Смотри в одно и то же время дня — так изменения заметнее.',
      'Записывай не только действия, но и место.',
    ],
  },
  {
    id: 'plant',
    title: 'Растение',
    emoji: '🌱',
    summary: 'Рост, листья и то, как растение меняется неделя за неделей.',
    exampleQuestion: 'Как меняется фасоль за три недели?',
    color: '#1f5f4f',
    marks: ['Новый лист', 'Полив', 'Росток', 'Цветение'],
    metrics: [
      { name: 'Высота', unit: 'см' },
      { name: 'Листья', unit: 'шт.' },
    ],
    hints: [
      'Фотографируй с одного места и с одной стороны.',
      'Измеряй в одно и то же время суток.',
    ],
  },
  {
    id: 'weather',
    title: 'Погода',
    emoji: '🌤️',
    summary: 'Температура, облачность и осадки — календарь наблюдений.',
    exampleQuestion: 'Чем отличаются две недели наблюдений?',
    color: '#3c5a7d',
    marks: ['Солнечно', 'Облачно', 'Дождь', 'Снег', 'Ветер'],
    metrics: [{ name: 'Температура', unit: '°C' }],
    hints: [
      'Наблюдай в одно и то же время — например, утром.',
      'Отмечай даже скучную погоду: она тоже часть сравнения.',
    ],
  },
  {
    id: 'custom',
    title: 'Своя тема',
    emoji: '✨',
    summary: 'Свой вопрос и свой набор полей — для любой идеи.',
    exampleQuestion: 'Что я хочу выяснить?',
    color: '#7a5a2f',
    marks: ['Заметил', 'Изменилось', 'Осталось прежним'],
    metrics: [],
    hints: [
      'Начни с вопроса, на который можно ответить наблюдениями.',
      'Добавляй измерения постепенно, когда поймёшь, что важно.',
    ],
  },
]

export function getTemplate(id: string | undefined): Template | undefined {
  return TEMPLATES.find((template) => template.id === id)
}

export const PROJECT_COLORS = [
  '#1f5f4f',
  '#b4553f',
  '#3c5a7d',
  '#7a5a2f',
  '#4f4a7d',
  '#2f6b6b',
]
