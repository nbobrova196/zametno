import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'

export function useProject(projectId: string | undefined) {
  return useLiveQuery(async () => {
    if (!projectId) return null
    return (await db.projects.get(projectId)) ?? null
  }, [projectId])
}
