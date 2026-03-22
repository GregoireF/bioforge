// SSR   → createSupabaseServer()  — pages Astro + API routes (session, RLS actives)
// Browser → createSupabaseBrowser() — islands React uniquement
// Admin  → supabaseAdmin           — API routes server-only (bypasse RLS)
 
export { createSupabaseServer }   from './supabase/server'
export { createSupabaseBrowser }  from './supabase/client'
export { supabaseAdmin }          from './supabase/admin'