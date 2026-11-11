import { supabase } from '@/integrations/supabase/client';
import { hasConsent } from '@/lib/consent/consentStore';

export type TourRun = { started_at: string; updated_at: string; completed: boolean; replay: boolean; mode: string; exit_reason: string | null; last_step: string | null; last_step_number: number | null; viewed_steps: string[]; total_steps: number };
export type TourActivity = { updated_at: string; started_at: string | null; runs: TourRun[] };
const permitted = () => hasConsent('analytics') && !(navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl;
export function beginTourActivity(tour: 'felix' | 'quick', mode: 'manual' | 'automatic' | 'resumed', total: number, replay = false) {
  if (!permitted()) return null;
  const id = crypto.randomUUID();
  const host = window.location.hostname;
  const environment = host === 'localhost' || host.startsWith('id-preview--') || host.endsWith('-dev.lovable.app') ? 'preview' : 'production';
  let pending: Promise<unknown> = Promise.resolve();
  const send = (kind: string, step?: string, number?: number, reason?: string) => {
    pending = pending.then(async () => {
      if (!permitted()) return;
      const { error } = await supabase.rpc('record_onboarding_tour_run', { _id: id, _kind: kind, _tour: tour, _environment: environment, _mode: mode, _replay: replay, _total: total, _step: step, _number: number, _reason: reason });
      if (error) throw error;
    }).catch(() => undefined); // Analytics must never block the walkthrough.
  };
  send('start');
  return { view: (step: string, number: number) => send('view', step, number), finish: (step: string, number: number) => send('complete', step, number), exit: (step: string, number: number, reason: string) => send('exit', step, number, reason) };
}
export function summarizeTourActivity(runs: TourRun[], steps: string[], now = Date.now()) {
  const stopped = (r: TourRun) => !r.completed && (r.exit_reason !== null || now - Date.parse(r.updated_at) >= 30 * 60_000);
  const starts = runs.length, completed = runs.filter(r => r.completed).length, replays = runs.filter(r => r.replay).length;
  return { starts, completed, replays, completionRate: starts ? completed / starts * 100 : null, replayRate: starts ? replays / starts * 100 : null,
    pending: runs.filter(r => !r.completed && !stopped(r)).length,
    steps: steps.map(id => ({ id, label: id.split('-').map(word => word[0]?.toUpperCase() + word.slice(1)).join(' '), reached: runs.filter(r => r.viewed_steps.includes(id)).length, dropped: runs.filter(r => stopped(r) && r.last_step === id).length })),
    days: [...new Set(runs.map(r => new Date(r.started_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })))].sort().map(day => ({ day, starts: runs.filter(r => new Date(r.started_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' }) === day).length, completed: runs.filter(r => r.completed && new Date(r.started_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' }) === day).length })) };
}