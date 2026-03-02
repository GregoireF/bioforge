export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}

export function error(code: string, status = 400, details?: unknown) {
  return json(
    {
      success: false,
      error: code,
      ...(details ? { details } : {}),
    },
    status
  )
}

export function success(data: unknown, status = 200) {
  return json({ success: true, data }, status)
}