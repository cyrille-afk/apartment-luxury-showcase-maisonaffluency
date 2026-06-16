import { supabase } from "@/integrations/supabase/client";

const PROJECT_STORAGE_KEY = "trade:lastProjectFilter";
const ACTIVE_QUOTE_STORAGE_KEY = "trade:activeQuoteId";
const ACTIVE_QUOTE_PROJECT_STORAGE_KEY = "trade:activeQuoteProjectId";

/**
 * Returns the project id the user is currently scoped to (via the cross-page
 * project filter persisted in sessionStorage by `useProjectFilter`).
 */
export function getActiveProjectId(): string | null {
  try {
    return sessionStorage.getItem(PROJECT_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function rememberActiveQuoteId(quoteId: string, projectId: string | null = getActiveProjectId()) {
  try {
    sessionStorage.setItem(ACTIVE_QUOTE_STORAGE_KEY, quoteId);
    if (projectId) sessionStorage.setItem(ACTIVE_QUOTE_PROJECT_STORAGE_KEY, projectId);
    else sessionStorage.removeItem(ACTIVE_QUOTE_PROJECT_STORAGE_KEY);
  } catch {}
}

const clearRememberedQuote = () => {
  try {
    sessionStorage.removeItem(ACTIVE_QUOTE_STORAGE_KEY);
    sessionStorage.removeItem(ACTIVE_QUOTE_PROJECT_STORAGE_KEY);
  } catch {}
};

export async function fetchScopedDraftQuotes(userId: string): Promise<{ id: string; created_at: string }[]> {
  const projectId = getActiveProjectId();
  if (projectId) {
    const { data } = await supabase
      .from("trade_quotes")
      .select("id, created_at")
      .eq("user_id", userId)
      .eq("status", "draft")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    return (data as { id: string; created_at: string }[]) || [];
  }

  let quoteId: string | null = null;
  let quoteProjectId: string | null = null;
  try {
    quoteId = sessionStorage.getItem(ACTIVE_QUOTE_STORAGE_KEY);
    quoteProjectId = sessionStorage.getItem(ACTIVE_QUOTE_PROJECT_STORAGE_KEY);
  } catch {}
  if (!quoteId || quoteProjectId) return [];

  const { data } = await supabase
    .from("trade_quotes")
    .select("id, created_at")
    .eq("id", quoteId)
    .eq("user_id", userId)
    .eq("status", "draft")
    .is("project_id", null)
    .maybeSingle();

  if (data?.id) return [data as { id: string; created_at: string }];
  clearRememberedQuote();
  return [];
}

export async function fetchActiveDraftQuoteId(userId: string): Promise<string | null> {
  const drafts = await fetchScopedDraftQuotes(userId);
  const id = drafts[0]?.id ?? null;
  if (id) rememberActiveQuoteId(id);
  return id;
}

export async function createActiveDraftQuote(userId: string, extra: Record<string, unknown> = {}) {
  const projectId = getActiveProjectId();
  const { data, error } = await supabase
    .from("trade_quotes")
    .insert({ ...extra, user_id: userId, status: "draft", project_id: projectId })
    .select("id, created_at")
    .single();
  if (data?.id) rememberActiveQuoteId(data.id, projectId);
  return { data: data as { id: string; created_at: string } | null, error };
}
