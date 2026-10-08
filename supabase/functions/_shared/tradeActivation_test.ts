import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { prepareTradeActivation, completeTradeActivation } from './tradeActivation.ts'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

function fixture(status = 'approved', existing = false) {
  const calls: string[] = []
  const chain = {
    select() { return this }, eq() { return this },
    maybeSingle() { return Promise.resolve({ data: { id: 'account', status, user_id: null }, error: null }) },
    update() { calls.push('update'); return this },
    upsert() { calls.push('upsert'); return Promise.resolve({ error: null }) },
    then(resolve: (value: unknown) => void) { resolve({ error: null }) },
  }
  const service = {
    from: () => chain,
    auth: { admin: {
      generateLink: ({ type }: { type: string }) => {
        calls.push(type)
        if (type === 'invite' && existing) return Promise.resolve({ error: { code: 'email_exists', message: 'Already registered' } })
        return Promise.resolve({ data: { properties: { hashed_token: 'test-proof' }, user: { id: 'user' } }, error: null })
      },
      getUserById: () => Promise.resolve({ data: { user: { email: 'test@example.com', email_confirmed_at: '2026-10-08' } }, error: null }),
    } },
  } as unknown as SupabaseClient
  return { service, calls }
}
Deno.test('unapproved applicant cannot create sign-in access', async () => {
  const { service, calls } = fixture('pending_review')
  await assertRejects(() => prepareTradeActivation(service, 'test@example.com'))
  assertEquals(calls, [])
})
Deno.test('new applicant gets production-domain recovery setup, never a password overwrite', async () => {
  const { service, calls } = fixture()
  assertEquals(await prepareTradeActivation(service, 'test@example.com'), 'https://www.maisonaffluency.com/trade/activate?token_hash=test-proof&type=recovery')
  assertEquals(calls, ['invite', 'recovery'])
})
Deno.test('existing applicant reuses their account for email-proven password setup', async () => {
  const { service, calls } = fixture('approved', true)
  await prepareTradeActivation(service, 'test@example.com')
  assertEquals(calls, ['invite', 'recovery'])
})
Deno.test('approval is rechecked before linking roles', async () => {
  const { service, calls } = fixture('rejected')
  await assertRejects(() => completeTradeActivation(service, 'user'))
  assertEquals(calls, [])
})
Deno.test('verified approved account links current user and existing profiles', async () => {
  const { service, calls } = fixture()
  assertEquals(await completeTradeActivation(service, 'user'), { ok: true })
  assertEquals(calls, ['update', 'upsert', 'update', 'upsert'])
})