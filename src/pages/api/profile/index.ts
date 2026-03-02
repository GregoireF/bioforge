import type { APIRoute } from 'astro';
import { z } from 'zod';
import type { Profile } from '@/lib/supabase/database.types';
import { wrapApiHandler } from '@/lib/api/middleware';
import { updateProfileSchema } from '@/lib/validation/profile';
import { getProfile, updateProfile } from '@/lib/db/queries.server';
import { AppError, ErrorCode } from '@/lib/core/errors';

type ProfileUpdateBody = z.infer<typeof updateProfileSchema> & { theme?: unknown };

// GET
export const GET: APIRoute = wrapApiHandler<undefined, Profile>(async ({ supabase, user }) => {
  const result = await getProfile(supabase, user.id);
  if (!result.success || !result.data) {
    throw new AppError({ message: 'Profile fetch failed', code: ErrorCode.DB_ERROR, statusCode: 500 });
  }
  return result.data;
});

// PUT
export const PUT: APIRoute = wrapApiHandler<ProfileUpdateBody, Profile>(async ({ supabase, user, body }) => {
  if (!body) throw new AppError({ message: 'Request body is required', code: ErrorCode.VALIDATION_ERROR, statusCode: 400 });

  const { theme, ...otherFields } = body;

  let validatedData: Record<string, unknown> = {};
  if (Object.keys(otherFields).length > 0) {
    const parsed = updateProfileSchema.safeParse(otherFields);
    if (!parsed.success) {
      throw new AppError({ message: 'Validation error', code: ErrorCode.VALIDATION_ERROR, statusCode: 400, meta: parsed.error.flatten() });
    }
    validatedData = parsed.data;
  }

  const dataToUpdate = { ...validatedData, ...(theme ? { theme: JSON.stringify(theme) } : {}) };
  if (Object.keys(dataToUpdate).length === 0) {
    throw new AppError({ message: 'No fields to update', code: ErrorCode.VALIDATION_ERROR, statusCode: 400 });
  }

  const result = await updateProfile(supabase, user.id, dataToUpdate);
  if (!result.success || !result.data) {
    throw new AppError({ message: 'Update failed', code: ErrorCode.DB_ERROR, statusCode: 500 });
  }

  return result.data;
});