export function verifyContentType(request: Request) {
  return request.headers
    .get('content-type')
    ?.includes('application/json')
}

export function verifyFetchSite(request: Request) {
  const site = request.headers.get('sec-fetch-site')

  if (!site) return false

  return site === 'same-origin' || site === 'same-site'
}