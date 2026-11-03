import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useSearchParams } from '@/lib/router-compat';
import { recordEmailPortalClick } from '@/lib/emailPortalClick';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Turnstile from '@/components/Turnstile';
import { requestTradePasswordSetup } from '@/lib/tradeSetupRequest.functions';
import { PASSWORD_LINK_VALIDITY_HOURS } from '@/lib/tradeSetupRequest';

const TradeActivate = () => {
  const [params] = useSearchParams();
  useEffect(() => { recordEmailPortalClick(); }, []);
  const navigate = useNavigate();
  const [stage, setStage] = useState<'welcome' | 'password' | 'complete' | 'expired'>('welcome');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [email, setEmail] = useState('');
  const [requestEmail, setRequestEmail] = useState('');
  const [proof, setProof] = useState('');
  const [verificationKey, setVerificationKey] = useState(0);
  const [requested, setRequested] = useState(false);
  const [legacy] = useState(() => Boolean(params.get('token')));
  const valid = /^[a-f0-9]{32,128}$/i.test(params.get('token_hash') || params.get('token') || '');
  const expired = stage === 'expired' || (stage === 'welcome' && !valid);

  const requestFreshLink = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !proof) return;
    setBusy(true); setError('');
    try {
      await requestTradePasswordSetup({ data: { email: requestEmail.trim(), proof } });
      setRequested(true);
    } catch {
      setError('Your request could not be completed. Please repeat the security check and try again, or contact trade@maisonaffluency.com.');
    } finally {
      setProof(''); setVerificationKey(key => key + 1); setBusy(false);
    }
  };

  const begin = async () => {
    setBusy(true); setError('');
    try {
      let hash = params.get('token_hash');
      if (legacy) {
        const result = await supabase.functions.invoke('activate-trade-invite', { body: { token: params.get('token') } });
        if (result.error || !result.data?.token_hash) { setStage('expired'); return; }
        hash = result.data.token_hash;
      }
      if (!hash || (!legacy && params.get('type') !== 'recovery')) { setStage('expired'); return; }
      const result = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: hash });
      if (result.error || !result.data.user) { setStage('expired'); return; }
      setEmail(result.data.user.email || '');
      // Remove the credential from history after exchange; refreshing requires a new email proof.
      window.history.replaceState(null, '', window.location.pathname);
      setStage('password');
    } catch { setError('Activation could not be checked. Please try again.'); }
    finally { setBusy(false); }
  };
  const finishAccess = async () => {
    if (!legacy) {
      const result = await supabase.functions.invoke('activate-trade-invite', { body: { action: 'complete' } });
      if (result.error || !result.data?.ok) throw new Error('Your password was saved, but trade access could not be activated. Please retry.');
    }
    await supabase.auth.refreshSession();
    navigate('/trade/dashboard', { replace: true });
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    if (password.length < 12) { setError('Choose a password with at least 12 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      const verified = await supabase.auth.getUser();
      if (verified.error || !verified.data.user) { setStage('expired'); setRequestEmail(email); return; }
      const result = await supabase.auth.updateUser({ password });
      if (result.error) throw result.error;
      setPassword(''); setConfirm(''); setStage('complete');
      await finishAccess();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save your password.'); }
    finally { setBusy(false); }
  };
  return <>
    <Helmet><title>Activate Trade Access — Maison Affluency</title><meta name="robots" content="noindex, nofollow" /><meta name="referrer" content="no-referrer" /></Helmet>
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-6 py-16">
      <section className="w-full max-w-md">
        <Link to="/" className="font-display text-2xl block text-center mb-10">Maison Affluency</Link>
        <h1 className="font-display text-2xl mb-4">{expired ? 'This setup link is no longer available' : stage === 'welcome' ? 'Activate your trade access' : stage === 'password' ? 'Set your password' : 'Password saved'}</h1>
        {expired ? <>
          <p className="text-sm text-muted-foreground mb-5">The link may have expired, already been used, or been replaced by a newer email.</p>
          <p className="border-l-2 border-accent pl-4 text-sm mb-5"><strong>Password links are valid for {PASSWORD_LINK_VALIDITY_HOURS} hours.</strong><br />This validity period applies to all email password links. A fresh setup email replaces older setup links.</p>
          <p className="text-sm text-muted-foreground mb-7">Your studio’s approval is unchanged. Request a fresh link using the email address on your approved application. You do not need to apply again.</p>
          {requested ? <div role="status" className="border-t border-border pt-5 space-y-3">
            <h2 className="font-display text-xl">Check your inbox</h2>
            <p className="text-sm text-muted-foreground">If this email belongs to an approved studio awaiting activation, a fresh password-setup email will arrive shortly. Check spam and use only the newest link within {PASSWORD_LINK_VALIDITY_HOURS} hours.</p>
            <p className="text-sm text-muted-foreground">Already activated? Sign in below, or use Forgot password on the sign-in page.</p>
          </div> : <form onSubmit={requestFreshLink} className="space-y-5">
            <div><label htmlFor="setup-email" className="text-sm">Approved application email</label><Input id="setup-email" type="email" autoComplete="email" required maxLength={255} disabled={busy} value={requestEmail} onChange={event => setRequestEmail(event.target.value)} className="mt-2" /></div>
            <Turnstile key={verificationKey} onVerify={setProof} onExpire={() => setProof('')} />
            <Button type="submit" className="w-full" disabled={busy || !proof || !requestEmail.trim()}>{busy ? 'Requesting…' : 'Request fresh password-setup link'}</Button>
          </form>}
          <p className="text-xs text-muted-foreground mt-5">Need help with a different email address? <a className="underline" href="mailto:trade@maisonaffluency.com">Contact our Trade team</a>.</p>
        </> : stage === 'welcome' ? <>
          <p className="text-sm text-muted-foreground mb-8">{valid ? 'Your studio has been approved. Continue to securely choose your sign-in password.' : 'This activation link is missing or invalid. Please request a new approval email from trade@maisonaffluency.com.'}</p>
          {valid && <Button className="w-full" disabled={busy} onClick={begin}>{busy ? 'Verifying…' : 'Continue activation'}</Button>}
        </> : stage === 'password' ? <>
          <p className="text-sm text-muted-foreground mb-6">{email}</p>
          <form onSubmit={save} className="space-y-5">
            <div><label htmlFor="new-password" className="text-sm">New password</label><Input id="new-password" type="password" autoComplete="new-password" required minLength={12} value={password} onChange={e => setPassword(e.target.value)} className="mt-2" /></div>
            <div><label htmlFor="confirm-password" className="text-sm">Confirm password</label><Input id="confirm-password" type="password" autoComplete="new-password" required minLength={12} value={confirm} onChange={e => setConfirm(e.target.value)} className="mt-2" /></div>
            <p className="text-xs text-muted-foreground">Use at least 12 characters.</p>
            <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Activating…' : 'Set password & activate'}</Button>
          </form>
        </> : <Button className="w-full" disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await finishAccess(); } catch (e) { setError(e instanceof Error ? e.message : 'Please retry.'); } finally { setBusy(false); } }}>Retry trade activation</Button>}
        {error && <p role="alert" className="text-sm text-destructive mt-5">{error}</p>}
        <Button asChild variant="link" className="mt-6 px-0"><Link to="/trade/login">Back to sign in</Link></Button>
      </section>
    </main>
  </>;
};
export default TradeActivate;
