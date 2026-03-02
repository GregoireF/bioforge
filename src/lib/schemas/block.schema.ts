import { z } from 'zod';

// ==================== BLOCK TYPE ====================

export const blockTypeSchema = z.enum([
  'link',
  'heading',
  'spacer',
  'image',
  'video',
  'social',
  'countdown',
  'embed',
  'product',
  'form',
  'donation',
  'livestream',
  'tiktok_series',
  'twitch_clip',
  'spotify',
  'apple_music',
  'soundcloud',
  'youtube',
  'twitter',
  'instagram',
]);

export type BlockType = z.infer<typeof blockTypeSchema>;

// ==================== BLOCK CONFIGS ====================

// Link block config
export const linkConfigSchema = z.object({
  url: z.string().url('Invalid URL'),
  icon: z.string().optional(),
  thumbnail: z.string().url().optional(),
});

// Image block config
export const imageConfigSchema = z.object({
  url: z.string().url('Invalid URL'),
  alt: z.string().optional(),
  link: z.string().url().optional(),
});

// Video block config
export const videoConfigSchema = z.object({
  url: z.string().url('Invalid URL'),
  platform: z.enum(['youtube', 'vimeo', 'tiktok']).optional(),
});

// Social block config
export const socialConfigSchema = z.object({
  links: z.array(z.object({
    platform: z.string(),
    url: z.string().url(),
  })).min(1, 'At least one social link required'),
});

// Countdown block config
export const countdownConfigSchema = z.object({
  target_date: z.string().datetime(),
  timezone: z.string().optional(),
});

// Generic config for other types
export const genericConfigSchema = z.record(z.string(), z.unknown());

// ==================== BLOCK SCHEMA ====================

export const blockSchema = z.object({
  id: z.string().uuid().optional(),
  profile_id: z.string().uuid(),
  type: blockTypeSchema,
  title: z.string().max(200).nullable(),
  config: z.union([
    linkConfigSchema,
    imageConfigSchema,
    videoConfigSchema,
    socialConfigSchema,
    countdownConfigSchema,
    genericConfigSchema,
  ]),
  active: z.boolean().default(true),
  position: z.number().int().min(0),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export type Block = z.infer<typeof blockSchema>;

// ==================== BLOCK CREATE SCHEMA ====================

export const blockCreateSchema = z.object({
  type: blockTypeSchema,
  title: z.string().max(200).nullable().optional(),
  config: z.union([
    linkConfigSchema,
    imageConfigSchema,
    videoConfigSchema,
    socialConfigSchema,
    countdownConfigSchema,
    genericConfigSchema,
  ]).optional(),
});

export type BlockCreate = z.infer<typeof blockCreateSchema>;

// ==================== BLOCK UPDATE SCHEMA ====================

export const blockUpdateSchema = z.object({
  title: z.string().max(200).nullable().optional(),
  config: z.union([
    linkConfigSchema,
    imageConfigSchema,
    videoConfigSchema,
    socialConfigSchema,
    countdownConfigSchema,
    genericConfigSchema,
  ]).optional(),
  active: z.boolean().optional(),
});

export type BlockUpdate = z.infer<typeof blockUpdateSchema>;

// ==================== VALIDATION FUNCTIONS ====================

export function validateBlockConfig(type: BlockType, config: any) {
  switch (type) {
    case 'link':
      return linkConfigSchema.parse(config);
    case 'image':
      return imageConfigSchema.parse(config);
    case 'video':
      return videoConfigSchema.parse(config);
    case 'social':
      return socialConfigSchema.parse(config);
    case 'countdown':
      return countdownConfigSchema.parse(config);
    default:
      return genericConfigSchema.parse(config);
  }
}

export function validateBlockCreate(data: unknown) {
  return blockCreateSchema.parse(data);
}

export function validateBlockUpdate(data: unknown) {
  return blockUpdateSchema.parse(data);
}