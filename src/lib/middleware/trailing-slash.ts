import { defineMiddleware } from 'astro:middleware'

export const onRequest = defineMiddleware(async ({ url, redirect }, next) => {
  const { pathname } = url

  // Ignore les assets, API, etc.
  if (
    pathname.startsWith('/_astro/') ||
    pathname.startsWith('/api/') ||
    pathname.includes('.')   // fichiers avec extension
  ) {
    return next()
  }

  // Décide de ta stratégie : ici on force SANS trailing slash
  const wantsTrailingSlash = false   // change à true si tu préfères avec /

  const hasTrailingSlash = pathname.endsWith('/')
  const shouldRedirect =
    (wantsTrailingSlash && !hasTrailingSlash && pathname !== '/') ||
    (!wantsTrailingSlash && hasTrailingSlash && pathname !== '/')

  if (shouldRedirect) {
    const newPath = wantsTrailingSlash
      ? pathname + '/'
      : pathname.replace(/\/$/, '')

    const newUrl = new URL(newPath + url.search, url.origin)
    return redirect(newUrl.toString(), 301)
  }

  return next()
})