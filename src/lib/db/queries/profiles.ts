// src/lib/db/queries/profiles.ts
import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { AppError, ErrorCode } from "@/lib/core/errors";

type Profile = Database['public']['Tables']['profiles']['Row']
type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

type TypedClient = SupabaseClient<Database>

export async function getProfile(
  supabase: TypedClient,
  userId: string
) {
  return supabase
    .from('profiles')
    .select('id, username, display_name, bio, avatar_url, updated_at')
    .eq('id', userId)
    .single()
}

export async function updateProfile(
  supabase: TypedClient,
  userId: string,
  data: ProfileUpdate
) {
  return supabase
    .from('profiles')
    .update(data)
    .eq('id', userId)
    .select('id, username, display_name, bio, avatar_url, updated_at')
    .single()
}