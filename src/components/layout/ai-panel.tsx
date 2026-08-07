"use client";

import * as React from "react";
import {
  Sparkles,
  Wand2,
  Send,
  PenLine,
  Users,
  Target,
} from "lucide-react";
import { useUiStore } from "@/stores/ui-store";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";

interface Message {
  id: string;
  role: "assistant" | "user";
  content: string;
  actions?: AiAction[];
  time: string;
}

let messageSeq = 0;
function messageId(prefix: string): string {
  messageSeq += 1;
  return `${prefix}-${messageSeq}`;
}

interface AiAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const suggestedPrompts = [
  { id: "subject", label: "Write 5 subject lines", icon: PenLine },
  { id: "rewrite", label: "Improve this email", icon: Wand2 },
  { id: "template", label: "Draft a template", icon: PenLine },
  { id: "audience", label: "Suggest segments", icon: Users },
  { id: "timing", label: "Best time to send?", icon: Target },
];

const initialActions: AiAction[] = suggestedPrompts.map((p) => ({
  id: p.id,
  label: p.label,
  icon: p.icon,
}));

export function AiPanel() {
  const open = useUiStore((s) => s.aiOpen);
  const setOpen = useUiStore((s) => s.setAiOpen);
  const user = useAuthStore((s) => s.user);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [offline, setOffline] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const firstName = user?.name?.trim().split(/\s+/)[0];

  React.useEffect(() => {
    if (!open || messages.length > 0) return;
    const greeting: Message = {
      id: messageId("m"),
      role: "assistant",
      content: `Hi ${firstName ?? "there"} 👋 I'm Geko, your AI marketing copilot. I can write subject lines, improve your copy, and draft templates. What would you like to work on?`,
      actions: initialActions,
      time: "now",
    };
    setMessages([greeting]);
  }, [open, messages.length, firstName]);

  React.useEffect(() => {
    if (open) {
      const t = setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
      }, 150);
      return () => clearTimeout(t);
    }
  }, [open, messages]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const userMsg: Message = {
      id: messageId("u"),
      role: "user",
      content: trimmed,
      time: "now",
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const res = await api.post<{ reply: string; fallback?: boolean }>("/api/v1/ai/chat", {
        message: trimmed,
      });
      if (res.fallback) setOffline(true);
      setMessages((prev) => [
        ...prev,
        { id: messageId("a"), role: "assistant", content: res.reply, time: "now" },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: messageId("a"),
          role: "assistant",
          content: err instanceof Error ? err.message : "Something went wrong. Please try again.",
          time: "now",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const runAction = (id: string) => {
    const prompt = suggestedPrompts.find((p) => p.id === id);
    if (prompt) send(prompt.label);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-md">
        <SheetTitle className="sr-only">AI Studio</SheetTitle>
        <div className="bg-card flex h-16 shrink-0 items-center gap-3 border-b px-5">
          <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-xl">
            <Sparkles className="size-5" />
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Geko — AI Studio</span>
            <span className="text-muted-foreground text-xs">Your email marketing copilot</span>
          </div>
          {offline && (
            <span className="ml-auto rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[0.65rem] font-medium text-warning">
              Offline mode
            </span>
          )}
        </div>

        <ScrollArea className="min-h-0 flex-1 px-5 py-4" ref={scrollRef}>
          <div className="space-y-5">
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}
              >
                {m.role === "assistant" ? (
                  <Avatar className="bg-primary/10 text-primary size-8 shrink-0">
                    <AvatarFallback>
                      <Sparkles className="size-4" />
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <Avatar className="size-8 shrink-0">
                    <AvatarFallback className="bg-secondary text-secondary-foreground">GL</AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={cn(
                    "flex max-w-[85%] flex-col gap-2",
                    m.role === "user" && "items-end"
                  )}
                >
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
                      m.role === "assistant"
                        ? "bg-card border text-card-foreground rounded-tl-sm"
                        : "bg-primary text-primary-foreground rounded-tr-sm"
                    )}
                  >
                    {m.content}
                  </div>
                  {m.actions && (
                    <div className="mt-1 flex flex-wrap gap-2">
                      {m.actions.map((action) => (
                        <button
                          key={action.id}
                          onClick={() => runAction(action.id)}
                          className="hover:bg-accent text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium transition-colors"
                        >
                          <action.icon className="size-3.5" />
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <Avatar className="bg-primary/10 text-primary size-8 shrink-0">
                  <AvatarFallback>
                    <Sparkles className="size-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-card flex items-center gap-1.5 rounded-2xl rounded-tl-sm border px-4 py-3">
                  <span className="bg-primary/40 size-1.5 animate-bounce rounded-full [animation-delay:-0.3s]" />
                  <span className="bg-primary/40 size-1.5 animate-bounce rounded-full [animation-delay:-0.15s]" />
                  <span className="bg-primary/40 size-1.5 animate-bounce rounded-full" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="shrink-0 border-t p-4">
          <div className="bg-muted/60 focus-within:ring-ring flex items-end gap-2 rounded-xl border p-2 transition-shadow focus-within:ring-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Ask Geko anything about your email marketing…"
              className="border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:outline-none min-h-9 resize-none"
              rows={1}
            />
            <Button
              size="icon-sm"
              onClick={() => send(input)}
              disabled={!input.trim() || loading}
              aria-label="Send message"
            >
              <Send />
            </Button>
          </div>
          {offline && (
            <p className="text-muted-foreground mt-2 text-center text-[0.7rem]">
              No AI model is configured on this server, so replies are template-based.
              Ask an admin to set OPENAI_API_KEY for model-generated answers.
            </p>
          )}
          <p className="text-muted-foreground mt-2 text-center text-[0.7rem]">
            Geko can make mistakes. Verify important details before sending.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
