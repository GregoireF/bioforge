import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge classnames with Tailwind conflict resolution
 * Usage: cn('px-2 py-1', 'px-4') // Result: 'px-4 py-1'
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
















