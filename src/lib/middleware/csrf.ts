import { defineMiddleware } from 'astro:middleware'
import crypto from 'crypto'

const CSRF_COOKIE_NAME = 'csrf-token'
const CSRF_HEADER_NAME = 'X-CSRF-Token'  // ou 'X-XSRF-TOKEN' comme Angular/Laravel

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, cookies, locals, redirect } = context

  // Génère / régénère le token CSRF si absent (pour GET seulement)
  if (request.method === 'GET') {
    let token = cookies.get(CSRF_COOKIE_NAME)?.value

    if (!token) {
      token = crypto.randomBytes(32).toString('hex')
      cookies.set(CSRF_COOKIE_NAME, token, {
        path: '/',
        httpOnly: false,          // JS doit pouvoir le lire pour le header
        secure: import.meta.env.PROD,
        sameSite: 'strict',
        maxAge: 60 * 60 * 24     // 1 jour
      })
    }

    // Option : expose le token dans locals pour tes forms
    locals.csrfToken = token
  }

  // Vérification CSRF sur les méthodes mutantes
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    const cookieToken = cookies.get(CSRF_COOKIE_NAME)?.value
    const headerToken = request.headers.get(CSRF_HEADER_NAME)
    const formToken = await getFormToken(request)  // voir helper ci-dessous

    const submittedToken = headerToken || formToken

    if (!cookieToken || !submittedToken || cookieToken !== submittedToken) {
      // Échec CSRF → 403
      return new Response('Invalid CSRF token', { status: 403 })
    }

    // Option : régénère le token après succès pour one-time-use (plus sécurisé)
    // const newToken = crypto.randomBytes(32).toString('hex')
    // cookies.set(CSRF_COOKIE_NAME, newToken, { ... })
    // locals.csrfToken = newToken
  }

  return next()
})

// Helper pour lire le token depuis form-data (multipart ou urlencoded)
async function getFormToken(request: Request): Promise<string | null> {
  const contentType = request.headers.get('content-type') || ''
  if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
    try {
      const formData = await request.formData()
      return formData.get('csrf_token') as string | null
    } catch {}
  }
  return null
}

// Typage
declare module 'astro' {
  interface Locals {
    csrfToken?: string
  }
}