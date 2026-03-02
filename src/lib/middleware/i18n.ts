import { defineMiddleware } from 'astro:middleware'

const SUPPORTED_LOCALES = ['fr', 'en']
const DEFAULT_LOCALE = 'fr'

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, cookies, redirect } = context

  let locale = cookies.get('preferred-locale')?.value

  if (!locale || !SUPPORTED_LOCALES.includes(locale)) {
    // Détection via header Accept-Language
    const accept = context.request.headers.get('accept-language') || ''
    locale = accept.split(',')[0].split('-')[0].toLowerCase()
    locale = SUPPORTED_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE

    // Sauvegarde dans cookie (durée longue)
    cookies.set('preferred-locale', locale, { path: '/', maxAge: 60 * 60 * 24 * 365 })
  }

  context.locals.locale = locale

  // Option : rediriger / → /fr/ ou /en/ si pas de préfixe
  if (url.pathname === '/' || url.pathname === '') {
    return redirect(`/${locale}`)
  }

  return next()
})