// src/lib/schemas/chatbot.schema.ts
import { z } from 'zod'
import { PLANS } from '@/lib/shared/plans'

export const chatMessageSchema = z.object({
  role:    z.enum(['user', 'assistant']),
  content: z.string().min(1).max(4000),
})

export const chatContextSchema = z.object({
  displayName: z.string().max(80).optional(),
  plan:        z.enum(PLANS).optional(),
  username:    z.string().max(24).optional(),
  isPaid:      z.boolean().optional(),
}).strict()

export const chatBodySchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(20),
  context:  chatContextSchema.optional(),
}).strict()

export type ChatMessage = z.infer<typeof chatMessageSchema>
export type ChatContext = z.infer<typeof chatContextSchema>
export type ChatBody    = z.infer<typeof chatBodySchema>