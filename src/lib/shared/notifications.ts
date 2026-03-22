export const NOTIFICATION_TYPES = [
  'new_visit', 'visit_milestone', 'click_milestone',
  'roadmap_shipped', 'suggestion_ok', 'suggestion_no',
  'welcome', 'upgrade_success',
] as const

export type NotificationType = typeof NOTIFICATION_TYPES[number]

export function isValidNotificationType(value: unknown): value is NotificationType {
  return typeof value === 'string' && (NOTIFICATION_TYPES as readonly string[]).includes(value)
}