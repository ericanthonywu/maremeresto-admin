import { describe, expect, it } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import { errorMessage, sanitizeError } from './client'

describe('sanitizeError', () => {
  it('returns clean error string as is', () => {
    expect(sanitizeError('Invalid credentials')).toBe('Invalid credentials')
  })

  it('encodes HTML tags to prevent XSS execution', () => {
    expect(sanitizeError('<b>Error:</b> Item not found')).toBe('&lt;b&gt;Error:&lt;/b&gt; Item not found')
  })

  it('encodes script tags and escapes quotes/special characters', () => {
    const dangerous = "<script>alert('xss')</script>Error"
    const result = sanitizeError(dangerous)
    expect(result).not.toContain('<script>')
    expect(result).not.toContain('</script>')
    expect(result).toBe('&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;Error')
  })

  it('encodes dangerous HTML characters like < and >', () => {
    expect(sanitizeError('Price < 100 & > 0')).toBe('Price &lt; 100 &amp; &gt; 0')
  })
})

describe('errorMessage', () => {
  it('returns sanitized error message from Axios error response', () => {
    const error = new AxiosError(
      'Request failed',
      'ERR_BAD_REQUEST',
      undefined,
      {},
      {
        data: { error: '<script>alert(1)</script>Bad input' },
        status: 400,
        statusText: 'Bad Request',
        headers: new AxiosHeaders(),
        config: { headers: new AxiosHeaders() },
      }
    )

    expect(errorMessage(error)).toBe('&lt;script&gt;alert(1)&lt;/script&gt;Bad input')
  })

  it('falls back to default fallback message if api error is empty', () => {
    const error = new AxiosError(
      'Request failed',
      'ERR_BAD_REQUEST',
      undefined,
      {},
      {
        data: { error: '   ' },
        status: 400,
        statusText: 'Bad Request',
        headers: new AxiosHeaders(),
        config: { headers: new AxiosHeaders() },
      }
    )

    expect(errorMessage(error, 'Custom fallback')).toBe('Custom fallback')
  })

  it('handles ECONNABORTED code', () => {
    const error = new AxiosError('Timeout', 'ECONNABORTED')
    expect(errorMessage(error)).toBe('Koneksi timeout. Periksa jaringan dan coba lagi.')
  })

  it('handles network error without response', () => {
    const error = new AxiosError('Network Error')
    expect(errorMessage(error)).toBe('Tidak dapat menghubungi server.')
  })

  it('returns fallback for non-axios error', () => {
    expect(errorMessage(new Error('Unknown error'))).toBe('Terjadi kesalahan. Silakan coba lagi.')
  })
})
