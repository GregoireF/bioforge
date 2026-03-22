// src/lib/schemas/blocks.schema.ts
import { z } from 'zod'
import { BLOCK_TYPES } from '@/lib/shared/blocks'

export const blockTypeSchema = z.enum(BLOCK_TYPES)

// config opaque — Json dans la DB, on valide juste que c'est un objet
const configSchema = z.record(z.string(), z.unknown())

export const createBlockSchema = z.object({
  type:   blockTypeSchema,
  title:  z.string().max(140).nullable().optional(),
  config: configSchema.optional(),
  active: z.boolean().optional(),
}).strict()

export const updateBlockSchema = z.object({
  type:      blockTypeSchema.optional(),
  title:     z.string().max(140).nullable().optional(),
  config:    configSchema.optional(),
  active:    z.boolean().optional(),
  is_pinned: z.boolean().optional(),
  // position non exposé — calculé côté serveur lors du reorder
}).strict()

export const reorderBlocksSchema = z.object({
  blockIds: z.array(z.string().uuid()).min(1).max(200),
}).strict()

export const voteSchema = z.object({
  option_index: z.number().int().min(0).max(9),
}).strict()

export type CreateBlockInput  = z.infer<typeof createBlockSchema>
export type UpdateBlockInput  = z.infer<typeof updateBlockSchema>
export type ReorderBlockInput = z.infer<typeof reorderBlocksSchema>
export type VoteInput         = z.infer<typeof voteSchema>