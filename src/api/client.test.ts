import { describe, it, expect } from 'vitest'
import axios, { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { errorMessage } from './client'

describe('errorMessage utility', () => {
  const defaultFallback = 'Terjadi kesalahan. Silakan coba lagi.'
  const customFallback = 'Custom fallback message'

  it('returns apiError string when err is an AxiosError with response.data.error string', () => {
    const error = new AxiosError(
      'Request failed with status code 400',
      'ERR_BAD_REQUEST',
      undefined,
      {},
      {
        data: { error: 'Email sudah terdaftar.' },
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: { headers: new AxiosHeaders() },
      }
    )

    expect(errorMessage(error)).toBe('Email sudah terdaftar.')
    expect(errorMessage(error, customFallback)).toBe('Email sudah terdaftar.')
  })

  it('skips response.data.error if it is empty or whitespace string', () => {
    const createError = (apiError: string) =>
      new AxiosError(
        'Request failed',
        'ERR_BAD_REQUEST',
        undefined,
        {},
        {
          data: { error: apiError },
          status: 400,
          statusText: 'Bad Request',
          headers: {},
          config: { headers: new AxiosHeaders() },
        }
      )

    expect(errorMessage(createError(''))).toBe(defaultFallback)
    expect(errorMessage(createError('   '), customFallback)).toBe(customFallback)
  })

  it('skips response.data.error if it is not a string', () => {
    const error = new AxiosError(
      'Request failed',
      'ERR_BAD_REQUEST',
      undefined,
      {},
      {
        data: { error: { message: 'Object error' } },
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: { headers: new AxiosHeaders() },
      }
    )

    expect(errorMessage(error)).toBe(defaultFallback)
  })

  it('returns timeout message when err.code is ECONNABORTED and no apiError is present', () => {
    const errorWithResponse = new AxiosError(
      'timeout of 20000ms exceeded',
      'ECONNABORTED',
      undefined,
      {},
      {
        data: {},
        status: 504,
        statusText: 'Gateway Timeout',
        headers: {},
        config: { headers: new AxiosHeaders() },
      }
    )

    const errorWithoutResponse = new AxiosError('timeout of 20000ms exceeded', 'ECONNABORTED')

    expect(errorMessage(errorWithResponse)).toBe('Koneksi timeout. Periksa jaringan dan coba lagi.')
    expect(errorMessage(errorWithoutResponse)).toBe('Koneksi timeout. Periksa jaringan dan coba lagi.')
  })

  it('prioritizes apiError over ECONNABORTED code if apiError exists', () => {
    const error = new AxiosError(
      'timeout of 20000ms exceeded',
      'ECONNABORTED',
      undefined,
      {},
      {
        data: { error: 'Server timeout error message' },
        status: 504,
        statusText: 'Gateway Timeout',
        headers: {},
        config: { headers: new AxiosHeaders() },
      }
    )

    expect(errorMessage(error)).toBe('Server timeout error message')
  })

  it('returns network connection error when err has no response', () => {
    const error = new AxiosError('Network Error', 'ERR_NETWORK')

    expect(errorMessage(error)).toBe('Tidak dapat menghubungi server.')
  })

  it('returns fallback when err is AxiosError but has response without apiError and code is not ECONNABORTED', () => {
    const error = new AxiosError(
      'Internal Server Error',
      'ERR_BAD_RESPONSE',
      undefined,
      {},
      {
        data: { message: 'Internal Server Error' },
        status: 500,
        statusText: 'Internal Server Error',
        headers: {},
        config: { headers: new AxiosHeaders() },
      }
    )

    expect(errorMessage(error)).toBe(defaultFallback)
    expect(errorMessage(error, customFallback)).toBe(customFallback)
  })

  it('returns fallback when err is not an AxiosError', () => {
    expect(errorMessage(new Error('Generic Error'))).toBe(defaultFallback)
    expect(errorMessage('Just a string')).toBe(defaultFallback)
    expect(errorMessage({ message: 'Plain object' }, customFallback)).toBe(customFallback)
    expect(errorMessage(null)).toBe(defaultFallback)
    expect(errorMessage(undefined, customFallback)).toBe(customFallback)
    expect(errorMessage(123)).toBe(defaultFallback)
  })
})
