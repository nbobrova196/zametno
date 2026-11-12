export type TemplateId = 'animal' | 'plant' | 'world' | 'physics' | 'chemistry' | 'weather' | 'custom'
export type ProjectMode = 'quick' | 'research'
export type ProjectStatus = 'active' | 'paused' | 'completed'
export type ObservationKind = 'observation' | 'no_changes' | 'skipped' | 'care'
export type PresentationTheme = 'paper' | 'forest' | 'sky'
export type ReminderKind = 'observation' | 'care'

export interface Project {
  id: string
  title: string
  subjectName: string
  templateId: TemplateId
  mode: ProjectMode
  question?: string
  hypothesis?: string
  description?: string
  startDate?: string
  endDate?: string
  status: ProjectStatus
  color: string
  coverPhotoId?: string
  authorName?: string
  conclusion?: string
  nextSteps?: string
  presentationTheme?: PresentationTheme
  selectedObservationIds?: string[]
  createdAt: number
  updatedAt: number
}

export interface Metric {
  id: string
  projectId: string
  name: string
  unit: string
  order: number
}

export interface Mark {
  id: string
  projectId: string
  label: string
  order: number
}

export interface Measurement {
  metricId: string
  value: number
}

export interface Observation {
  id: string
  projectId: string
  kind: ObservationKind
  observedAt: number
  createdAt: number
  note?: string
  markIds: string[]
  measurements: Measurement[]
  isImportant: boolean
}

export interface Photo {
  id: string
  projectId: string
  observationId: string
  blob: Blob
  thumb: Blob
  width: number
  height: number
  order: number
  createdAt: number
}

export interface Reminder {
  id: string
  projectId: string
  kind: ReminderKind
  title: string
  /** ISO weekdays: 1 — понедельник … 7 — воскресенье. */
  weekdays: number[]
  /** Время в формате HH:mm. */
  time: string
  /** Первый день, с которого действует расписание, yyyy-MM-dd. */
  startDate: string
  /** Последний день действия, yyyy-MM-dd. */
  endDate?: string
  /** Если задано, напоминание скрыто до этой даты, yyyy-MM-dd. */
  snoozedUntil?: string
  active: boolean
  createdAt: number
  updatedAt: number
}

export interface ReminderLog {
  id: string
  projectId: string
  reminderId: string
  /** День, к которому относится выполнение, yyyy-MM-dd. */
  date: string
  completedAt: number
  observationId?: string
}
