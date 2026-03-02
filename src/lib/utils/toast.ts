// toast.ts – Version corrigée & modernisée – février 2026
export type ToastVariant = 'success' | 'error' | 'warning' | 'info' | 'loading' | 'default';

export interface ToastOptions {
  id?: string;
  duration?: number;           // 0 ou Infinity = persistant
  variant?: ToastVariant;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  action?: { label: string; onClick: (dismiss: () => void) => void };
  dismissible?: boolean;
  important?: boolean;
  rich?: boolean;
}

const DEFAULT_DURATION = 4200;
const MAX_VISIBLE = 5;
const SWIPE_THRESHOLD = 100;

// Map pour gérer les toasts (id → {element, timer})
const TOASTS = new Map<string, { el: HTMLElement; timer?: number }>();

// ──────────────────────────────────────────────── Styles globaux
if (typeof document !== 'undefined' && !document.getElementById('toast-global')) {
  const style = document.createElement('style');
  style.id = 'toast-global';
  style.textContent = `
    :root {
      --toast-bg: rgba(255, 255, 255, 0.92);
      --toast-border: rgba(0, 0, 0, 0.12);
      --toast-shadow: 0 10px 30px -10px rgba(0,0,0,0.18);
      --toast-text: #111827;
      --toast-success: #10b981;
      --toast-error: #ef4444;
      --toast-warning: #f59e0b;
      --toast-info: #3b82f6;
      --toast-loading: #6b7280;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --toast-bg: rgba(31, 41, 55, 0.92);
        --toast-border: rgba(255, 255, 255, 0.08);
        --toast-text: #f3f4f6;
        --toast-shadow: 0 10px 30px -10px rgba(0,0,0,0.5);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .toast-enter, .toast-exit, .toast { transition: none !important; animation: none !important; }
    }
    #toast-container {
      --gap: 0.75rem;
      gap: var(--gap);
    }
    .toast {
      transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease;
      will-change: transform, opacity;
    }
    .toast-enter-from { transform: translateY(12px) scale(0.97); opacity: 0; }
    .toast-enter-to   { transform: none; opacity: 1; }
    .toast-exit       { transform: translateY(-8px) scale(0.97); opacity: 0; }
  `;
  document.head.appendChild(style);
}

