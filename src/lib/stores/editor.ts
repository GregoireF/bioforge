import { atom } from 'nanostores'
import type { Block } from '@/lib/db'

export const $blocks      = atom<Block[]>([])
export const $isDirty     = atom<boolean>(false)
export const $isSaving    = atom<boolean>(false)
export const $selectedId  = atom<string | null>(null)

export function setBlocks(blocks: Block[]) {
  $blocks.set(blocks)
  $isDirty.set(false)
}

export function reorderBlocksLocally(orderedIds: string[]) {
  const map = new Map($blocks.get().map(b => [b.id, b]))
  const reordered = orderedIds
    .map((id, i) => {
      const block = map.get(id)
      return block ? { ...block, position: (i + 1) * 10 } : null
    })
    .filter((b): b is Block => b !== null)

  $blocks.set(reordered)
  $isDirty.set(true)
}

export function updateBlockLocally(id: string, updates: Partial<Block>) {
  $blocks.set($blocks.get().map(b => b.id === id ? { ...b, ...updates } : b))
  $isDirty.set(true)
}

export function removeBlockLocally(id: string) {
  $blocks.set($blocks.get().filter(b => b.id !== id))
  $isDirty.set(true)
}

export async function saveOrder(): Promise<void> {
  const ids = $blocks.get().map(b => b.id)
  $isSaving.set(true)
  try {
    await fetch('/api/blocks/reorder', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ blockIds: ids }),
    })
    $isDirty.set(false)
  } finally {
    $isSaving.set(false)
  }
}