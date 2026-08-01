import { useCallback, useEffect, useRef } from "react";
import { MessageSquare } from "lucide-react";
import { AIConcierge } from "@/components/trade/AIConcierge";

export interface FelixProductContext {
  title: string;
  designer: string;
  dimensions?: string | null;
  materials?: string | null;
  leadTime?: string | null;
  finishes?: string[];
  url?: string;
}

/**
 * Inline Felix mount for the authenticated Trade Workspace.
 *
 * This module is loaded lazily and ONLY for verified trade sessions, so the
 * concierge component, its prompts and its API bootstrapping never reach the
 * DOM or the client bundle of a signed-out visitor.
 */
export function buildFelixProductContext(ctx: FelixProductContext): string {
  const lines = [
    `Context — I am currently viewing this piece on Maison Affluency:`,
    `• Piece: ${ctx.title}`,
    `• Maker / Designer: ${ctx.designer}`,
  ];
  if (ctx.dimensions) lines.push(`• Dimensions: ${ctx.dimensions}`);
  if (ctx.materials) lines.push(`• Materials: ${ctx.materials}`);
  if (ctx.leadTime) lines.push(`• Lead time: ${ctx.leadTime}`);
  if (ctx.finishes?.length) lines.push(`• Finish selection: ${ctx.finishes.join(" · ")}`);
  if (ctx.url) lines.push(`• Page: ${ctx.url}`);
  lines.push("", "Keep this piece as the active reference for the rest of our conversation.");
  return lines.join("\n");
}

export default function ProductFelixPanel({ context }: { context: FelixProductContext }) {
  const contextRef = useRef(context);
  contextRef.current = context;

  const openWithContext = useCallback((prefill?: string) => {
    window.dispatchEvent(
      new CustomEvent("concierge:stage", {
        detail: {
          openPanel: true,
          prefill: prefill ?? buildFelixProductContext(contextRef.current),
        },
      })
    );
  }, []);

  // Seed the composer with the piece context as soon as the workspace mounts,
  // without auto-sending — the designer reviews and sends.
  useEffect(() => {
    const t = setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("concierge:stage", {
          detail: { prefill: buildFelixProductContext(contextRef.current) },
        })
      );
    }, 400);
    return () => clearTimeout(t);
  }, []);

  const suggestions = [
    `Suggest pieces that sit well with the ${context.title}.`,
    `What finishes and fabrics work best on the ${context.title}?`,
    `Draft a client-facing note about the ${context.title} by ${context.designer}.`,
  ];

  return (
    <div className="rounded-lg border border-border bg-card/40 p-5 h-full flex flex-col">
      <p className="font-body text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--gold))]">
        Felix · AI Curatorial Guide
      </p>
      <h2 className="font-display text-lg mt-2 leading-snug">
        Welcome to the Maison Affluency Atelier
      </h2>
      <p className="font-body text-xs text-muted-foreground leading-relaxed mt-2">
        Felix already has the {context.title} by {context.designer} in view — its dimensions,
        materials and finish options. Ask about pairings, lead times, or build a schedule around it.
      </p>

      <div className="mt-4 flex flex-col gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => openWithContext(`${buildFelixProductContext(contextRef.current)}\n\n${s}`)}
            className="text-left rounded-md border border-border/70 px-3 py-2 font-body text-[11px] text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>

      <button
        onClick={() => openWithContext()}
        className="mt-auto pt-4 inline-flex items-center justify-center gap-2 self-stretch"
      >
        <span className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-md bg-foreground text-background font-body text-[11px] uppercase tracking-[0.12em] hover:bg-foreground/90 transition-colors">
          <MessageSquare className="h-3.5 w-3.5" />
          Ask Felix about this piece
        </span>
      </button>

      {/* Concierge runtime — mounted only inside the authenticated workspace. */}
      <AIConcierge />
    </div>
  );
}
