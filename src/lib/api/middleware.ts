// lib/api/middleware.ts
import type { APIRoute, APIContext } from 'astro';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { requireUser } from '@/lib/auth/require-user';
import { verifyContentType } from '@/lib/security/headers';
import { verifyCSRF } from '@/lib/security/csrf';
import { AppError, toAppError, ErrorCode } from '@/lib/core/errors';

export type APIMiddlewareHandler<TReq = any, TRes = any> = (context: {
  context: APIContext;
  user: User;
  supabase: SupabaseClient<Database>;
  body?: TReq;
}) => Promise<TRes> | TRes;

export interface WrapApiOptions {
  requireBody?: boolean;
}

/**
 * wrapApiHandler : middleware centralisé pour API Astro
 * - Auth + Supabase
 * - CSRF / Content-Type pour méthodes mutantes
 * - JSON parsing safe
 * - Logging + temps d’exécution
 * - Retour JSON uniforme
 */
export function wrapApiHandler<TReq = any, TRes = any>(
  handler: APIMiddlewareHandler<TReq, TRes>,
  options?: WrapApiOptions
): APIRoute {
  return async (context: APIContext) => {
    const { request } = context;
    const start = Date.now();
    const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

    try {
      const auth = await requireUser(context);
      if ('error' in auth) {
        throw new AppError({
          message: auth.error,
          code: ErrorCode.UNAUTHORIZED,
          statusCode: 401,
        });
      }

      if (mutatingMethods.includes(request.method)) {
        if (!verifyContentType(request)) {
          throw new AppError({
            message: 'Invalid content type',
            code: ErrorCode.FORBIDDEN,
            statusCode: 415,
          });
        }

        if (!verifyCSRF(request)) {
          throw new AppError({
            message: 'CSRF validation failed',
            code: ErrorCode.FORBIDDEN,
            statusCode: 403,
          });
        }
      }

      let body: TReq | undefined;
      if (mutatingMethods.includes(request.method)) {
        try {
          body = (await request.json()) as TReq;

          if (options?.requireBody && (!body || Object.keys(body).length === 0)) {
            throw new AppError({
              message: 'Request body is required',
              code: ErrorCode.VALIDATION_ERROR,
              statusCode: 400,
            });
          }
        } catch {
          throw new AppError({
            message: 'Invalid JSON body',
            code: ErrorCode.VALIDATION_ERROR,
            statusCode: 400,
          });
        }
      }

      const result = await handler({
        context,
        user: auth.user,
        supabase: auth.supabase,
        body,
      });

      console.info(`[API ${request.method} ${request.url}] Success in ${Date.now() - start}ms`);

      return new Response(
        JSON.stringify({ success: true, data: result }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (err) {
      const appError = toAppError(err);

      console.error(`[API ${request.method} ${request.url}] Error in ${Date.now() - start}ms`, appError);

      return new Response(
        JSON.stringify({
          success: false,
          error: { code: appError.code, message: appError.message, meta: appError.meta },
        }),
        {
          status: appError.statusCode,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  };
}