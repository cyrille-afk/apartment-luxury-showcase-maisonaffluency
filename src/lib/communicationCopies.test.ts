import { describe, it, expect, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import { ensureCommunicationCopies, requiresCommunicationCopies } from '../../supabase/functions/_shared/communicationCopies'

vi.stubGlobal('crypto', webcrypto)

function mockClient(options: { suppressed?: string; used?: string; fail?: string } = {}) {
  const rpc = vi.fn(async (_name, args) => ({ error: args.payload.to === options.fail ? new Error('offline') : null }))
  const from = vi.fn((table: string) => {
    let email = ''
    const query = {
      select: () => query,
      eq: (_field: string, value: string) => { email = value; return query },
      maybeSingle: async () => ({ error: null, data: table === 'suppressed_emails'
        ? (email === options.suppressed ? { id: 'blocked' } : null)
        : { token: `token-${email}`, used_at: email === options.used ? '2026-10-06' : null } }),
      insert: vi.fn(async () => ({ error: null })),
    }
    return query
  })
  return { from, rpc }
}
const payload = { to: 'concierge@maisonaffluency.com', subject: 'Inquiry', html: '<p>Hello</p>',
  text: 'Hello', message_id: 'original', idempotency_key: 'inquiry-123', label: 'inquiry-notification',
  from: 'Maison', sender_domain: 'verified', purpose: 'transactional', run_id: 'private-run',
  unsubscribe_token: 'original-token', queued_at: '2026-10-06T03:00:00Z' }

describe('operational inbox copies', () => {
  it('matches only the two exact inboxes, case-insensitively, never auth mail', () => {
    expect(requiresCommunicationCopies('transactional_emails', ' TRADE@maisonaffluency.com ')).toBe(true)
    expect(requiresCommunicationCopies('transactional_emails', payload.to)).toBe(true)
    for (const recipient of ['cyrille@maisonaffluency.com', 'gregoire@maisonaffluency.com', 'client@example.com', 'trade@evil.com']) {
      expect(requiresCommunicationCopies('transactional_emails', recipient)).toBe(false)
    }
    expect(requiresCommunicationCopies('auth_emails', payload.to)).toBe(false)
  })
  it.each(['concierge', 'trade'])('queues exact independent content for both staff from %s', async inbox => {
    const client = mockClient()
    await ensureCommunicationCopies(client, 'transactional_emails', { ...payload, to: `${inbox}@maisonaffluency.com` })
    expect(client.rpc).toHaveBeenCalledTimes(2)
    const copies = client.rpc.mock.calls.map(call => call[1].payload)
    expect(copies.map(copy => copy.to).sort()).toEqual(['cyrille@maisonaffluency.com', 'gregoire@maisonaffluency.com'])
    for (const copy of copies) {
      expect(copy).toMatchObject({ subject: payload.subject, html: payload.html, text: payload.text, purpose: 'transactional' })
      expect(copy.unsubscribe_token).toBe(`token-${copy.to}`)
      expect(copy).not.toHaveProperty('run_id')
      expect(copy.message_id).not.toBe(payload.message_id)
    }
    expect(copies[0].idempotency_key).not.toBe(copies[1].idempotency_key)
  })
  it('keeps copy identities stable across retries', async () => {
    const client = mockClient()
    await ensureCommunicationCopies(client, 'transactional_emails', payload)
    await ensureCommunicationCopies(client, 'transactional_emails', { ...payload, message_id: 'retry-id' })
    expect(client.rpc.mock.calls[0][1].payload).toEqual(client.rpc.mock.calls[2][1].payload)
  })
  it('honours suppression and used tokens independently', async () => {
    const client = mockClient({ suppressed: 'cyrille@maisonaffluency.com', used: 'gregoire@maisonaffluency.com' })
    await ensureCommunicationCopies(client, 'transactional_emails', payload)
    expect(client.rpc).not.toHaveBeenCalled()
  })
  it('surfaces a partial copy failure for worker retry', async () => {
    const client = mockClient({ fail: 'gregoire@maisonaffluency.com' })
    await expect(ensureCommunicationCopies(client, 'transactional_emails', payload)).rejects.toThrow('Failed to enqueue staff copy')
    expect(client.rpc).toHaveBeenCalledTimes(2)
  })
  it('does not recursively copy staff messages or auth emails', async () => {
    const client = mockClient()
    await ensureCommunicationCopies(client, 'transactional_emails', { ...payload, to: 'gregoire@maisonaffluency.com' })
    await ensureCommunicationCopies(client, 'auth_emails', payload)
    expect(client.from).not.toHaveBeenCalled()
    expect(client.rpc).not.toHaveBeenCalled()
  })
})