import { z } from 'zod'
 
export const consentSchema = z.object({
  profile_id: z.string().uuid(),
  analytics:  z.boolean(),
  action:     z.enum(['accept', 'reject', 'withdraw']).default('accept'),
  source:     z.enum(['banner', 'settings', 'api']).default('banner'),
}).strict()
 
export const deleteAccountSchema = z.object({
  confirm: z.literal('DELETE MY ACCOUNT'),
  reason:  z.string().max(500).optional(),
}).strict()
 
export type ConsentInput       = z.infer<typeof consentSchema>
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>