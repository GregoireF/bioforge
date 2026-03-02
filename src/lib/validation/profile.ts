import { z } from 'zod'

export const updateProfileSchema = z
  .object({
    username: z.string().min(3).max(30).optional(),
    display_name: z.string().min(1).max(50).optional(),
    bio: z.string().max(160).optional(),
    avatar_url: z.string().url().optional(),
    theme: z.record(z.any(), z.unknown()).optional(),
  })
  .strip()