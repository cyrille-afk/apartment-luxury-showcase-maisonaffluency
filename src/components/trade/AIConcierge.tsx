import { useState, useRef, useEffect, useCallback } from "react";
import { MessageSquare, X, Send, Loader2, Sparkles } from "lucide-react";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { streamConcierge, type ChatMessage } from "@/lib/tradeConciergeStream";
import { toast } from "sonner";

const GREETING = "Hello! I'm your Maison Affluency concierge. How can I assist you today — looking for a specific piece, exploring a designer, or navigating the portal?";

export function AIConcierge() {
  const { pathname } = useLocation();
  const isDashboard = pathname === "/trade";
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: GREETING },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setStreaming(true);

    let assistantSoFar = "";
    const controller = new AbortController();
    abortRef.current = controller;

    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && last !== messages[messages.length - 1]) {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      await streamConcierge({
        messages: nextMessages,
        onDelta: upsert,
        onDone: () => setStreaming(false),
        onError: (msg) => {
          toast.error(msg);
          setStreaming(false);
        },
        signal: controller.signal,
      });
    } catch {
      setStreaming(false);
    }
  }, [input, streaming, messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <>
      {/* Hidden trigger for dashboard inline button */}
      {!open && isDashboard && (
        <button
          onClick={() => setOpen(true)}
          className="sr-only"
          aria-label="Open AI Concierge"
        />
      )}

      {/* Floating trigger on all non-dashboard pages */}
      {!open && !isDashboard && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-20 md:bottom-6 right-4 z-[100] flex items-center gap-2 rounded-full bg-foreground text-background px-4 py-3 shadow-lg hover:opacity-90 transition-opacity print:hidden"
          aria-label="Open AI Concierge"
        >
          <Sparkles className="h-4 w-4" />
          <span className="font-body text-xs uppercase tracking-widest hidden sm:inline">Concierge</span>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-20 md:bottom-6 right-4 z-[100] w-[360px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-6rem)] flex flex-col rounded-2xl border border-border bg-background shadow-2xl print:hidden animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              <span className="font-display text-sm uppercase tracking-widest">Concierge</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2.5 font-body text-sm leading-relaxed whitespace-pre-wrap",
                    msg.role === "user"
                      ? "bg-foreground text-background rounded-br-md"
                      : "bg-muted text-foreground rounded-bl-md"
                  )}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {streaming && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-md px-3.5 py-2.5">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border p-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me anything…"
                rows={1}
                className="flex-1 resize-none rounded-xl border border-border bg-muted/50 px-3 py-2 font-body text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                disabled={streaming}
              />
              <button
                onClick={send}
                disabled={!input.trim() || streaming}
                className="shrink-0 rounded-xl bg-foreground text-background p-2 disabled:opacity-40 hover:opacity-90 transition-opacity"
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="font-body text-[10px] text-muted-foreground mt-1.5 text-center">
              AI-powered · May not always be accurate
            </p>
          </div>
        </div>
      )}
    </>
  );
}
