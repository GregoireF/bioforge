// src/pages/api/ai/social-post.ts
import type { APIRoute } from 'astro';
import { withAuth } from '@/lib/auth/auth';

const ok  = (d: unknown) => new Response(JSON.stringify({ success: true, ...d }), { headers: { 'Content-Type': 'application/json' } });
const err = (m: string, s = 400) => new Response(JSON.stringify({ success: false, error: m }), { status: s, headers: { 'Content-Type': 'application/json' } });

const TONE_PROMPTS: Record<string, string> = {
  hype:         'Le ton est TRÈS enthousiaste, excité, avec émoticônes, caps occasionnels, énergie maximale.',
  chill:        'Le ton est détendu, authentique, conversationnel, comme parler à un ami.',
  professional: 'Le ton est professionnel, crédible, concis, sans fautes.',
  funny:        'Le ton est drôle, léger, avec de l\'humour et des références pop culture.',
  storytelling: 'Le ton est narratif et émouvant, raconte une micro-histoire courte.',
  question:     'Le post se termine par une question ouverte pour maximiser l\'engagement.',
};

const TYPE_PROMPTS: Record<string, string> = {
  announce:  'C\'est une annonce de live / stream / événement à venir.',
  collab:    'C\'est une annonce de collaboration avec un autre créateur.',
  product:   'C\'est une promotion de produit ou de merch.',
  behind:    'C\'est un contenu coulisses / behind the scenes.',
  milestone: 'C\'est une célébration d\'une milestone (abonnés, vues, etc.).',
  question:  'C\'est une question à la communauté pour générer de l\'engagement.',
  custom:    'C\'est un post sur le sujet donné.',
};

const PLATFORM_TIPS: Record<string, string> = {
  instagram: 'Rédige pour Instagram: accroche forte en première ligne (avant le "voir plus"), storytelling, émoticônes pertinentes.',
  tiktok:    'Rédige pour TikTok: ultra court, percutant, avec un hook en première phrase, style GenZ.',
  twitter:   'Rédige pour X/Twitter: max 280 caractères, percutant, direct, sans hashtags dans le corps (ils vont à la fin).',
  youtube:   'Rédige pour YouTube Community: peut être plus long, inclure une question, CTA vers la vidéo.',
  discord:   'Rédige pour Discord: ton communautaire, informal, @everyone si annonce importante.',
  twitch:    'Rédige pour Twitch: annonce de stream, heure, jeu, lien direct.',
};

export const POST: APIRoute = async (ctx) => {
  if (!ctx.request.headers.get('content-type')?.includes('application/json')) return err('Invalid content type', 415);

  const auth = await withAuth(ctx);
  if (!auth.success || !auth.data) return err('Unauthorized', 401);

  const _pl    = auth.data.planLimits as any;
  const plan   = _pl?.plan ?? (auth.data.profile as any)?.plan ?? 'free';
  const PAID   = ['creator', 'pro', 'enterprise', 'business', 'team'];
  const PROS   = ['pro', 'enterprise', 'business', 'team'];
  if (!PAID.includes(plan)) return err('Plan Creator requis pour les posts IA', 403);

  let body: any;
  try { body = await ctx.request.json(); } catch { return err('Invalid JSON', 400); }

  const { prompt, type = 'custom', tone = 'chill', platforms = [], hashtag_count = 5 } = body;
  if (!prompt?.trim()) return err('Prompt requis', 400);

  const profile = auth.data.profile;
  const platformTips = platforms.length > 0
    ? platforms.map((p: string) => PLATFORM_TIPS[p] ?? '').filter(Boolean).join('\n')
    : 'Rédige un post polyvalent pour les réseaux sociaux.';

  const systemPrompt = `Tu es un expert en social media pour créateurs de contenu. Tu écris des posts engageants, authentiques et optimisés pour la viralité.

Infos créateur:
- Nom: ${profile.display_name || profile.username}
- Bio: ${profile.bio || 'Créateur de contenu'}
- Plateformes cibles: ${platforms.join(', ') || 'général'}

Règles absolues:
- Écris UNIQUEMENT le texte du post (pas d'introduction, pas d'explication)
- ${TYPE_PROMPTS[type] ?? TYPE_PROMPTS.custom}
- ${TONE_PROMPTS[tone] ?? TONE_PROMPTS.chill}
- ${platformTips}
- Adapte la longueur à la plateforme principale
- N'invente PAS de chiffres (abonnés, vues, etc.) sauf si le contexte les mentionne
- Réponds UNIQUEMENT en JSON avec ce format exact:
{
  "content": "le texte du post ici",
  "hashtags": ["#hashtag1", "#hashtag2", ...],
  "alt_version": "une version alternative plus courte"
}`;

  const userMessage = `Sujet / contexte: ${prompt}

Génère ${hashtag_count > 0 ? `${hashtag_count} hashtags pertinents` : 'aucun hashtag'}.`;

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${import.meta.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model:       'llama-3.3-70b-versatile',
        temperature: 0.85,
        max_tokens:  1000,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userMessage },
        ],
      }),
    });

    if (!groqRes.ok) {
      const groqErr = await groqRes.text();
      console.error('Groq error:', groqErr);
      return err('Erreur API Groq', 500);
    }

    const groqData = await groqRes.json();
    const rawText  = groqData.choices?.[0]?.message?.content ?? '';

    // Parse JSON from response
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return err('Réponse IA invalide', 500);

    const parsed = JSON.parse(jsonMatch[0]);

    return ok({
      content:     parsed.content ?? '',
      hashtags:    Array.isArray(parsed.hashtags) ? parsed.hashtags.slice(0, hashtag_count || 20) : [],
      alt_version: parsed.alt_version ?? null,
    });

  } catch (e: any) {
    console.error('Social post generation error:', e);
    return err('Erreur de génération', 500);
  }
};