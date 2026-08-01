ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS trade_status TEXT DEFAULT 'pending_review';

-- Enforce only the three allowed lifecycle states
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_trade_status_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_trade_status_check
CHECK (trade_status IN ('approved', 'pending_review', 'rejected'));

-- Ensure authenticated users can read and admins/service_role can manage the gate
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (trade_status) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;