import { defineMiddleware } from 'astro:middleware'

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, request, locals } = context

  // Skip pour les routes dynamiques/auth sensibles
  if (
    url.pathname.startsWith('/dashboard') ||
    url.pathname.startsWith('/api/private') ||
    url.pathname.startsWith('/login') ||
    url.pathname.includes('?')  // queries → souvent dynamiques
  ) {
    return next()
  }

  // Exécute la requête en premier
  const response = await next()

  // Clone pour pouvoir lire le body si besoin (rare)
  const clonedResponse = response.clone()

  // Règles par chemin (exemples réalistes 2026)
  let cacheControl = 'public, max-age=60'  // défaut court

  if (url.pathname.startsWith('/blog/') || url.pathname === '/') {
    cacheControl = 'public, s-maxage=3600, stale-while-revalidate=86400'  // 1h CDN, SWR 1 jour
  } else if (url.pathname.startsWith('/docs/')) {
    cacheControl = 'public, s-maxage=86400, stale-while-revalidate=604800'  // 1 jour CDN, SWR 1 semaine
  } else if (url.pathname.match(/\.(jpg|png|webp|avif)$/)) {
    cacheControl = 'public, max-age=31536000, immutable'  // assets immuables 1 an
  }

  // Applique le header
  response.headers.set('Cache-Control', cacheControl)
  response.headers.set('Vary', 'Accept-Encoding, Accept')  // bon pour images/compression

  // Bonus : si on est sur un runtime qui expose Cache API (Cloudflare Workers, Deno, etc.)
  // Attention : Astro SSR n'expose pas toujours `caches` → test avec `if (typeof caches !== 'undefined')`
  if (typeof caches !== 'undefined' && request.method === 'GET' && response.status === 200) {
    try {
      const cache = await caches.open('astro-pages-cache-v1')
      // Optionnel : ne cache que si pas déjà un header no-cache présent
      if (!response.headers.has('CDN-Cache-Control') || !response.headers.get('CDN-Cache-Control')?.includes('no-store')) {
        await cache.put(request, clonedResponse)
      }
    } catch (err) {
      // Silencieux : fallback headers seulement
      console.debug('Cache API non supportée ou erreur:', err)
    }
  }

  return response
})