// src/env.d.ts
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly SUPABASE_URL: string
  readonly SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare namespace App {
  interface Locals {
    user:     import('@supabase/supabase-js').User | null
    supabase: import('@supabase/supabase-js').SupabaseClient<
      import('@/lib/supabase/database.types').Database
    >
  }
}

// Propriétés custom sur window — islands et scripts inline
interface Window {
  openCommandPalette?: () => void
  adsbygoogle?: unknown[]
}