// src/pages/api/notifications/index.ts
import type { APIRoute }          from 'astro'
import type { ApiHandlerContext } from '@/lib/api/handler'
import { wrapApiHandler }         from '@/lib/api/handler'
import { createNotifSchema }      from '@/lib/schemas'
import type { CreateNotifInput }  from '@/lib/schemas'
import { AppError, ErrorCode }    from '@/lib/core/errors'
import type { Database }          from '@/lib/supabase/database.types'

type Notification = Database['public']['Tables']['notifications']['Row']

interface NotificationList {
  notifications: Pick<Notification, 'id' | 'type' | 'title' | 'body' | 'icon' | 'href' | 'is_read' | 'created_at' | 'meta'>[]
  unread: number
}

export const GET: APIRoute = wrapApiHandler<undefined, NotificationList>(
  async ({ supabase, user }: ApiHandlerContext<undefined>) => {
    const [listRes, countRes] = await Promise.all([
      supabase.from('notifications').select('id, type, title, body, icon, href, is_read, created_at, meta')
        .eq('user_id', user.id).order('is_read', { ascending: true }).order('created_at', { ascending: false }).limit(50),
      supabase.from('notifications').select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('is_read', false),
    ])
    if (listRes.error) throw new AppError({ message: listRes.error.message, code: ErrorCode.DB_ERROR, statusCode: 500 })
    return { notifications: listRes.data ?? [], unread: countRes.count ?? 0 }
  }
)

export const POST: APIRoute = wrapApiHandler<CreateNotifInput, { id: number }>(
  async ({ supabase, body }: ApiHandlerContext<CreateNotifInput>) => {
    if (!body) throw new AppError({ message: 'Body required', code: ErrorCode.VALIDATION_ERROR, statusCode: 400 })

    const parsed = createNotifSchema.safeParse(body)
    if (!parsed.success)
      throw new AppError({ message: 'Validation error', code: ErrorCode.VALIDATION_ERROR, statusCode: 400,
        meta: parsed.error.flatten() })

    const { data, error } = await supabase.from('notifications')
      .insert({ user_id: parsed.data.user_id, type: parsed.data.type, title: parsed.data.title,
        body: parsed.data.body ?? null, icon: parsed.data.icon ?? '✦', href: parsed.data.href ?? null })
      .select('id').single()

    if (error) throw new AppError({ message: error.message, code: ErrorCode.DB_ERROR, statusCode: 500 })
    return { id: data.id }
  },
  { requireBody: true }
)