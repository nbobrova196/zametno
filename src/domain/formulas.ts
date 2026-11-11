export type FormulaSubject = 'physics' | 'chemistry'

export interface FormulaSource {
  id: string
  title: string
  url: string
  note?: string
}

export interface Formula {
  id: string
  subject: FormulaSubject
  topic: string
  title: string
  expression: string
  legend: string
  units: string
  hint?: string
  sourceIds: string[]
}

export const FORMULA_SUBJECTS: Array<{ id: FormulaSubject; title: string; emoji: string }> = [
  { id: 'physics', title: 'Физика', emoji: '🧲' },
  { id: 'chemistry', title: 'Химия', emoji: '⚗️' },
]

/**
 * Источники формул и обозначений:
 * — ФИПИ, кодификатор ОГЭ по физике 2026 (раздел «Механические явления»);
 * — ФИПИ, демоверсия и кодификатор ОГЭ по химии 2026 (расчётные задачи).
 * Файлы скачаны с fipi.ru 11 ноября 2026 года.
 */
export const FORMULA_SOURCES: FormulaSource[] = [
  {
    id: 'fipi-physics-2026',
    title: 'ФИПИ. Кодификатор ОГЭ по физике, 2026',
    url: 'https://doc.fipi.ru/oge/demoversii-specifikacii-kodifikatory/2026/fi_9_2026.zip',
    note: 'Формулы скорости, плотности, силы тяжести, давления, работы и мощности.',
  },
  {
    id: 'fipi-chemistry-2026',
    title: 'ФИПИ. Демоверсия и кодификатор ОГЭ по химии, 2026',
    url: 'https://doc.fipi.ru/oge/demoversii-specifikacii-kodifikatory/2026/hi_9_2026.zip',
    note: 'Расчёты с массовой долей, количеством вещества и молярной массой.',
  },
]

