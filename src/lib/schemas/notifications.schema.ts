// src/lib/schemas/notifications.schema.ts
import { z } from 'zod'
import { NOTIFICATION_TYPES } from '@/lib/shared/notifications'

export const createNotifSchema = z.object({
  user_id: z.string().uuid(),
  type:    z.enum(NOTIFICATION_TYPES),
  title:   z.string().min(1).max(120),
  body:    z.string().max(300).optional(),
  icon:    z.string().max(10).optional(),
  href:    z.string().url().optional(),
}).strict()

export const readNotifSchema = z.object({
  id: z.number().int().positive().optional(),
}).strict()

export type CreateNotifInput = z.infer<typeof createNotifSchema>
export type ReadNotifInput   = z.infer<typeof readNotifSchema>