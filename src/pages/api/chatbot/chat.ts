// src/pages/api/chatbot/index.ts
// POST — assistant IA BioForge via Groq (public — pas d'auth requise)
import type { APIRoute } from 'astro'
import { z }             from 'zod'
import { json }          from '@/lib/core/http'

// ─── Schemas ──────────────────────────────────────────────────────────────────

const messageSchema = z.object({
  role:    z.enum(['user', 'assistant']),
  content: z.string().min(1).max(4000),
})

const contextSchema = z.object({
  displayName: z.string().max(80).optional(),
  plan:        z.string().max(20).optional(),
  username:    z.string().max(24).optional(),
  isPaid:      z.boolean().optional(),
}).strict()

const bodySchema = z.object({
  messages: z.array(messageSchema).min(1).max(20),
  context:  contextSchema.optional(),
}).strict()

// ─── Route ────────────────────────────────────────────────────────────────────

export const POST: APIRoute = async ({ request }) => {
  if (!request.headers.get('content-type')?.includes('application/json'))
    return new Response(null, { status: 415 })

  const apiKey = import.meta.env.GROQ_API_KEY?.trim()
  if (!apiKey) {
    console.error('[chatbot] GROQ_API_KEY manquante')
    return json({ error: 'Configuration serveur invalide' }, 500)
  }

  let body: unknown
  try { body = await request.json() }
  catch { return json({ error: 'Invalid JSON' }, 400) }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success)
    return json({ error: 'Validation error', issues: parsed.error.flatten().fieldErrors }, 400)

  const { messages, context } = parsed.data

  const systemPrompt = `Tu es l'assistant IA intégré au dashboard BioForge, une plateforme de bio-links pour créateurs de contenu.

CONTEXTE UTILISATEUR :
- Nom : ${context?.displayName ?? 'Utilisateur'}
- Plan : ${context?.plan ?? 'Free'}
- Username : @${context?.username ?? ''}
- Plan payant : ${context?.isPaid ? 'oui' : 'non'}

TES CAPACITÉS :
- Optimiser la page publique (bio, blocks, thème, apparence)
- Analyser les métriques et analytics
- Conseiller sur les blocks (link, social, heading, image, video, spacer)
- Expliquer les plans (Free → Creator → Pro → Enterprise)
- Rédiger des bios et titres de liens accrocheurs
- Stratégie de croissance pour créateurs

FONCTIONNALITÉS BIOFORGE :
- Blocks : link, social, heading, spacer, image, video, poll, countdown, etc.
- Thèmes : couleurs, polices, animations, styles de boutons
- Analytics : vues, clics, taux de conversion par block
- Plans : Free (15 blocks), Creator (30 blocks), Pro / Enterprise (illimité + analytics avancés)
- Page publique : bioforge.click/@username

STYLE :
- Réponds en français, concis et direct
- Maximum 3-4 paragraphes courts
- Actions concrètes et actionnables
- Si la question dépasse BioForge, réponds quand même avec bienveillance`

  const controller = new AbortController()
  const timeoutId  = setTimeout(() => controller.abort(), 30_000)

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:       'llama-3.3-70b-versatile',
        messages:    [
          { role: 'system', content: systemPrompt },
          ...messages.slice(-10),  // contexte : 10 derniers messages
        ],
        max_tokens:  600,
        temperature: 0.7,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!groqRes.ok) {
      let detail = '(pas de body)'
      try {
        const errBody = await groqRes.json()
        detail = JSON.stringify(errBody).slice(0, 400)
      } catch {
        detail = await groqRes.text().catch(() => '(pas de body)')
      }

      console.error('[chatbot] Groq error:', groqRes.status, detail)

      return json({
        error: 'Assistant temporairement indisponible',
        ...(import.meta.env.DEV ? { debug: { status: groqRes.status, detail } } : {}),
      }, groqRes.status >= 500 ? 502 : groqRes.status)
    }

    const data     = await groqRes.json() as { choices?: { message?: { content?: string } }[] }
    const content  = data.choices?.[0]?.message?.content ?? ''

    return json({ content: [{ text: content }] })

  } catch (err) {
    clearTimeout(timeoutId)

    const isAbort   = err instanceof Error && err.name === 'AbortError'
    const status    = isAbort ? 504 : 500
    const message   = isAbort ? 'Délai d\'attente dépassé' : 'Erreur interne'

    if (!isAbort) console.error('[chatbot] error:', err instanceof Error ? err.message : String(err))

    return json({ error: message }, status)
  }
}