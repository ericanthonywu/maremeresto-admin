import { describe, expect, it } from 'vitest'
import { formatRupiah } from './client'

describe('formatRupiah', () => {
  it('formats positive integers to IDR currency string', () => {
    const formatted = formatRupiah(15000)
    // Node Intl.NumberFormat id-ID output for currency IDR can contain non-breaking spaces (\u00a0 or \u202f).
    // Standardizing non-breaking space to standard space for assertion flexibility
    const normalized = formatted.replace(/\s+/g, ' ')
    expect(normalized).toBe('Rp 15.000')
  })

  it('formats zero correctly', () => {
    const formatted = formatRupiah(0).replace(/\s+/g, ' ')
    expect(formatted).toBe('Rp 0')
  })

  it('formats negative numbers correctly', () => {
    const formatted = formatRupiah(-5000).replace(/\s+/g, ' ')
    // In id-ID locale, negative currency may be formatted as '-Rp 5.000' or 'Rp -5.000' or '-Rp\xa05.000'
    expect(formatted).toMatch(/-?Rp\s?-?5\.000/)
  })

  it('formats large numbers correctly', () => {
    const formatted = formatRupiah(1250000000).replace(/\s+/g, ' ')
    expect(formatted).toBe('Rp 1.250.000.000')
  })

  it('rounds decimal values to integer because maximumFractionDigits is 0', () => {
    const formattedRoundedUp = formatRupiah(15000.75).replace(/\s+/g, ' ')
    expect(formattedRoundedUp).toBe('Rp 15.001')

    const formattedRoundedDown = formatRupiah(15000.25).replace(/\s+/g, ' ')
    expect(formattedRoundedDown).toBe('Rp 15.000')
  })
})
