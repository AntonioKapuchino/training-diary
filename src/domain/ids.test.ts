import { afterEach, describe, expect, it, vi } from 'vitest'
import { newId } from './ids'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('newId', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('UUID v4', () => {
    expect(newId()).toMatch(UUID)
  })

  it('без randomUUID (http по IP-адресу) — тоже UUID v4, и все разные', () => {
    const real = globalThis.crypto
    vi.stubGlobal('crypto', {
      getRandomValues: (a: Uint8Array<ArrayBuffer>) => real.getRandomValues(a),
    })
    const ids = Array.from({ length: 200 }, newId)
    for (const id of ids) expect(id).toMatch(UUID)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
