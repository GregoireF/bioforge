import { z } from 'zod';

// ==================== PROFILE SCHEMA ====================

export const profileSchema = z.object({
  id: z.string().uuid(),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(24, 'Username must be less than 24 characters')
    .regex(/^[a-z0-9_]+$/, 'Username can only contain lowercase letters, numbers and underscores'),
  display_name: z.string().min(1, 'Display name is required').max(100),
  bio: z.string().max(500).nullable(),
  avatar_url: z.string().url().nullable(),
  plan: z.enum(['Free', 'Creator', 'Pro', 'Enterprise']),
  theme: z.record(z.string(), z.unknown()),
  is_active: z.boolean(),
  subscription_status: z.enum(['none', 'active', 'canceled', 'past_due']),
  subscription_id: z.string().nullable(),
  stripe_customer_id: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  deleted_at: z.string().datetime().nullable(),
});

export type Profile = z.infer<typeof profileSchema>;

// ==================== PROFILE UPDATE SCHEMA ====================

export const profileUpdateSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(24)
    .regex(/^[a-z0-9_]+$/)
    .optional(),
  display_name: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
  theme: z.record(z.string(), z.unknown()).optional(),
  is_active: z.boolean().optional(),
});

export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;

// ==================== THEME SCHEMA ====================

export const themePresetSchema = z.enum(['dark', 'light', 'gradient', 'custom']);

export const themeSchema = z.object({
  preset: themePresetSchema,
  background_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  text_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  button_style: z.enum(['filled', 'outline', 'soft']).optional(),
  border_radius: z.number().int().min(0).max(24).optional(),
  font_family: z.string().optional(),
});

export type Theme = z.infer<typeof themeSchema>;

// ==================== VALIDATION FUNCTIONS ====================

/**
 * Validate profile update data
 */
export function validateProfileUpdate(data: unknown) {
  return profileUpdateSchema.parse(data);
}

/**
 * Validate theme data
 */
export function validateTheme(data: unknown) {
  return themeSchema.parse(data);
}

/**
 * Validate username format
 */
export function isValidUsername(username: string): boolean {
  try {
    z.string().min(3).max(24).regex(/^[a-z0-9_]+$/).parse(username);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  try {
    z.string().email().parse(email);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    z.string().url().parse(url);
    return true;
  } catch {
    return false;
  }
}