export const FORMULAS: Formula[] = [
  {
    id: 'speed',
    subject: 'physics',
    topic: 'Движение',
    title: 'Скорость',
    expression: 'v = s / t',
    legend: 'v — скорость, s — путь, t — время',
    units: 'v — м/с, s — м, t — с',
    hint: 'Для равномерного движения: тело проходит одинаковый путь за одинаковое время.',
    sourceIds: ['fipi-physics-2026'],
  },
  {
    id: 'density',
    subject: 'physics',
    topic: 'Вещество',
    title: 'Плотность',
    expression: 'ρ = m / V',
    legend: 'ρ — плотность, m — масса, V — объём',
    units: 'ρ — кг/м³, m — кг, V — м³',
    hint: 'Плотность показывает, сколько массы приходится на единицу объёма.',
    sourceIds: ['fipi-physics-2026'],
  },
  {
    id: 'gravity',
    subject: 'physics',
    topic: 'Силы',
    title: 'Сила тяжести',
    expression: 'F = m · g',
    legend: 'F — сила тяжести, m — масса, g — ускорение свободного падения',
    units: 'F — Н, m — кг, g — Н/кг',
    hint: 'Около поверхности Земли g ≈ 10 Н/кг — так удобно считать в школе.',
    sourceIds: ['fipi-physics-2026'],
  },
  {
    id: 'pressure',
    subject: 'physics',
    topic: 'Давление',
    title: 'Давление твёрдого тела',
    expression: 'p = F / S',
    legend: 'p — давление, F — сила давления, S — площадь',
    units: 'p — Па, F — Н, S — м²',
    hint: 'При одной и той же силе меньше площадь — больше давление.',
    sourceIds: ['fipi-physics-2026'],
  },
  {
    id: 'work',
    subject: 'physics',
    topic: 'Работа и мощность',
    title: 'Механическая работа',
    expression: 'A = F · s',
    legend: 'A — работа, F — сила, s — путь',
    units: 'A — Дж, F — Н, s — м',
    hint: 'Если сила направлена вдоль движения. В общем случае учитывают угол между силой и путём.',
    sourceIds: ['fipi-physics-2026'],
  },
  {
    id: 'power',
    subject: 'physics',
    topic: 'Работа и мощность',
    title: 'Мощность',
    expression: 'N = A / t',
    legend: 'N — мощность, A — работа, t — время',
    units: 'N — Вт, A — Дж, t — с',
    hint: 'Мощность показывает, как быстро совершается работа.',
    sourceIds: ['fipi-physics-2026'],
  },
  {
    id: 'efficiency',
    subject: 'physics',
    topic: 'Работа и мощность',
    title: 'КПД',
    expression: 'η = (A_полезная / A_затраченная) · 100%',
    legend: 'η — КПД, A_полезная — полезная работа, A_затраченная — затраченная работа',
    units: 'η — %, A — Дж',
    hint: 'КПД всегда меньше 100%: часть работы уходит на трение и нагрев.',
    sourceIds: ['fipi-physics-2026'],
  },
  {
    id: 'mass-fraction-solution',
    subject: 'chemistry',
    topic: 'Растворы',
    title: 'Массовая доля вещества в растворе',
    expression: 'ω = m(в-ва) / m(р-ра) · 100%',
    legend: 'ω — массовая доля, m(в-ва) — масса вещества, m(р-ра) — масса раствора',
    units: 'ω — %, m — г',
    hint: 'Масса раствора — это масса вещества плюс масса воды.',
    sourceIds: ['fipi-chemistry-2026'],
  },
  {
    id: 'mass-of-solute',
    subject: 'chemistry',
    topic: 'Растворы',
    title: 'Масса вещества в растворе',
    expression: 'm(в-ва) = m(р-ра) · ω / 100%',
    legend: 'm(в-ва) — масса вещества, m(р-ра) — масса раствора, ω — массовая доля',
    units: 'm — г, ω — %',
    hint: 'Если известна массовая доля в процентах.',
    sourceIds: ['fipi-chemistry-2026'],
  },
  {
    id: 'amount-of-substance',
    subject: 'chemistry',
    topic: 'Количество вещества',
    title: 'Количество вещества',
    expression: 'n = m / M',
    legend: 'n — количество вещества, m — масса, M — молярная масса',
    units: 'n — моль, m — г, M — г/моль',
    hint: 'Моль — это порция вещества, в которой 6,02·10²³ частиц.',
    sourceIds: ['fipi-chemistry-2026'],
  },
  {
    id: 'molar-mass',
    subject: 'chemistry',
    topic: 'Количество вещества',
    title: 'Молярная масса',
    expression: 'M = m / n',
    legend: 'M — молярная масса, m — масса, n — количество вещества',
    units: 'M — г/моль, m — г, n — моль',
    hint: 'Молярная масса численно равна относительной молекулярной массе.',
    sourceIds: ['fipi-chemistry-2026'],
  },
  {
    id: 'mass-from-amount',
    subject: 'chemistry',
    topic: 'Количество вещества',
    title: 'Масса вещества',
    expression: 'm = n · M',
    legend: 'm — масса, n — количество вещества, M — молярная масса',
    units: 'm — г, n — моль, M — г/моль',
    hint: 'Масса через количество вещества и молярную массу.',
    sourceIds: ['fipi-chemistry-2026'],
  },
  {
    id: 'element-mass-fraction',
    subject: 'chemistry',
    topic: 'Состав вещества',
    title: 'Массовая доля элемента в соединении',
    expression: 'ω(Э) = (Ar(Э) · n) / Mr · 100%',
    legend:
      'ω(Э) — массовая доля элемента, Ar(Э) — относительная атомная масса элемента, n — число атомов элемента, Mr — относительная молекулярная масса вещества',
    units: 'ω(Э) — %',
    hint: 'Показывает, какая часть массы соединения приходится на этот элемент.',
    sourceIds: ['fipi-chemistry-2026'],
  },
]

export function getFormulaSource(id: string) {
  return FORMULA_SOURCES.find((source) => source.id === id)
}

/** Текст, который вставляется в заметку наблюдения. */
export function formulaToText(formula: Formula) {
  return [
    `${formula.title}: ${formula.expression}`,
    `${formula.legend}.`,
    `Единицы: ${formula.units}.`,
  ].join('\n')
}
