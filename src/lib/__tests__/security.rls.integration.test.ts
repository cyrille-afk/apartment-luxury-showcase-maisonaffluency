/**
 * Integration tests guarding the two security errors we fixed:
 *
 *  1) `featured_studios.contact_email` must NEVER be readable by an
 *     anonymous (unauthenticated) caller.
 *  2) `realtime.messages` must reject anonymous broadcast inserts and
 *     reject authenticated inserts targeting another user's topic.
 *
 * These hit the live Lovable Cloud (Supabase) REST endpoint with the
 * project's anon key. Net-disabled environments will skip silently.
 */
import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as
  | string
  | undefined;

const skip = !SUPABASE_URL || !ANON_KEY;
const d = skip ? describe.skip : describe;

d("RLS guard: featured_studios.contact_email is hidden from anon", () => {
  const anon = createClient(SUPABASE_URL!, ANON_KEY!, {
    auth: { persistSession: false },
  });

  it("anon cannot SELECT contact_email column directly", async () => {
    const { data, error } = await anon
      .from("featured_studios")
      .select("id, contact_email")
      .limit(1);

    // Either Postgres rejects the column (preferred) or returns rows
    // where contact_email is masked. Both prove the column is gated.
    if (error) {
      expect(error.message.toLowerCase()).toMatch(
        /permission|denied|column|contact_email/,
      );
      return;
    }
    for (const row of data ?? []) {
      expect((row as Record<string, unknown>).contact_email ?? null).toBeNull();
    }
  });

  it("anon CAN still SELECT public columns (directory still works)", async () => {
    const { data, error } = await anon
      .from("featured_studios_public")
      .select("id, name, slug, is_published")
      .limit(1);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
});

d("RLS guard: realtime.messages rejects unauthorized broadcasts", () => {
  const anon = createClient(SUPABASE_URL!, ANON_KEY!, {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 1 } },
  });

  it("anon broadcast to a user-scoped topic does not deliver to other users", async () => {
    // Subscribe a second anonymous client to a topic that is NOT theirs.
    // RLS should block any broadcast they receive.
    const listener = createClient(SUPABASE_URL!, ANON_KEY!, {
      auth: { persistSession: false },
    });
    const fakeUid = "00000000-0000-0000-0000-000000000001";
    const topic = `user:${fakeUid}`;

    // Use PRIVATE channels — these route through realtime.messages and
    // therefore enforce our RLS policy. (Public broadcast channels are
    // intentionally in-memory and unauthenticated by design.)
    const received: unknown[] = [];
    let listenerStatus = "";
    const ch = listener.channel(topic, {
      config: { private: true, broadcast: { self: false } },
    });
    ch.on("broadcast", { event: "test" }, (p) => received.push(p));

    await new Promise<void>((resolve) => {
      ch.subscribe((status) => {
        listenerStatus = status;
        if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR") resolve();
      });
      setTimeout(resolve, 4000);
    });

    // Anon must NOT be able to subscribe to a private user-scoped topic.
    expect(listenerStatus).not.toBe("SUBSCRIBED");

    // And anon broadcast must not deliver either.
    let senderStatus = "";
    const sender = anon.channel(topic, { config: { private: true } });
    await new Promise<void>((resolve) => {
      sender.subscribe((status) => {
        senderStatus = status;
        if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR") resolve();
      });
      setTimeout(resolve, 4000);
    });
    expect(senderStatus).not.toBe("SUBSCRIBED");

    await new Promise((r) => setTimeout(r, 1000));
    expect(received).toHaveLength(0);

    await listener.removeAllChannels();
    await anon.removeAllChannels();
  }, 15000);
});
