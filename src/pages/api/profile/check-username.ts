import type { APIRoute } from 'astro';
import { wrapApiHandler } from '@/lib/api/middleware';
import { AppError, ErrorCode } from '@/lib/core/errors';

export const GET: APIRoute = wrapApiHandler<undefined, { available: boolean; username: string }>(
  async ({ supabase, url }) => {
    const username = url.searchParams.get('username')?.trim().toLowerCase() ?? '';

    if (!username) {
      throw new AppError({
        message: 'Username is required',
        code: ErrorCode.VALIDATION_ERROR,
        statusCode: 400,
      });
    }

    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      throw new AppError({
        message: 'Invalid username format',
        code: ErrorCode.VALIDATION_ERROR,
        statusCode: 400,
      });
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', username)
      .maybeSingle();

    if (error) {
      throw new AppError({
        message: 'Failed to check username',
        code: ErrorCode.DB_ERROR,
        statusCode: 500,
      });
    }

    return { available: data === null, username };
  }
);