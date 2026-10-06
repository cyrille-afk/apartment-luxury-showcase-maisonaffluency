// Event-specific operational copies, not a recipient-list/bulk sender.
type EmailPayload = Record<string, any>
type QueueClient = {
  from: (table: string) => any
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ error: unknown }>
}

export function requiresCommunicationCopies(queue: string, recipient: unknown): boolean {
  if (queue !== 'transactional_emails' || typeof recipient !== 'string') return false
  const inbox = recipient.trim().toLowerCase()
  return inbox === 'concierge@maisonaffluency.com' || inbox === 'trade@maisonaffluency.com'
}

async function queueStaffCopy(client: QueueClient, original: EmailPayload, recipient: string) {
  const key = `inbox-copy:${original.idempotency_key || original.message_id}:${String(original.to).trim().toLowerCase()}:${recipient}`
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
  const hex = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
  const messageId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
  const { data: suppressed, error: suppressionError } = await client.from('suppressed_emails')
    .select('id').eq('email', recipient).maybeSingle()
  if (suppressionError) throw new Error('Failed to verify staff copy suppression')
  if (suppressed) {
    await client.from('email_send_log').insert({ message_id: messageId, template_name: original.label,
      recipient_email: recipient, status: 'suppressed' })
    return
  }
  const { data: existing, error: tokenError } = await client.from('email_unsubscribe_tokens')
    .select('token, used_at').eq('email', recipient).maybeSingle()
  if (tokenError) throw new Error('Failed to look up staff copy token')
  if (existing?.used_at) return
  let token = existing?.token
  if (!token) {
    const bytes = crypto.getRandomValues(new Uint8Array(32))
    const generated = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
    const { error } = await client.from('email_unsubscribe_tokens').upsert(
      { email: recipient, token: generated }, { onConflict: 'email', ignoreDuplicates: true })
    if (error) throw new Error('Failed to create staff copy token')
    const { data: stored, error: readError } = await client.from('email_unsubscribe_tokens')
      .select('token, used_at').eq('email', recipient).maybeSingle()
    if (readError || !stored?.token) throw new Error('Failed to confirm staff copy token')
    if (stored.used_at) return
    token = stored.token
  }
  // Never inherit a recipient's provider run or unsubscribe token.
  const { run_id: _run, unsubscribe_token: _token, ...content } = original
  const { error } = await client.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: { ...content, to: recipient, message_id: messageId, idempotency_key: key,
      unsubscribe_token: token, purpose: 'transactional' },
  })
  if (error) throw new Error('Failed to enqueue staff copy')
  await client.from('email_send_log').insert({ message_id: messageId, template_name: original.label,
    recipient_email: recipient, status: 'pending' })
}

export async function ensureCommunicationCopies(client: QueueClient, queue: string, payload: EmailPayload) {
  if (!requiresCommunicationCopies(queue, payload.to)) return
  // Two named staff notifications for this event; each has independent retries.
  await Promise.all([
    queueStaffCopy(client, payload, 'cyrille@maisonaffluency.com'),
    queueStaffCopy(client, payload, 'gregoire@maisonaffluency.com'),
  ])
}