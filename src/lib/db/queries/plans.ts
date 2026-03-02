import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { AppError, ErrorCode } from "@/lib/core/errors";

type PlanLimit = Database["public"]["Tables"]["plan_limits"]["Row"];

const planCache = new Map<string, PlanLimit>();
const PLAN_CACHE_TTL = 60 * 60 * 1000; // 1h

export async function getPlanLimits(
  supabase: SupabaseClient<Database>,
  plan: string
): Promise<PlanLimit> {
  if (!plan) throw new AppError({ message: "Plan ID required", code: ErrorCode.VALIDATION_ERROR });

  const cached = planCache.get(plan);
  if (cached) return cached;

  const { data, error } = await supabase
    .from("plan_limits")
    .select("*")
    .eq("plan", plan)
    .single();

  if (error) throw new AppError({ message: error.message, code: ErrorCode.DB_ERROR });
  if (!data) throw new AppError({ message: "Plan not found", code: ErrorCode.NOT_FOUND, statusCode: 404 });

  planCache.set(plan, data);
  setTimeout(() => planCache.delete(plan), PLAN_CACHE_TTL);

  return data;
}