import type { APIRoute }    from 'astro'
import type { RawHandlerContext } from '@/lib/api/raw-handler'
import { rawApiHandler }    from '@/lib/api/raw-handler'
import { updateProfile }    from '@/lib/db'
import { AppError, ErrorCode } from '@/lib/core/errors'
import { json }             from '@/lib/core/http'

const MAX_SIZE = 2 * 1024 * 1024  // 2 MB
const BUCKET   = 'avatars'

export const POST: APIRoute = rawApiHandler(
  async (ctx: RawHandlerContext) => {
    const { context, user, supabase, profile } = ctx as Required<RawHandlerContext>
    const { request } = context

    const contentType = request.headers.get('content-type') ?? ''
    if (!contentType.includes('multipart/form-data'))
      return json({ success: false, error: 'Expected multipart/form-data' }, 400)

    const formData = await request.formData()
    const file     = formData.get('avatar')

    if (!file || !(file instanceof File))
      return json({ success: false, error: 'No file provided' }, 400)

    if (file.size > MAX_SIZE)
      return json({ success: false, error: 'File too large. Max 2 MB.' }, 400)

    const buffer = await file.arrayBuffer()
    const bytes  = new Uint8Array(buffer)

    const isPng  = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47
    const isJpeg = bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF
    const isWebp = bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50

    if (!isPng && !isJpeg && !isWebp)
      return json({ success: false, error: 'Type non supporté. Utilise JPG, PNG ou WebP.' }, 400)

    const ext      = isPng ? 'png' : isWebp ? 'webp' : 'jpg'
    const mimeType = isPng ? 'image/png' : isWebp ? 'image/webp' : 'image/jpeg'
    const filename = `${profile.id}/avatar-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filename, buffer, { contentType: mimeType, upsert: true })

    if (uploadError)
      throw new AppError({ message: uploadError.message, code: ErrorCode.INTERNAL_ERROR, statusCode: 500 })

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(filename)

    const result = await updateProfile(supabase, user.id, { avatar_url: publicUrl })
    if (!result.success)
      throw new AppError({ message: 'Failed to save avatar URL', code: ErrorCode.DB_ERROR, statusCode: 500 })

    return json({ success: true, data: { avatar_url: publicUrl } })
  },
  { requireAuth: true }
)