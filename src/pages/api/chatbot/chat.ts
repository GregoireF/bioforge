import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  // 1. Vérification de la clé Groq (remplace ANTHROPIC par GROQ)
  if (!import.meta.env.GROQ_API_KEY?.trim()) {
    console.error('GROQ_API_KEY manquante ou vide dans les variables d’environnement');
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

    // ── Prompt système contextuel (inchangé) ──────────────────────────────────
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

    // ── Appel Groq API (OpenAI-compatible) ────────────────────────────────────
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000); // 30s max – Groq est très rapide

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.GROQ_API_KEY.trim()}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile', // Très bon équilibre qualité/vitesse en mars 2026 (gratuit tier)
        // Alternatives gratuites populaires sur Groq :
        // 'llama-3.1-70b-versatile'   → excellent raisonnement
        // 'llama-3.1-8b-instant'      → ultra-rapide, moins cher en tokens
        // 'mixtral-8x7b-32768'        → bon multilingual
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.slice(-10), // garde les 10 derniers pour le contexte
        ],
        max_tokens: 600,
        temperature: 0.7,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!groqResponse.ok) {
      let errorDetail = 'Erreur inconnue';
      try {
        const errBody = await groqResponse.json();
        errorDetail = JSON.stringify(errBody);
      } catch {
        errorDetail = await groqResponse.text().catch(() => '(pas de body)');
      }

      console.error(
        'Groq error:',
        groqResponse.status,
        groqResponse.statusText,
        'Detail:', errorDetail,
        'Model utilisé:', 'llama-3.3-70b-versatile'
      );

      const debugInfo = import.meta.env.DEV
        ? { debug: { status: groqResponse.status, groqDetail: errorDetail.slice(0, 400) } }
        : {};

      return new Response(
        JSON.stringify({
          error: 'Assistant temporairement indisponible',
          ...debugInfo,
        }),
        {
          status: groqResponse.status >= 500 ? 502 : groqResponse.status, // propage 429 si rate limit par ex.
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const data = await groqResponse.json();

    // Format de réponse compatible avec ton frontend (qui attend du style Anthropic)
    // Groq renvoie { choices: [{ message: { content: "..." } }] }
    const replyContent = data.choices?.[0]?.message?.content ?? '';

    return new Response(
      JSON.stringify({
        content: [{ text: replyContent }], // simule format Anthropic Messages
        // ou directement { reply: replyContent } si tu préfères simplifier le front plus tard
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );

  } catch (err: any) {
    console.error('Chat endpoint error:', err?.message || err);

    const status = err?.name === 'AbortError' ? 504 : 500;
    const message =
      err?.name === 'AbortError'
        ? 'Délai d’attente dépassé'
        : 'Erreur interne';

    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { 'Content-Type': 'application/json' } }
    );
  }
};