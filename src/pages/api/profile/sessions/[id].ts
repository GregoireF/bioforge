// src/pages/api/sessions/[id].ts

import type { APIRoute } from 'astro';
import { wrapApiHandler } from '@/lib/api/middleware';
import { AppError, ErrorCode } from '@/lib/core/errors';

// DELETE — revoke a single session by ID
// RLS ensures a user can only delete their own sessions.
export const DELETE: APIRoute = wrapApiHandler<undefined, { revoked: boolean }>(
  async ({ supabase, user, params }) => {
    const sessionId = params.id?.trim() ?? '';

    if (!sessionId) {
      throw new AppError({
        message: 'Session ID is required',
        code: ErrorCode.VALIDATION_ERROR,
        statusCode: 400,
      });
    }

    // Basic UUID format check — prevents injection
    if (!/^[0-9a-f-]{36}$/i.test(sessionId)) {
      throw new AppError({
        message: 'Invalid session ID format',
        code: ErrorCode.VALIDATION_ERROR,
        statusCode: 400,
      });
    }

    const { error, count } = await supabase
      .from('user_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', user.id); // RLS + explicit check

    if (error) {
      throw new AppError({
        message: 'Failed to revoke session',
        code: ErrorCode.DB_ERROR,
        statusCode: 500,
      });
    }

    if (count === 0) {
      throw new AppError({
        message: 'Session not found',
        code: ErrorCode.NOT_FOUND,
        statusCode: 404,
      });
    }

    return { revoked: true };
  }
);