import type { APIContext } from 'astro'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { createSupabaseServer } from '@/lib/supabase/server'

type AuthSuccess = {
  user: User
  supabase: SupabaseClient<Database>
}

type AuthError = {
  error: string
}

export async function requireUser(
  context: APIContext
): Promise<AuthSuccess | AuthError> {
  const supabase = createSupabaseServer(context)

  const { data, error } = await supabase.auth.getUser()

  if (error || !data.user) {
    return { error: 'UNAUTHENTICATED' }
  }

  return { user: data.user, supabase }
}