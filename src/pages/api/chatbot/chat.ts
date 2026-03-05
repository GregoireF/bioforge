import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { messages, context } = body;

    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Invalid messages' }), { status: 400 });
    }

    // ── Système prompt contextuel ────────────────────────────────────────────
    const systemPrompt = `Tu es l'assistant IA intégré au dashboard BioForge, une plateforme de bio-links (similaire à Linktree) pour créateurs de contenu.

CONTEXTE UTILISATEUR :
- Nom : ${context?.displayName ?? 'User'}
- Plan : ${context?.plan ?? 'Free'}
- Username : @${context?.username ?? ''}
- Plan payant : ${context?.isPaid ? 'oui' : 'non'}

TES CAPACITÉS :
Tu peux aider l'utilisateur à :
- Optimiser sa page publique (bio, blocks, apparence, thème)
- Comprendre ses analytics et métriques de performance
- Choisir les bons blocks (link, social, heading, image, video, spacer)
- Comprendre les différences entre les plans (Free → Pro → Business)
- Résoudre des problèmes techniques courants
- Rédiger une meilleure bio, des titres de liens accrocheurs
- Stratégie de contenu et croissance pour créateurs

FONCTIONNALITÉS BIOFORGE :
- Blocks : link (avec icône personnalisée), social, heading, spacer, image, video
- Thèmes personnalisables : couleurs, polices, animations, styles de boutons
- Analytics : vues, clics, taux de conversion par block
- Plans : Free (5 blocks), Pro (blocks illimités + analytics avancés + domaine custom), Business (tout + API)
- Badge de vérification disponible pour comptes notables
- Page publique accessible sur bioforge.click/@username

STYLE DE RÉPONSE :
- Réponds en français, de façon concise et directe
- Utilise des emojis avec parcimonie pour aérer les réponses importantes
- Maximum 3-4 paragraphes courts par réponse
- Propose des actions concrètes et actionnables
- Si la question dépasse BioForge, réponds quand même avec bienveillance`;

    // ── Appel API Anthropic ──────────────────────────────────────────────────
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': import.meta.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2025-10-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system: systemPrompt,
        messages: messages.slice(-10), // Max 10 derniers messages pour le contexte
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic API error:', err);
      return new Response(JSON.stringify({ error: 'AI unavailable' }), { status: 502 });
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Chat endpoint error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
  }
};




























