import { useEffect } from 'react'

export interface NotificationItem {
  id: string
  title: string
  body: string
  at: number
}

export function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notificationPermission() {
  if (!notificationsSupported()) return 'unsupported' as const
  return Notification.permission
}

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return 'unsupported' as const
  return Notification.requestPermission()
}

export function useScheduledNotifications(items: NotificationItem[], enabled: boolean) {
  useEffect(() => {
    if (!enabled || !notificationsSupported() || Notification.permission !== 'granted') return

    const now = Date.now()
    const timers = items
      .filter((item) => item.at > now)
      .map((item) =>
        window.setTimeout(() => {
          new Notification('Заметно', {
            body: `${item.title}: ${item.body}`,
            tag: item.id,
            icon: '/icons/icon-192.png',
          })
        }, Math.min(item.at - now, 2_147_483_647)),
      )

    return () => {
      for (const timer of timers) window.clearTimeout(timer)
    }
  }, [items, enabled])
}
