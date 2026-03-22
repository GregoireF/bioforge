import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY

if (!serviceRoleKey) {
  throw new Error('[supabaseAdmin] Missing SUPABASE_SERVICE_ROLE_KEY — server-only file')
}

export const supabaseAdmin = createClient<Database>(
  import.meta.env.PUBLIC_SUPABASE_URL,
  serviceRoleKey,
  {
    auth: {
      autoRefreshToken:   false,
      persistSession:     false,
      detectSessionInUrl: false,
    },
  }
)