import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { AppError, ErrorCode } from "@/lib/core/errors";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

export async function getProfile(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<Profile> {
  if (!userId || userId.length < 8) {
    throw new AppError({
      message: "Invalid user ID",
      statusCode: 400,
      code: ErrorCode.VALIDATION_ERROR,
    });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .is("deleted_at", null)
    .single();

  if (error) throw new AppError({ message: error.message, code: ErrorCode.DB_ERROR });
  if (!data) throw new AppError({ message: "Profile not found", code: ErrorCode.NOT_FOUND, statusCode: 404 });

  return data;
}

export async function updateProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
  updates: ProfileUpdate
): Promise<Profile> {
  if (!userId || userId.length < 8) {
    throw new AppError({
      message: "Invalid user ID",
      statusCode: 400,
      code: ErrorCode.VALIDATION_ERROR,
    });
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ ...updates, updated_at: new Date().toISOString() } as any)
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new AppError({ message: error.message, code: ErrorCode.DB_ERROR });
  if (!data) throw new AppError({ message: "Profile update failed", code: ErrorCode.NOT_FOUND, statusCode: 404 });

  return data;
}