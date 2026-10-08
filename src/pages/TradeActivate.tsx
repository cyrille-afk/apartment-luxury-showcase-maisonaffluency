import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const TradeActivate = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [stage, setStage] = useState<'welcome' | 'password' | 'complete'>('welcome');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [email, setEmail] = useState('');
  const legacy = Boolean(params.get('token'));
  const valid = /^[a-f0-9]{64}$/i.test(params.get('token_hash') || params.get('token') || '');

  const begin = async () => {
    setBusy(true); setError('');
    try {
      let hash = params.get('token_hash');
      if (legacy) {
        const result = await supabase.functions.invoke('activate-trade-invite', { body: { token: params.get('token') } });
        if (result.error || !result.data?.token_hash) throw new Error('This activation link is invalid or expired.');
        hash = result.data.token_hash;
      }
      if (!hash || (!legacy && params.get('type') !== 'recovery')) throw new Error('This activation link is invalid or expired.');
      const result = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: hash });
      if (result.error || !result.data.user) throw new Error('This activation link is invalid, expired, or already used. Please request a new approval email.');
      setEmail(result.data.user.email || '');
      // Remove the credential from history after exchange; refreshing requires a new email proof.
      window.history.replaceState(null, '', window.location.pathname);
      setStage('password');
    } catch (e) { setError(e instanceof Error ? e.message : 'Activation could not be completed. Please try again.'); }
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
      if (verified.error || !verified.data.user) throw new Error('Your activation session expired. Please request a new approval email.');
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
        <h1 className="font-display text-2xl mb-4">{stage === 'welcome' ? 'Activate your trade access' : stage === 'password' ? 'Set your password' : 'Password saved'}</h1>
        {stage === 'welcome' ? <>
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
