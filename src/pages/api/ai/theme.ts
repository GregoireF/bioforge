import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  // ── Vérification clé Groq ────────────────────────────────────────────────
  if (!import.meta.env.GROQ_API_KEY?.trim()) {
    console.error('[ai/theme] GROQ_API_KEY manquante');
    return new Response(
      JSON.stringify({ error: 'Configuration serveur invalide' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await request.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 3) {
      return new Response(
        JSON.stringify({ error: 'prompt manquant ou trop court' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize prompt — max 500 chars, no injections
    const safePrompt = prompt.trim().slice(0, 500).replace(/[<>]/g, '');

    const systemPrompt = `Tu es un designer expert en identité visuelle pour pages de liens (style Linktree/BioForge).
Tu génères des thèmes visuels cohérents, distinctifs et adaptés au profil décrit.

RÈGLES STRICTES :
- Réponds UNIQUEMENT avec un objet JSON valide, sans aucun texte avant ou après
- Respecte exactement les valeurs autorisées pour chaque champ
- Les couleurs hex doivent être des codes valides (#rrggbb)
- Assure-toi que le contraste texte/fond est suffisant pour la lisibilité
- Sois créatif et cohérent avec la personnalité décrite`;

    const userPrompt = `Génère un thème BioForge complet pour ce profil : "${safePrompt}"

Format JSON exact (aucun texte autour) :
{
  "background_color": "#xxxxxx",
  "primary_color": "#xxxxxx",
  "text_color": "#xxxxxx",
  "gradient_color_2": "#xxxxxx",
  "background_style": "solid|gradient|blur",
  "gradient_type": "linear|radial",
  "gradient_angle": 0,
  "pattern": "none|dots|grid|waves|noise|mesh",
  "pattern_opacity": 15,
  "button_style": "filled|outline|glass|gradient|neon|minimal",
  "border_radius": 14,
  "font_family": "Exo 2|Orbitron|Rajdhani|Bebas Neue|Audiowide|Russo One|Quicksand|Figtree",
  "animation_preset": "none|fade|slide|bounce|stagger",
  "avatar_shape": "circle|square|hex|ring",
  "spacing": "compact|normal|spacious",
  "block_shadow": true,
  "animations": true,
  "reasoning": "Explication courte en français (max 80 mots) de tes choix design"
}`;

    // ── Appel Groq ──────────────────────────────────────────────────────────
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 25_000);

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.GROQ_API_KEY.trim()}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt   },
        ],
        max_tokens: 500,
        temperature: 0.8,
        response_format: { type: 'json_object' }, // Force JSON output
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

      console.error('[ai/theme] Groq error:', groqResponse.status, errorDetail);

      const debugInfo = import.meta.env.DEV
        ? { debug: { status: groqResponse.status, detail: errorDetail.slice(0, 400) } }
        : {};

      return new Response(
        JSON.stringify({ error: 'Assistant temporairement indisponible', ...debugInfo }),
        {
          status: groqResponse.status >= 500 ? 502 : groqResponse.status,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const data = await groqResponse.json();
    const rawText = data.choices?.[0]?.message?.content ?? '{}';

    // ── Parse + sanitize le JSON retourné ───────────────────────────────────
    let parsed: Record<string, any>;
    try {
      const clean = rawText.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      console.error('[ai/theme] JSON parse error, raw:', rawText.slice(0, 300));
      return new Response(
        JSON.stringify({ error: 'Réponse IA invalide, réessaie' }),
        { status: 422, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const HEX = /^#[0-9A-Fa-f]{6}$/;
    const FONTS = ['Exo 2','Orbitron','Rajdhani','Bebas Neue','Audiowide','Russo One','Quicksand','Figtree'];

    const theme = {
      background_color:  HEX.test(parsed.background_color)  ? parsed.background_color  : '#0a0a0a',
      primary_color:     HEX.test(parsed.primary_color)     ? parsed.primary_color     : '#00ff9d',
      text_color:        HEX.test(parsed.text_color)        ? parsed.text_color        : '#ffffff',
      gradient_color_2:  HEX.test(parsed.gradient_color_2)  ? parsed.gradient_color_2  : '#1a1a2e',
      background_style:  ['solid','gradient','blur'].includes(parsed.background_style) ? parsed.background_style : 'solid',
      gradient_type:     ['linear','radial'].includes(parsed.gradient_type) ? parsed.gradient_type : 'linear',
      gradient_angle:    Math.min(Math.max(parseInt(parsed.gradient_angle) || 135, 0), 360),
      pattern:           ['none','dots','grid','waves','noise','mesh'].includes(parsed.pattern) ? parsed.pattern : 'none',
      pattern_opacity:   Math.min(Math.max(parseInt(parsed.pattern_opacity) || 15, 5), 60),
      button_style:      ['filled','outline','glass','gradient','neon','minimal'].includes(parsed.button_style) ? parsed.button_style : 'filled',
      border_radius:     Math.min(Math.max(parseInt(parsed.border_radius) || 14, 0), 32),
      font_family:       FONTS.includes(parsed.font_family) ? parsed.font_family : 'Exo 2',
      animation_preset:  ['none','fade','slide','bounce','stagger'].includes(parsed.animation_preset) ? parsed.animation_preset : 'fade',
      avatar_shape:      ['circle','square','hex','ring'].includes(parsed.avatar_shape) ? parsed.avatar_shape : 'circle',
      spacing:           ['compact','normal','spacious'].includes(parsed.spacing) ? parsed.spacing : 'normal',
      block_shadow:      typeof parsed.block_shadow === 'boolean' ? parsed.block_shadow : true,
      animations:        typeof parsed.animations   === 'boolean' ? parsed.animations   : true,
      reasoning:         typeof parsed.reasoning === 'string' ? parsed.reasoning.slice(0, 200) : '',
    };

    return new Response(
      JSON.stringify({ theme }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('[ai/theme] endpoint error:', err?.message || err);

    const status  = err?.name === 'AbortError' ? 504 : 500;
    const message = err?.name === 'AbortError' ? 'Délai dépassé' : 'Erreur interne';

    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { 'Content-Type': 'application/json' } }
    );
  }
};