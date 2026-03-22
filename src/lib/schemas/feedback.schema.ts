// src/lib/schemas/feedback.schema.ts
import { z } from 'zod'

export const feedbackSchema = z.object({
  score:   z.number().int().min(1).max(5),
  comment: z.string().max(400).optional(),
  source:  z.string().max(60).optional(),
  url:     z.string().url().max(200).optional(),
}).strict()

export type FeedbackInput = z.infer<typeof feedbackSchema>