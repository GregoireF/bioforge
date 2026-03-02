import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables: ' +
        'PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY are required.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    //flowType: 'pkce',
  }
});

export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

export async function getUser() {
  const session = await getSession();
  return session?.user ?? null;
}

export async function isAuthenticated() {
  const session = await getSession();
  return !!session?.user;
}