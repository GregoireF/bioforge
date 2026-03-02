import { defineMiddleware } from 'astro:middleware'

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, request, redirect } = context
  const host = request.headers.get('host') || ''
  const protocol = request.headers.get('x-forwarded-proto') || url.protocol

  // 1. Forcer HTTPS en production
  if (import.meta.env.PROD && protocol !== 'https:') {
    return redirect(`https://${host}${url.pathname}${url.search}`, 301)
  }

  // 2. Option : rediriger www → non-www (ou l'inverse)
  if (host.startsWith('www.')) {
    const newHost = host.replace(/^www\./, '')
    return redirect(`${url.protocol}//${newHost}${url.pathname}${url.search}`, 301)
  }

  return next()
})