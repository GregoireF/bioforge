import type { APIRoute } from 'astro';
import { createServerClient } from '@supabase/ssr';
import { parse } from 'cookie';
import { updateProfile } from '@/lib/db/queries.server';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE      = 2 * 1024 * 1024; // 2 MB
const BUCKET        = 'avatars'; // à adapter selon ton bucket Supabase Storage

export const POST: APIRoute = async ({ request }) => {
  try {
    // ── Auth (same pattern as wrapApiHandler) ──────────────────────────────
    const cookieHeader = request.headers.get('cookie') ?? '';
    const parsedCookies = parse(cookieHeader);

    const supabase = createServerClient(
      import.meta.env.PUBLIC_SUPABASE_URL!,
      import.meta.env.PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (key) => parsedCookies[key],
          set: () => {},
          remove: () => {},
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ── Parse multipart ────────────────────────────────────────────────────
    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.includes('multipart/form-data')) {
      return new Response(JSON.stringify({ error: 'Expected multipart/form-data' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const formData = await request.formData();
    const file     = formData.get('avatar');

    if (!file || !(file instanceof File)) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ── Validate ───────────────────────────────────────────────────────────
    if (!ALLOWED_TYPES.includes(file.type)) {
      return new Response(JSON.stringify({ error: 'Unsupported file type. Use JPG, PNG, WebP or GIF.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (file.size > MAX_SIZE) {
      return new Response(JSON.stringify({ error: 'File too large. Max 2 MB.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ── Upload to Supabase Storage ─────────────────────────────────────────
    const ext      = file.type.split('/')[1].replace('jpeg', 'jpg');
    const filename = `${user.id}/avatar-${Date.now()}.${ext}`;
    const buffer   = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filename, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      return new Response(JSON.stringify({ error: `Storage error: ${uploadError.message}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ── Get public URL ─────────────────────────────────────────────────────
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(filename);

    // ── Save URL to profile (reuse existing updateProfile) ─────────────────
    const result = await updateProfile(supabase, user.id, { avatar_url: publicUrl });
    if (!result.success) {
      return new Response(JSON.stringify({ error: 'Failed to save avatar URL to profile' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ avatar_url: publicUrl }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};