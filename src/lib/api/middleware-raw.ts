// lib/api/raw-handler.ts
import type { APIRoute, APIContext } from 'astro';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { requireUser } from '@/lib/auth/require-user';
import { AppError, toAppError, ErrorCode } from '@/lib/core/errors';

type RawHandler = (args: {
  context: APIContext; // Pas de <Params> ici, on gère en interne
  user?: User;
  supabase?: SupabaseClient<Database>;
}) => Promise<Response> | Response;

export function rawApiHandler(
  handler: RawHandler,
  { requireAuth = false }: { requireAuth?: boolean } = {}
): APIRoute {  // ← Pas de <Params> sur APIRoute
  return async (context: APIContext) => {
    const start = Date.now();
    const { request } = context;

    try {
      let user: User | undefined;
      let supabase: SupabaseClient<Database> | undefined;

      if (requireAuth) {
        const auth = await requireUser(context);
        if ('error' in auth) {
          throw new AppError({
            message: auth.error,
            code: ErrorCode.UNAUTHORIZED,
            statusCode: 401,
          });
        }
        user = auth.user;
        supabase = auth.supabase;
      }

      const response = await handler({ context, user, supabase });

      console.info(`[RAW ${request.method} ${request.url}] Success in ${Date.now() - start}ms`);
      return response;
    } catch (err) {
      const appError = toAppError(err);
      console.error(`[RAW ${request.method} ${request.url}] Error in ${Date.now() - start}ms`, appError);

      return new Response(
        JSON.stringify({
          success: false,
          error: { code: appError.code, message: appError.message },
        }),
        {
          status: appError.statusCode || 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  };
}