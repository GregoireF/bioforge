import type { APIRoute } from "astro"
import { wrapApiHandler } from "@/lib/api/middleware"
import { getProfile } from '@/lib/db/queries.server'
import { getBlocks } from '@/lib/supabase/queries'
import { AppError, ErrorCode } from '@/lib/core/errors';

interface ExportData {
  exported_at: string;
  profile: Record<string, unknown>;
  blocks: unknown[];
}

export const GET: APIRoute = wrapApiHandler<undefined, ExportData>(
  async ({ supabase, user }) => {
    const [profileResult, blocksResult] = await Promise.all([
      getProfile(supabase, user.id),
      getBlocks(user.id),
    ]);

    if (!profileResult.success || !profileResult.data) {
      throw new AppError({
        message: 'Failed to fetch profile',
        code: ErrorCode.DB_ERROR,
        statusCode: 500,
      });
    }

    // Strip sensitive fields before export
    const { id: _id, ...safeProfile } = profileResult.data as Record<string, unknown>;

    return {
      exported_at: new Date().toISOString(),
      profile: safeProfile,
      blocks: blocksResult.success ? (blocksResult.data ?? []) : [],
    };
  }
);
