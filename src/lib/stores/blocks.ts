import { atom, map, computed } from 'nanostores';
import type { Database } from '@/lib/supabase/database.types';

type Block = Database['public']['Tables']['blocks']['Row'];

// ==================== STORES ====================

// All blocks
export const $blocks = atom<Block[]>([]);

// Loading state
export const $blocksLoading = atom<boolean>(false);

// Error state
export const $blocksError = atom<string | null>(null);

// Selected block ID
export const $selectedBlockId = atom<string | null>(null);

// ==================== COMPUTED ====================

// Active blocks only
export const $activeBlocks = computed($blocks, (blocks) => {
  return blocks.filter(b => b.active);
});

// Blocks by type
export const $blocksByType = computed($blocks, (blocks) => {
  const byType: Record<string, Block[]> = {};
  blocks.forEach(block => {
    if (!byType[block.type]) {
      byType[block.type] = [];
    }
    byType[block.type].push(block);
  });
  return byType;
});

// Selected block
export const $selectedBlock = computed(
  [$blocks, $selectedBlockId], 
  (blocks, selectedId) => {
    if (!selectedId) return null;
    return blocks.find(b => b.id === selectedId) || null;
  }
);

// Block count
export const $blockCount = computed($blocks, (blocks) => blocks.length);

// Active block count
export const $activeBlockCount = computed($activeBlocks, (blocks) => blocks.length);

// ==================== ACTIONS ====================

/**
 * Set all blocks
 */
export function setBlocks(blocks: Block[]) {
  $blocks.set(blocks);
}

/**
 * Add a block
 */
export function addBlock(block: Block) {
  $blocks.set([...$blocks.get(), block]);
}

/**
 * Update a block
 */
export function updateBlock(id: string, updates: Partial<Block>) {
  $blocks.set(
    $blocks.get().map(block =>
      block.id === id ? { ...block, ...updates } : block
    )
  );
}

/**
 * Delete a block
 */
export function deleteBlock(id: string) {
  $blocks.set($blocks.get().filter(block => block.id !== id));
}

/**
 * Reorder blocks
 */
export function reorderBlocks(blockIds: string[]) {
  const blocks = $blocks.get();
  const reordered = blockIds.map((id, index) => {
    const block = blocks.find(b => b.id === id);
    if (!block) return null;
    return { ...block, position: index };
  }).filter(Boolean) as Block[];
  
  $blocks.set(reordered);
}

/**
 * Toggle block active status
 */
export function toggleBlockActive(id: string) {
  const block = $blocks.get().find(b => b.id === id);
  if (block) {
    updateBlock(id, { active: !block.active });
  }
}

/**
 * Select a block
 */
export function selectBlock(id: string | null) {
  $selectedBlockId.set(id);
}

/**
 * Set loading state
 */
export function setBlocksLoading(loading: boolean) {
  $blocksLoading.set(loading);
}

/**
 * Set error state
 */
export function setBlocksError(error: string | null) {
  $blocksError.set(error);
}

/**
 * Fetch blocks from API
 */
export async function fetchBlocks() {
  setBlocksLoading(true);
  setBlocksError(null);

  try {
    const response = await fetch('/api/blocks');
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch blocks');
    }

    setBlocks(data.blocks);
  } catch (error) {
    setBlocksError(error instanceof Error ? error.message : 'Unknown error');
  } finally {
    setBlocksLoading(false);
  }
}

/**
 * Create block with optimistic update
 */
export async function createBlock(blockData: Partial<Block>) {
  // Optimistic update
  const tempId = `temp-${Date.now()}`;
  const tempBlock: Block = {
    id: tempId,
    profile_id: '',
    type: blockData.type || 'link',
    title: blockData.title || null,
    config: blockData.config || {},
    active: true,
    position: $blocks.get().length,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...blockData,
  } as Block;

  addBlock(tempBlock);

  try {
    const response = await fetch('/api/blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(blockData),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to create block');
    }

    // Replace temp block with real block
    deleteBlock(tempId);
    addBlock(data.block);

    return data.block;
  } catch (error) {
    // Rollback on error
    deleteBlock(tempId);
    throw error;
  }
}

/**
 * Update block with optimistic update
 */
export async function updateBlockOptimistic(id: string, updates: Partial<Block>) {
  // Store previous state for rollback
  const previousBlock = $blocks.get().find(b => b.id === id);
  if (!previousBlock) return;

  // Optimistic update
  updateBlock(id, updates);

  try {
    const response = await fetch(`/api/blocks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to update block');
    }

    // Update with server response
    updateBlock(id, data.block);

    return data.block;
  } catch (error) {
    // Rollback on error
    updateBlock(id, previousBlock);
    throw error;
  }
}

/**
 * Delete block with optimistic update
 */
export async function deleteBlockOptimistic(id: string) {
  // Store previous state for rollback
  const previousBlock = $blocks.get().find(b => b.id === id);
  if (!previousBlock) return;

  // Optimistic update
  deleteBlock(id);

  try {
    const response = await fetch(`/api/blocks/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to delete block');
    }
  } catch (error) {
    // Rollback on error
    addBlock(previousBlock);
    throw error;
  }
}