// ──────────────────────────────────────────────── Icons
const ICONS: Record<ToastVariant, string> = {
  success: `<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 13l4 4L19 7"/></svg>`,
  error:   `<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 18L18 6M6 6l12 12"/></svg>`,
  warning: `<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 9v2m0 4h.01M3 16c-.77 1.33.19 3 1.73 3h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3 16z"/></svg>`,
  info:    `<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
  loading: `<svg class="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 12a8 8 0 018-8v8h8a8 8 0 01-16 0z"/></svg>`,
  default: `<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`
};

// ──────────────────────────────────────────────── Utils
function getColor(variant: ToastVariant, rich = false, important = false) {
  const colors = {
    success: 'var(--toast-success)',
    error:   'var(--toast-error)',
    warning: 'var(--toast-warning)',
    info:    'var(--toast-info)',
    loading: 'var(--toast-loading)',
    default: 'var(--toast-info)'
  };
  const c = colors[variant];
  const opacity = important ? (rich ? 0.95 : 0.25) : 0.10;
  return {
    bg: `rgba(from ${c} r g b / ${opacity})`,
    text: `color: ${c};`,
    border: important 
      ? `border: 2px solid color-mix(in srgb, ${c} 60%, transparent);`
      : `border: 1px solid color-mix(in srgb, ${c} 30%, transparent);`
  };
}

function generateId() {
  return 'toast-' + Math.random().toString(36).slice(2, 10);
}

function getContainer(position: string): HTMLElement {
  let container = document.getElementById('toast-container') as HTMLElement | null;
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed z-[9999] flex flex-col gap-[--gap] pointer-events-none p-4 max-w-md w-full';
    
    const positions: Record<string, string> = {
      'top-right':     'top-0 right-0',
      'top-left':      'top-0 left-0',
      'bottom-right':  'bottom-0 right-0',
      'bottom-left':   'bottom-0 left-0',
      'top-center':    'top-4 left-1/2 -translate-x-1/2 items-center',
      'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2 items-center'
    };
    
    container.className += ' ' + (positions[position] || 'bottom-0 right-0');
    document.body.appendChild(container);
  }
  return container;
}

// ──────────────────────────────────────────────── Fonction principale (renommée createToast)
function createToast(message: string, options: ToastOptions = {}) {
  const id = options.id ?? generateId();
  const variant = options.variant ?? 'default';
  const duration = options.duration ?? (variant === 'loading' ? Infinity : DEFAULT_DURATION);
  const position = options.position ?? 'bottom-right';
  const dismissible = options.dismissible ?? true;
  const important = !!options.important;
  const rich = !!options.rich;

  const container = getContainer(position);

  // Limiter le nombre visible (supprime le plus ancien)
  if (container.children.length >= MAX_VISIBLE) {
    const oldestId = Array.from(TOASTS.keys())[0];
    dismiss(oldestId);
  }

  const { bg, text, border } = getColor(variant, rich, important);

  const toast = document.createElement('div');
  toast.id = id;
  toast.className = `toast toast-enter-from group flex items-center gap-3 px-4 py-3.5 rounded-xl backdrop-blur-xl shadow-[var(--toast-shadow)] pointer-events-auto select-none`;
  toast.style.cssText = `${bg}; ${border}; color: var(--toast-text);`;

  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', important || variant === 'error' ? 'assertive' : 'polite');

  let html = `<div class="flex-shrink-0" style="${text}">${ICONS[variant]}</div>`;
  html += `<span class="flex-1">${message}</span>`;

  if (options.action) {
    html += `<button class="px-3 py-1 text-xs font-medium rounded bg-black/10 hover:bg-black/20 dark:bg-white/15 dark:hover:bg-white/25 transition" data-action>${options.action.label}</button>`;
  }

  if (dismissible) {
    html += `
      <button aria-label="Fermer le toast" class="ml-auto opacity-70 hover:opacity-100 p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10" data-dismiss>
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 18L18 6M6 6l12 12"/></svg>
      </button>`;
  }

  toast.innerHTML = html;
  container.appendChild(toast);

  // Animation d'entrée
  requestAnimationFrame(() => {
    toast.classList.remove('toast-enter-from');
    toast.classList.add('toast-enter-to');
  });

  TOASTS.set(id, { el: toast });

  // Gestion du timer
  let timer: number | undefined;
  if (duration > 0 && Number.isFinite(duration)) {
    timer = window.setTimeout(() => dismiss(id), duration);

    const pause = () => timer && clearTimeout(timer);
    const resume = () => {
      if (timer) clearTimeout(timer);
      timer = window.setTimeout(() => dismiss(id), duration);
    };

    toast.addEventListener('pointerenter', pause);
    toast.addEventListener('focusin', pause);
    toast.addEventListener('pointerleave', resume);
    toast.addEventListener('focusout', resume);
  }

  // Swipe to dismiss (simplifié mais efficace)
  let startX = 0;
  const onTouchStart = (e: TouchEvent) => { startX = e.touches[0].clientX; };
  const onTouchMove = (e: TouchEvent) => {
    const diff = e.touches[0].clientX - startX;
    if (Math.abs(diff) > 20) {
      toast.style.transform = `translateX(${diff}px)`;
      toast.style.opacity = `${1 - Math.abs(diff) / 300}`;
    }
  };
  const onTouchEnd = (e: TouchEvent) => {
    const diff = e.changedTouches[0].clientX - startX;
    if (Math.abs(diff) > SWIPE_THRESHOLD) {
      dismiss(id);
    } else {
      toast.style.transform = '';
      toast.style.opacity = '';
    }
  };

  toast.addEventListener('touchstart', onTouchStart, { passive: true });
  toast.addEventListener('touchmove', onTouchMove, { passive: true });
  toast.addEventListener('touchend', onTouchEnd);

  // Boutons
  toast.querySelector('[data-dismiss]')?.addEventListener('click', () => dismiss(id));
  toast.querySelector('[data-action]')?.addEventListener('click', () => {
    options.action?.onClick(() => dismiss(id));
  });

  return id;
}

// ──────────────────────────────────────────────── API publique
function dismiss(id: string | 'all' = 'all') {
  if (id === 'all') {
    TOASTS.forEach((_, key) => dismiss(key));
    return;
  }

  const entry = TOASTS.get(id);
  if (!entry) return;

  clearTimeout(entry.timer);
  entry.el.classList.add('toast-exit');

  setTimeout(() => {
    entry.el.remove();
    TOASTS.delete(id);

    const container = document.getElementById('toast-container');
    if (container && container.children.length === 0) {
      container.remove();
    }
  }, 420);
}

function update(id: string, message: string) {
  const entry = TOASTS.get(id);
  if (entry) {
    const span = entry.el.querySelector('span');
    if (span) span.textContent = message;
  }
}

export const toast = Object.assign(
  (message: string, options?: ToastOptions) => createToast(message, { ...options, variant: 'default' }),
  {
    success:  (msg: string, opts?: ToastOptions) => createToast(msg, { ...opts, variant: 'success' }),
    error:    (msg: string, opts?: ToastOptions) => createToast(msg, { ...opts, variant: 'error', important: true }),
    warning:  (msg: string, opts?: ToastOptions) => createToast(msg, { ...opts, variant: 'warning' }),
    info:     (msg: string, opts?: ToastOptions) => createToast(msg, { ...opts, variant: 'info' }),
    loading:  (msg: string, opts?: ToastOptions) => createToast(msg, { ...opts, variant: 'loading', duration: Infinity }),
    promise: async <T>(
      promise: Promise<T>,
      messages: { loading: string; success: string | ((res: T) => string); error: string | ((err: any) => string) },
      opts?: ToastOptions
    ) => {
      const loadingId = toast.loading(messages.loading, opts);
      try {
        const result = await promise;
        dismiss(loadingId);
        const successMsg = typeof messages.success === 'function' ? messages.success(result) : messages.success;
        toast.success(successMsg, opts);
        return result;
      } catch (err) {
        dismiss(loadingId);
        const errorMsg = typeof messages.error === 'function' ? messages.error(err) : messages.error;
        toast.error(errorMsg, opts);
        throw err;
      }
    },
    dismiss,
    update,
    dismissAll: () => dismiss('all')
  }
);