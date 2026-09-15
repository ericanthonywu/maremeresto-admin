/**
 * Validates whether a URL is a safe relative path.
 * Prevents Open Redirect and XSS vulnerabilities via protocol-relative URLs (e.g. //attacker.com)
 * or javascript:/data: URIs.
 */
export function isSafeRelativeUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false
  const trimmed = url.trim()

  // Must start with '/' but not '//' or '/\' (protocol-relative redirect bypass)
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return false
  }

  // Prevent scheme protocols like javascript:, data:, vbscript: within the string
  // or URL encoding tricks
  const lowercase = trimmed.toLowerCase()
  if (lowercase.includes('javascript:') || lowercase.includes('data:') || lowercase.includes('vbscript:')) {
    return false
  }

  return true
}

/**
 * Safely navigates using window.location.assign if the URL is a relative path.
 * Falls back to a safe default path if the provided URL is untrusted or invalid.
 */
export function safeAssign(targetUrl: string, fallbackUrl = '/login'): void {
  const destination = isSafeRelativeUrl(targetUrl) ? targetUrl : fallbackUrl
  if (isSafeRelativeUrl(destination)) {
    window.location.assign(destination)
  } else {
    window.location.assign('/login')
  }
}
