export function verifyContentType(request: Request) {
  if (!['POST', 'PUT', 'PATCH'].includes(request.method)) {
    return true
  }

  return request.headers
    .get('content-type')
    ?.includes('application/json') ?? false
}