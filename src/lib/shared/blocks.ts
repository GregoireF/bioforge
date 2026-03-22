export const BLOCK_TYPES = [
  'link', 'heading', 'spacer', 'image', 'video', 'social',
  'countdown', 'schedule', 'donation', 'embed', 'form', 'product',
  'clip', 'live-stream', 'merch', 'discord-invite',
  'tiktok_series', 'tiktok_gift', 'tiktok_shop',
  'twitch_clip', 'twitch_vod', 'twitch_live',
  'text', 'banner', 'poll', 'newsletter', 'vcard', 'merch_grid',
] as const
 
export type BlockType = typeof BLOCK_TYPES[number]
 
export const BLOCK_TYPES_SET = new Set<string>(BLOCK_TYPES)
 
export function isValidBlockType(value: unknown): value is BlockType {
  return typeof value === 'string' && BLOCK_TYPES_SET.has(value)
}
 
// Blocks qui n'ont pas forcément de titre
export const BLOCKS_WITHOUT_TITLE: readonly BlockType[] = [
  'spacer', 'countdown', 'twitch_live',
]
 
// Blocks premium (plan Creator+)
export const PREMIUM_BLOCK_TYPES: readonly BlockType[] = [
  'tiktok_series', 'tiktok_gift', 'tiktok_shop',
  'twitch_clip', 'twitch_vod', 'twitch_live',
  'live-stream', 'merch', 'merch_grid',
  'newsletter', 'poll', 'vcard',
]