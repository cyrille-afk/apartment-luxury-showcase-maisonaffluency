/**
 * Client-side function middleware: attaches the current Supabase access token
 * as a Bearer header to every server-function call, so functions guarded by
 * requireSupabaseAuth receive the caller's session. Registered in src/start.ts.
 */
import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);
