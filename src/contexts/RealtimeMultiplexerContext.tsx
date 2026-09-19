/**
 * Realtime multiplexer.
 *
 * The portal used to open one Supabase realtime channel per hook/component
 * (sidebar badges, notification bell, sales funnel, sample requests, studio
 * bridge…). Every signed-in session therefore held a fan of websockets open
 * regardless of which page was mounted, and each incoming event fanned out
 * into its own refetch — a write-amplification loop that scaled with
 * concurrent users, not with actual data change.
 *
 * This provider opens EXACTLY ONE channel subscribed to the whole `public`
 * schema and dispatches every payload to interested subscribers through React
 * context. Consumers register a table name (or several) plus a callback; no
 * consumer ever touches `supabase.channel()` again.
 *
 * Notes:
 * - RLS still applies to realtime, so a session only ever receives rows it is
 *   allowed to read.
 * - Row-level filtering (e.g. `user_id=eq.x`) that used to live in the channel
 *   filter now happens client-side in the consumer callback, because a single
 *   shared socket cannot carry per-consumer server filters.
 * - Only tables inside the `supabase_realtime` publication emit events.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type DbRow = Record<string, any>;

export type RealtimeEvent = {
  table: string;
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: DbRow | null;
  old: DbRow | null;
};

type Handler = (event: RealtimeEvent) => void;

type MultiplexerValue = {
  /** Register a handler for one or more public-schema tables. Returns an unsubscribe fn. */
  subscribe: (tables: string[], handler: Handler) => () => void;
  /** True once the shared channel has joined. */
  connected: boolean;
};

const RealtimeMultiplexerContext = createContext<MultiplexerValue | null>(null);

const CHANNEL_TOPIC = "ma-public-multiplex";

export function RealtimeMultiplexerProvider({ children }: { children: ReactNode }) {
  const registry = useRef<Map<string, Set<Handler>>>(new Map());
  const [connected, setConnected] = useState(false);

  const subscribe = useCallback((tables: string[], handler: Handler) => {
    const map = registry.current;
    for (const table of tables) {
      let set = map.get(table);
      if (!set) {
        set = new Set();
        map.set(table, set);
      }
      set.add(handler);
    }
    return () => {
      for (const table of tables) {
        const set = map.get(table);
        if (!set) continue;
        set.delete(handler);
        if (set.size === 0) map.delete(table);
      }
    };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel(CHANNEL_TOPIC)
      .on(
        "postgres_changes",
        { event: "*", schema: "public" },
        (payload: RealtimePostgresChangesPayload<DbRow>) => {
          const table = (payload as any).table as string;
          const handlers = registry.current.get(table);
          if (!handlers || handlers.size === 0) return;
          const event: RealtimeEvent = {
            table,
            eventType: payload.eventType as RealtimeEvent["eventType"],
            new: (payload.new as DbRow) ?? null,
            old: (payload.old as DbRow) ?? null,
          };
          // Copy so a handler unsubscribing mid-dispatch can't mutate the set.
          for (const handler of [...handlers]) {
            try {
              handler(event);
            } catch {
              /* one bad consumer must never break the shared socket */
            }
          }
        },
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    return () => {
      setConnected(false);
      supabase.removeChannel(channel);
    };
  }, []);

  const value = useMemo<MultiplexerValue>(() => ({ subscribe, connected }), [subscribe, connected]);

  return (
    <RealtimeMultiplexerContext.Provider value={value}>
      {children}
    </RealtimeMultiplexerContext.Provider>
  );
}

/**
 * Subscribe to changes on one or more public-schema tables through the single
 * shared channel. The callback is kept in a ref, so an inline arrow function
 * is fine — it never re-registers the listener.
 */
export function useRealtimeTables(
  tables: string | string[],
  handler: Handler,
  enabled: boolean = true,
) {
  const ctx = useContext(RealtimeMultiplexerContext);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const key = Array.isArray(tables) ? tables.join(",") : tables;

  useEffect(() => {
    if (!ctx || !enabled) return;
    const list = key ? key.split(",") : [];
    if (list.length === 0) return;
    return ctx.subscribe(list, (event) => handlerRef.current(event));
  }, [ctx, key, enabled]);
}

/** Connection status of the shared channel (diagnostics only). */
export function useRealtimeConnected(): boolean {
  return useContext(RealtimeMultiplexerContext)?.connected ?? false;
}
