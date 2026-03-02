import { defineMiddleware } from 'astro:middleware'

export const onRequest = defineMiddleware(async (context, next) => {
  const start = Date.now()
  const { url, request, locals } = context
  const response = await next()
  const duration = Date.now() - start

  console.log(
    `[${request.method}] ${url.pathname} → ${response.status} ` +
    `(${duration}ms) user: ${locals.user?.email ?? 'anonymous'}`
  )

  if (import.meta.env.DEV) {
    response.headers.set('X-Response-Time', `${duration}ms`)
  }

  return response
})