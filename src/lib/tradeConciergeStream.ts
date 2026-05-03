import { supabase } from "@/integrations/supabase/client";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type CreateTearsheetProposal = {
  tool: "propose_tearsheet";
  tool_call_id: string;
  args: {
    title: string;
    pick_ids: string[];
    note: string | null;
    pick_rationales?: Record<string, string>;
  };
  preview: PickPreview[];
};

export type AddToTearsheetProposal = {
  tool: "add_to_tearsheet";
  tool_call_id: string;
  args: {
    board_id: string | null;
    board_title: string;
    pick_ids: string[];
    note: string | null;
    pick_rationales?: Record<string, string>;
  };
  preview: PickPreview[];
};

export type TearsheetProposal = CreateTearsheetProposal | AddToTearsheetProposal;

export type PickPreview = {
  id: string;
  title: string;
  image_url: string | null;
  image_from_hotspot?: boolean;
  materials: string | null;
  category: string | null;
  designer_name: string | null;
  rationale?: string;
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trade-concierge`;

export async function streamConcierge({
  messages,
  onDelta,
  onProposal,
  onDone,
  onError,
  signal,
}: {
  messages: ChatMessage[];
  onDelta: (text: string) => void;
  onProposal?: (proposal: TearsheetProposal) => void;
  onDone: () => void;
  onError: (msg: string) => void;
  signal?: AbortSignal;
}) {
  // Forward the user's session token so the edge function can list their existing tearsheets.
  const { data: sess } = await supabase.auth.getSession();
  const bearer = sess.session?.access_token || (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string);

  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bearer}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
    },
    body: JSON.stringify({ messages }),
    signal,
  });

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({ error: "Request failed" }));
    onError(body.error || `Error ${resp.status}`);
    return;
  }

  if (!resp.body) {
    onError("No response stream");
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let streamDone = false;
  let currentEvent: string | null = null;

  const handleDataPayload = (jsonStr: string) => {
    if (jsonStr === "[DONE]") {
      streamDone = true;
      return;
    }
    try {
      const parsed = JSON.parse(jsonStr);
      if (currentEvent === "proposal") {
        if (onProposal) onProposal(parsed as TearsheetProposal);
        return;
      }
      const content = parsed.choices?.[0]?.delta?.content as string | undefined;
      if (content) onDelta(content);
    } catch {
      /* ignore partial / unparseable */
    }
  };

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);

      if (line === "") {
        // SSE event terminator — reset event name
        currentEvent = null;
        continue;
      }
      if (line.startsWith(":")) continue;

      if (line.startsWith("event: ")) {
        currentEvent = line.slice(7).trim();
        continue;
      }
      if (!line.startsWith("data: ")) continue;

      handleDataPayload(line.slice(6).trim());
      if (streamDone) break;
    }
  }

  // flush remaining
  if (buffer.trim()) {
    for (let raw of buffer.split("\n")) {
      if (!raw) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (raw.startsWith("event: ")) { currentEvent = raw.slice(7).trim(); continue; }
      if (!raw.startsWith("data: ")) continue;
      handleDataPayload(raw.slice(6).trim());
    }
  }

  onDone();
}

const COMMIT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trade-concierge-commit`;

export type CommitResult =
  | { ok: true; board_id: string; url: string; added: number; duplicates?: number }
  | { ok: false; error: string };

export async function commitProposal(
  proposal: { tool: string; args: unknown },
  authToken: string,
): Promise<CommitResult> {
  try {
    const resp = await fetch(COMMIT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(proposal),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) return { ok: false, error: data.error || `Error ${resp.status}` };
    return {
      ok: true,
      board_id: data.board_id,
      url: data.url,
      added: data.added,
      duplicates: data.duplicates,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}
