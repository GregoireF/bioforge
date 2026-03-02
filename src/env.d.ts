interface ImportMetaEnv {
  readonly SUPABASE_URL: string
  readonly SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

import type { User } from '@supabase/supabase-js'

declare global {
  namespace App {
    interface Locals {
      user: User | null
    }
  }
}

/// <reference types="astro/client" />