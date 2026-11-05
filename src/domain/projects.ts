import { db, touchProject } from '../db/db'
import type { Project, ProjectMode, TemplateId } from '../db/types'
import { getTemplate } from './templates'

export interface CreateProjectInput {
  templateId: TemplateId
  title: string
  subjectName: string
  question: string
  mode: ProjectMode
  startDate?: string
  endDate?: string
}

export async function createProject(input: CreateProjectInput): Promise<string> {
  const template = getTemplate(input.templateId)
  const now = Date.now()
  const id = crypto.randomUUID()

  const project: Project = {
    id,
    title: input.title.trim(),
    subjectName: input.subjectName.trim(),
    templateId: input.templateId,
    mode: input.mode,
    question: input.question.trim() || undefined,
    startDate: input.startDate || undefined,
    endDate: input.endDate || undefined,
    status: 'active',
    color: template?.color ?? '#1f5f4f',
    createdAt: now,
    updatedAt: now,
  }

  await db.transaction('rw', db.projects, db.metrics, db.marks, async () => {
    await db.projects.add(project)

    if (template) {
      await db.metrics.bulkAdd(
        template.metrics.map((metric, index) => ({
          id: crypto.randomUUID(),
          projectId: id,
          name: metric.name,
          unit: metric.unit,
          order: index,
        })),
      )

      await db.marks.bulkAdd(
        template.marks.map((label, index) => ({
          id: crypto.randomUUID(),
          projectId: id,
          label,
          order: index,
        })),
      )
    }
  })

  return id
}

export async function updateProject(
  projectId: string,
  patch: Partial<
    Pick<
      Project,
      | 'title'
      | 'subjectName'
      | 'question'
      | 'hypothesis'
      | 'description'
      | 'mode'
      | 'startDate'
      | 'endDate'
      | 'status'
      | 'color'
      | 'coverPhotoId'
      | 'authorName'
      | 'conclusion'
      | 'nextSteps'
      | 'presentationTheme'
      | 'selectedObservationIds'
    >
  >,
) {
  await db.projects.update(projectId, { ...patch, updatedAt: Date.now() })
}

export async function listMetrics(projectId: string) {
  const metrics = await db.metrics.where('projectId').equals(projectId).toArray()
  return metrics.sort((a, b) => a.order - b.order)
}

export async function listMarks(projectId: string) {
  const marks = await db.marks.where('projectId').equals(projectId).toArray()
  return marks.sort((a, b) => a.order - b.order)
}

export { touchProject }
