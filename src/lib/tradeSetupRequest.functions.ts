import { createServerFn } from '@tanstack/react-start';
import { getRequestHeader, getRequestUrl, setResponseHeader } from '@tanstack/react-start/server';
import { z } from 'zod';
import { eligibleForSetupRequest, PASSWORD_LINK_VALIDITY_HOURS } from './tradeSetupRequest';

export const requestTradePasswordSetup = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => z.object({
    email: z.string().trim().email().max(255).transform(value => value.toLowerCase()),
    proof: z.string().min(10).max(4096),
  }).parse(input))
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'private, no-store');
    const secret = process.env['TURNSTILE_SECRET_KEY'];
    if (!secret) throw new Error('Link requests are temporarily unavailable. Please contact trade@maisonaffluency.com.');
    const body = new URLSearchParams({ secret, response: data.proof });
    const ip = getRequestHeader('cf-connecting-ip');
    if (ip) body.set('remoteip', ip);
    const verification = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    const checked = await verification.json() as { success?: boolean; hostname?: string };
    if (!verification.ok || checked.success !== true || checked.hostname !== getRequestUrl().hostname) {
      throw new Error('Please complete the security check again.');
    }
    // Bot verification precedes privileged reads; eligibility stays private.
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: account, error } = await supabaseAdmin.from('trade_accounts')
      .select('id,email,status,user_id,contact_name,studio_name').eq('email', data.email).maybeSingle();
    if (error) throw new Error('Your request could not be completed. Please try again shortly.');
    if (account && eligibleForSetupRequest(account)) {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data.proof));
      const attempt = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      // Existing sender checks approval, replaces native recovery tokens and
      // deduplicates delivery before issuing. Never change approval or roles here.
      const result = await supabaseAdmin.functions.invoke('send-transactional-email', { body: {
        templateName: 'trade-approval', recipientEmail: account.email,
        idempotencyKey: `trade-setup-request-${account.id}-${attempt}`,
        templateData: {
          name: account.contact_name || undefined, companyName: account.studio_name || undefined,
          subjectText: 'Your fresh password-setup link — Maison Affluency',
          bodyText: `Your studio remains approved. Use the button below to set your password and activate your Trade access.\n\nVALID FOR ${PASSWORD_LINK_VALIDITY_HOURS} HOURS from this email. This validity period applies to all email password links. This new link replaces any older password-setup links; use only the latest email.\n\nIf you did not request this email, you can ignore it.`,
        },
      } });
      if (result.error || result.data?.success !== true) throw new Error('Your request could not be completed. Please try again shortly.');
    }
    // Unknown, unapproved and already activated addresses get identical feedback.
    return { ok: true };
  });