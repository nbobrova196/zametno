const STORAGE_KEY = 'zametno:last-backup:v1'

export const BACKUP_REMINDER_DAYS = 14

type BackupMap = Record<string, number>

let memory: BackupMap = {}

function readMap(): BackupMap {
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed: unknown = JSON.parse(raw)
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          memory = parsed as BackupMap
        }
      }
    } catch {
      // Приватный режим или запрет на localStorage — работаем из памяти.
    }
  }
  return memory
}

function writeMap(map: BackupMap) {
  memory = map
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
    } catch {
      // Ничего страшного: напоминание просто не переживёт перезапуск.
    }
  }
}

export function getLastBackupAt(projectId: string): number | null {
  const value = readMap()[projectId]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function markBackupDone(projectId: string, at = Date.now()) {
  writeMap({ ...readMap(), [projectId]: at })
}

export function isBackupStale(
  lastAt: number | null,
  now = Date.now(),
  days = BACKUP_REMINDER_DAYS,
): boolean {
  if (!lastAt) return true
  return now - lastAt >= days * 24 * 60 * 60 * 1000
}

export function daysSinceBackup(lastAt: number, now = Date.now()): number {
  return Math.max(0, Math.floor((now - lastAt) / (24 * 60 * 60 * 1000)))
}
