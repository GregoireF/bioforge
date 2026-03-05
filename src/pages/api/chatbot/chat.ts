import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  // 1. Vérification basique de la clé API (évite des 500 inutiles)
  if (!import.meta.env.ANTHROPIC_API_KEY?.trim()) {
    console.error('ANTHROPIC_API_KEY manquante ou vide dans les variables d’environnement');
    return new Response(
      JSON.stringify({ error: 'Configuration serveur invalide' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await request.json();
    const { messages, context } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'messages doit être un tableau non vide' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ── Prompt système contextuel ─────────────────────────────────────────────
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

    // ── Appel API Anthropic (mars 2026) ───────────────────────────────────────
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45_000); // 45s max

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': import.meta.env.ANTHROPIC_API_KEY.trim(),
        'anthropic-version': '2023-06-01', // Version stable et toujours acceptée en 2026
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6', // Sweet spot perf/prix/vitesse en mars 2026
        // Alternatives si besoin :
        // 'claude-haiku-4-5'     → plus rapide et moins cher
        // 'claude-opus-4-6'      → le plus puissant (plus cher)
        max_tokens: 600,
        temperature: 0.7, // Ajouté : réponses plus naturelles et créatives
        system: systemPrompt,
        messages: messages.slice(-10), // Limite le contexte (économise tokens)
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorDetail = 'Erreur inconnue';
      try {
        const errBody = await response.json();
        errorDetail = JSON.stringify(errBody);
      } catch {
        errorDetail = await response.text().catch(() => '(pas de body)');
      }

      console.error(
        'Anthropic error:',
        response.status,
        response.statusText,
        'Detail:', errorDetail,
        'Model utilisé:', 'claude-sonnet-4-6'
      );

      // En dev, on renvoie plus d'infos au frontend pour debug
      const debugInfo = import.meta.env.DEV
        ? { debug: { status: response.status, anthropicDetail: errorDetail.slice(0, 400) } }
        : {};

      return new Response(
        JSON.stringify({
          error: 'Assistant temporairement indisponible',
          ...debugInfo,
        }),
        {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const data = await response.json();

    // Optionnel : on peut cleaner un peu la réponse si besoin
    // Mais ici on forward directement (format Messages API standard)
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('Chat endpoint error:', err?.message || err);

    const status = err?.name === 'AbortError' ? 504 : 500;
    const message =
      err?.name === 'AbortError'
        ? 'Délai d’attente dépassé (assistant trop lent)'
        : 'Erreur interne';

    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { 'Content-Type': 'application/json' } }
    );
  }
};