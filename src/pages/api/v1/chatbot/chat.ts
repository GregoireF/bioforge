// src/pages/api/chatbot/index.ts
import type { APIRoute } from 'astro'
import { chatBodySchema } from '@/lib/schemas'
import { json }           from '@/lib/core/http'

export const POST: APIRoute = async ({ request }) => {
  if (!request.headers.get('content-type')?.includes('application/json'))
    return new Response(null, { status: 415 })

  const apiKey = import.meta.env.GROQ_API_KEY?.trim()
  if (!apiKey) return json({ error: 'Configuration serveur invalide' }, 500)

  let body: unknown
  try { body = await request.json() }
  catch { return json({ error: 'Invalid JSON' }, 400) }

  const parsed = chatBodySchema.safeParse(body)
  if (!parsed.success)
    return json({ error: 'Validation error', issues: parsed.error.flatten().fieldErrors }, 400)

  const { messages, context } = parsed.data

  const systemPrompt = `Tu es l'assistant IA BioForge pour créateurs de contenu.
CONTEXTE : Nom: ${context?.displayName ?? 'Utilisateur'} | Plan: ${context?.plan ?? 'Free'} | @${context?.username ?? ''} | Payant: ${context?.isPaid ? 'oui' : 'non'}
Réponds en français, concis, 3-4 paragraphes max, actions concrètes.`

  const controller = new AbortController()
  const timeoutId  = setTimeout(() => controller.abort(), 30_000)

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'system', content: systemPrompt }, ...messages.slice(-10)],
        max_tokens: 600, temperature: 0.7,
      }),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!groqRes.ok) {
      let detail = '(pas de body)'
      try { detail = JSON.stringify(await groqRes.json()).slice(0, 400) } catch { detail = await groqRes.text().catch(() => detail) }
      console.error('[chatbot] Groq error:', groqRes.status, detail)
      return json({ error: 'Assistant temporairement indisponible',
        ...(import.meta.env.DEV ? { debug: { status: groqRes.status, detail } } : {}) },
        groqRes.status >= 500 ? 502 : groqRes.status)
    }

    const data    = await groqRes.json() as { choices?: { message?: { content?: string } }[] }
    const content = data.choices?.[0]?.message?.content ?? ''
    return json({ content: [{ text: content }] })

  } catch (err) {
    clearTimeout(timeoutId)
    const isAbort = err instanceof Error && err.name === 'AbortError'
    if (!isAbort) console.error('[chatbot] error:', err instanceof Error ? err.message : String(err))
    return json({ error: isAbort ? "Délai d'attente dépassé" : 'Erreur interne' }, isAbort ? 504 : 500)
  }
}