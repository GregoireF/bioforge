const memoryStore = new Map<string, { count: number; expires: number }>();

export function rateLimit(key: string, limit = 60, windowMs = 60_000) {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || entry.expires < now) {
    memoryStore.set(key, { count: 1, expires: now + windowMs });
    return true;
  }

  if (entry.count >= limit) return false;

  entry.count++;
  return true;
}