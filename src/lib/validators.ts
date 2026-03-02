// Reserved usernames that cannot be used
const RESERVED_USERNAMES = [
  'admin',
  'login',
  'register',
  'dashboard',
  'api',
  'auth',
  'settings',
  'profile',
  'user',
  'bioforge',
  'support',
  'help',
  'about',
  'terms',
  'privacy',
  'contact',
];

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateUsername(username: string): ValidationResult {
  if (!username) {
    return { valid: false, error: 'Username is required' };
  }

  if (username.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters' };
  }

  if (username.length > 20) {
    return { valid: false, error: 'Username must be at most 20 characters' };
  }

  const usernameRegex = /^[a-z0-9_]+$/;
  if (!usernameRegex.test(username)) {
    return {
      valid: false,
      error: 'Username can only contain lowercase letters, numbers, and underscores',
    };
  }

  if (RESERVED_USERNAMES.includes(username.toLowerCase())) {
    return { valid: false, error: 'This username is reserved' };
  }

  return { valid: true };
}

export function validateUrl(url: string): ValidationResult {
  if (!url) {
    return { valid: false, error: 'URL is required' };
  }

  // Check for javascript: protocol
  if (url.toLowerCase().startsWith('javascript:')) {
    return { valid: false, error: 'JavaScript URLs are not allowed' };
  }

  // Must start with http:// or https://
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return { valid: false, error: 'URL must start with http:// or https://' };
  }

  // Validate URL format
  try {
    new URL(url);
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

export function validateBio(bio: string): ValidationResult {
  if (!bio) {
    return { valid: true }; // Bio is optional
  }

  if (bio.length > 160) {
    return { valid: false, error: 'Bio must be at most 160 characters' };
  }

  return { valid: true };
}

export function validateDisplayName(displayName: string): ValidationResult {
  if (!displayName) {
    return { valid: true }; // Display name is optional
  }

  if (displayName.length > 50) {
    return { valid: false, error: 'Display name must be at most 50 characters' };
  }

  return { valid: true };
}

export function validateLinkTitle(title: string): ValidationResult {
  if (!title) {
    return { valid: false, error: 'Link title is required' };
  }

  if (title.length > 100) {
    return { valid: false, error: 'Link title must be at most 100 characters' };
  }

  return { valid: true };
}

export function sanitizeInput(input: string): string {
  return input.trim();
}
