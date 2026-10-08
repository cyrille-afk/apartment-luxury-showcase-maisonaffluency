import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

/** Runtime applicant activation only; never used to mint agent test sessions. */
export async function prepareTradeActivation(service: SupabaseClient, recipient: string) {
  const email = recipient.trim().toLowerCase()
  const { data: account, error } = await service.from('trade_accounts').select('id,email,status').eq('email', email).maybeSingle()
  if (error || account?.status !== 'approved') throw new Error('A saved approved application is required')
  const invited = await service.auth.admin.generateLink({ type: 'invite', email })
  if (invited.error && !['email_exists', 'user_already_exists'].includes(invited.error.code ?? '') &&
      !/already.*(registered|exists)/i.test(invited.error.message)) throw new Error('Could not prepare sign-in access')
  const linked = await service.auth.admin.generateLink({ type: 'recovery', email })
  const token = linked.data?.properties?.hashed_token
  if (linked.error || !token || !linked.data.user?.id) throw new Error('Could not prepare password setup')
  return `https://www.maisonaffluency.com/trade/activate?token_hash=${encodeURIComponent(token)}&type=recovery`
}

export async function completeTradeActivation(service: SupabaseClient, userId: string) {
  const { data: auth, error: authError } = await service.auth.admin.getUserById(userId)
  const email = auth?.user?.email?.toLowerCase()
  if (authError || !email || !auth.user?.email_confirmed_at) throw new Error('Verify your activation email first')
  const { data: account, error } = await service.from('trade_accounts').select('id,status,user_id').eq('email', email).maybeSingle()
  if (error || account?.status !== 'approved' || (account.user_id && account.user_id !== userId)) throw new Error('An approved application is required')
  const checked = (result: { error: unknown }) => { if (result.error) throw new Error('Could not activate your trade access. Please retry.') }
  checked(await service.from('profiles').update({ trade_status: 'approved' }).eq('id', userId))
  checked(await service.from('trade_profiles').upsert({ user_id: userId, approval_status: 'approved' }, { onConflict: 'user_id' }))
  checked(await service.from('trade_accounts').update({ user_id: userId }).eq('id', account.id).eq('status', 'approved'))
  checked(await service.from('user_roles').upsert({ user_id: userId, role: 'trade_user' }, { onConflict: 'user_id,role', ignoreDuplicates: true }))
  return { ok: true }
}