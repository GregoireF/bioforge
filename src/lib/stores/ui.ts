import { atom, map } from 'nanostores';

// ==================== STORES ====================

// Modals state
export const $modals = map<Record<string, boolean>>({});

// Sidebar state (mobile)
export const $sidebarOpen = atom<boolean>(false);

// Command palette state
export const $commandPaletteOpen = atom<boolean>(false);

// Loading overlay
export const $globalLoading = atom<boolean>(false);

// ==================== ACTIONS ====================

/**
 * Open a modal
 */
export function openModal(id: string) {
  $modals.setKey(id, true);
  document.body.style.overflow = 'hidden';
}

/**
 * Close a modal
 */
export function closeModal(id: string) {
  $modals.setKey(id, false);
  
  // Check if any modals are still open
  const anyOpen = Object.values($modals.get()).some(open => open);
  if (!anyOpen) {
    document.body.style.overflow = '';
  }
}

/**
 * Close all modals
 */
export function closeAllModals() {
  const modals = $modals.get();
  Object.keys(modals).forEach(id => {
    $modals.setKey(id, false);
  });
  document.body.style.overflow = '';
}

/**
 * Check if modal is open
 */
export function isModalOpen(id: string): boolean {
  return $modals.get()[id] || false;
}

/**
 * Toggle sidebar
 */
export function toggleSidebar() {
  $sidebarOpen.set(!$sidebarOpen.get());
}

/**
 * Open sidebar
 */
export function openSidebar() {
  $sidebarOpen.set(true);
}

/**
 * Close sidebar
 */
export function closeSidebar() {
  $sidebarOpen.set(false);
}

/**
 * Toggle command palette
 */
export function toggleCommandPalette() {
  $commandPaletteOpen.set(!$commandPaletteOpen.get());
}

/**
 * Open command palette
 */
export function openCommandPalette() {
  $commandPaletteOpen.set(true);
}

/**
 * Close command palette
 */
export function closeCommandPalette() {
  $commandPaletteOpen.set(false);
}

/**
 * Show global loading
 */
export function showGlobalLoading() {
  $globalLoading.set(true);
}

/**
 * Hide global loading
 */
export function hideGlobalLoading() {
  $globalLoading.set(false);
}

// ==================== KEYBOARD SHORTCUTS ====================

if (typeof window !== 'undefined') {
  // Command palette shortcut (Cmd/Ctrl + K)
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      toggleCommandPalette();
    }

    // Escape to close modals/command palette
    if (e.key === 'Escape') {
      if ($commandPaletteOpen.get()) {
        closeCommandPalette();
      } else {
        closeAllModals();
      }
    }
  });
}