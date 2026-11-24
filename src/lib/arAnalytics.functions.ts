import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export const getArAnalytics = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
    if (error || data !== true) throw new Error('Admin access could not be confirmed.');
    const { arSnapshot } = await import('./arAnalyticsSnapshot.server');
    return arSnapshot;
  });