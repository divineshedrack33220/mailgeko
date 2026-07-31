"use client";

import * as React from "react";
import {
  Sparkles,
  Wand2,
  Send,
  PenLine,
  TrendingUp,
  Users,
  Target,
} from "lucide-react";
import { useUiStore } from "@/stores/ui-store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
  { id: "summary", label: "Summarize last campaign", icon: TrendingUp },
  { id: "audience", label: "Suggest segments", icon: Users },
  { id: "timing", label: "Best time to send?", icon: Target },
];

const initialMessages: Message[] = [
  {
    id: "m-0",
    role: "assistant",
    content:
      "Hi Grace 👋 I'm Geko, your AI marketing copilot. I can write subject lines, improve your copy, analyze campaign performance, and suggest audience segments. What would you like to work on?",
    actions: suggestedPrompts.map((p) => ({
      id: p.id,
      label: p.label,
      icon: p.icon,
    })),
    time: "now",
  },
];

const cannedResponses: Record<string, string> = {
  subject:
    "Here are 5 subject lines for your July Product Digest:\n\n1. “7 features that ship in July — one is a game-changer”\n2. “Your July digest is here (and it's packed)”\n3. “Inside: the AI tool our customers asked for”\n4. “Don't open this email (unless you love wins) 🦎”\n5. “July recap: 7 ships, 1 surprise, 0 fluff”\n\nWant me to A/B test the top 2?",
  rewrite:
    "I reviewed your copy and made these improvements:\n\n• Shortened the opening from 42 to 18 words (busy inboxes)\n• Turned passive headlines into active ones\n• Added one clear CTA instead of three competing ones\n• Matched tone to “professional but approachable”\n\nHere's the revised version — want me to apply it to the campaign?",
  summary:
    "Here's your July Product Digest performance:\n\n• Delivered: 1,089 (98.8%)\n• Open rate: 43.8% (+6.2% vs. campaign avg)\n• Click rate: 18.2% (+3.1% vs. campaign avg)\n• Unsubscribes: 9 (0.8%) — healthy\n\n🏆 Best performer: the “What shipped” section.\n\nSuggestion: send to your “Opened but never clicked” segment next week.",
  audience:
    "Based on engagement patterns, I'd create these segments:\n\n1. “Hot leads” — opened 3+ emails, clicked in last 30 days (≈412 contacts)\n2. “Warm prospects” — visited pricing but never opened\n3. “At risk” — 60+ days inactive (≈214 contacts)\n4. “Power users” — clicked 5+ campaigns\n\nI can build these automatically — just say the word.",
  timing:
    "Based on your audience's behavior:\n\n• Best day: Tuesday–Thursday\n• Peak open window: 9:00–11:00 AM (local time)\n• Your engagement is 18% higher on Tue 10 AM\n\nPro tip: use timezone-aware sending so every subscriber gets the email at 10 AM their time.",
  default:
    "I can help with subject lines, copywriting, campaign analysis, segmentation, and send-time optimization. Try one of the suggested prompts below, or tell me what you need in your own words.",
};

export function AiPanel() {
  const open = useUiStore((s) => s.aiOpen);
  const setOpen = useUiStore((s) => s.setAiOpen);
  const [messages, setMessages] = React.useState<Message[]>(initialMessages);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (open) {
      const t = setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
      }, 150);
      return () => clearTimeout(t);
    }
  }, [open, messages]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const userMsg: Message = {
      id: messageId("u"),
      role: "user",
      content: trimmed,
      time: "now",
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    const key = Object.keys(cannedResponses).find(
      (k) => k !== "default" && (trimmed.toLowerCase().includes(k) || k.split(" ").some((w) => trimmed.toLowerCase().includes(w)))
    );

    setTimeout(() => {
      const response: Message = {
        id: messageId("a"),
        role: "assistant",
        content: cannedResponses[key ?? "default"],
        time: "now",
      };
      setMessages((prev) => [...prev, response]);
      setLoading(false);
    }, 1200);
  };

  const runAction = (id: string) => {
    const prompt = suggestedPrompts.find((p) => p.id === id);
    if (prompt) send(prompt.label);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="w-full p-0 sm:max-w-md">
        <SheetTitle className="sr-only">AI Studio</SheetTitle>
        <div className="flex h-full flex-col">
        <div className="bg-card flex h-16 shrink-0 items-center gap-3 border-b px-5">
          <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-xl">
            <Sparkles className="size-5" />
          </span>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Geko — AI Studio</span>
              <Badge variant="success" className="text-[0.6rem]">
                GPT-4o
              </Badge>
            </div>
            <span className="text-muted-foreground text-xs">Online · answers in seconds</span>
          </div>
        </div>
        </div>

        <ScrollArea className="flex-1 px-5 py-4" ref={scrollRef}>
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

        <div className="border-t p-4">
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
          <p className="text-muted-foreground mt-2 text-center text-[0.7rem]">
            Geko can make mistakes. Verify important details before sending.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
