import { atom, map } from 'nanostores'
import type { Database } from '@/lib/supabase/database.types'

type Notification = Database['public']['Tables']['notifications']['Row']

// ─── State ────────────────────────────────────────────────────────────────────

export const $notifications = atom<Notification[]>([])
export const $unreadCount   = atom<number>(0)
export const $notifLoading  = atom<boolean>(false)

// ─── Actions ──────────────────────────────────────────────────────────────────

export function setNotifications(list: Notification[]) {
  $notifications.set(list)
  $unreadCount.set(list.filter(n => !n.is_read).length)
}

export function prependNotification(notif: Notification) {
  const current = $notifications.get()
  $notifications.set([notif, ...current])
  if (!notif.is_read) $unreadCount.set($unreadCount.get() + 1)
}

export function markOneRead(id: number) {
  const updated = $notifications.get().map(n =>
    n.id === id ? { ...n, is_read: true } : n
  )
  $notifications.set(updated)
  $unreadCount.set(updated.filter(n => !n.is_read).length)
}

export function markAllRead() {
  $notifications.set($notifications.get().map(n => ({ ...n, is_read: true })))
  $unreadCount.set(0)
}

// ─── API helpers ──────────────────────────────────────────────────────────────

export async function fetchNotifications(): Promise<void> {
  $notifLoading.set(true)
  try {
    const res  = await fetch('/api/notifications')
    const json = await res.json() as { notifications?: Notification[]; unread?: number }
    if (json.notifications) setNotifications(json.notifications)
  } finally {
    $notifLoading.set(false)
  }
}

export async function markAsRead(id?: number): Promise<void> {
  await fetch('/api/notifications/read', {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(id !== undefined ? { id } : {}),
  })
  if (id !== undefined) markOneRead(id)
  else                  markAllRead()
}