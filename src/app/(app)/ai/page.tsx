"use client";

import * as React from "react";
import Link from "next/link";
import {
  Sparkles,
  PenLine,
  Wand2,
  Mail,
  ScanSearch,
  Languages,
  Clock,
  ArrowRight,
  TrendingUp,
  Users,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";

interface Tool {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  usage: string;
}

const tools: Tool[] = [
  {
    id: "subject",
    title: "Subject line generator",
    description: "Turn a one-liner into 10 high-converting subjects.",
    icon: PenLine,
    color: "text-primary",
    bg: "bg-primary/10",
    usage: "1,284 runs",
  },
  {
    id: "copy",
    title: "Email copywriter",
    description: "Write or rewrite full campaigns in your brand voice.",
    icon: Mail,
    color: "text-sky-500",
    bg: "bg-info/10",
    usage: "942 runs",
  },
  {
    id: "spam",
    title: "Spam score & preview",
    description: "Check deliverability and inbox placement risk.",
    icon: ScanSearch,
    color: "text-amber-500",
    bg: "bg-warning/10",
    usage: "611 runs",
  },
  {
    id: "translate",
    title: "Translate & localize",
    description: "Ship to 40+ languages without losing your voice.",
    icon: Languages,
    color: "text-violet-500",
    bg: "bg-violet-500/10",
    usage: "388 runs",
  },
  {
    id: "segments",
    title: "Segment suggestions",
    description: "Discover audiences hiding in your contact data.",
    icon: Users,
    color: "text-rose-500",
    bg: "bg-rose-500/10",
    usage: "274 runs",
  },
  {
    id: "timing",
    title: "Send-time optimizer",
    description: "Find the perfect moment for every subscriber.",
    icon: Clock,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    usage: "198 runs",
  },
];

const recentGenerations = [
  {
    id: "g-1",
    tool: "Subject line generator",
    prompt: "July Product Digest for SaaS customers",
    result: "1. “7 features that ship in July — one is a game-changer”",
    icon: PenLine,
    color: "text-primary",
    bg: "bg-primary/10",
    time: "2h ago",
  },
  {
    id: "g-2",
    tool: "Spam score & preview",
    prompt: "Welcome to Mailgeko 🦎",
    result: "Spam score 8/100 — excellent. Renders cleanly in 12 clients.",
    icon: ScanSearch,
    color: "text-amber-500",
    bg: "bg-warning/10",
    time: "Yesterday",
  },
  {
    id: "g-3",
    tool: "Segment suggestions",
    prompt: "Find high-intent buyers",
    result: "Hot leads · 412 contacts — opened 3+ emails & clicked in 30 days.",
    icon: Users,
    color: "text-rose-500",
    bg: "bg-rose-500/10",
    time: "2 days ago",
  },
];

export default function AiStudioPage() {
  const setAiOpen = useUiStore((s) => s.setAiOpen);
  const [activeTool, setActiveTool] = React.useState("subject");
  const [subjectInput, setSubjectInput] = React.useState("");
  const [generating, setGenerating] = React.useState(false);
  const [subjects, setSubjects] = React.useState<string[]>([]);
  const [copied, setCopied] = React.useState<string | null>(null);
  const [tone, setTone] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<"up" | "down" | null>(null);
  const [savedPrompts, setSavedPrompts] = React.useState([
    { id: "p-1", title: "Brand voice", preview: "Write like a friendly expert — short sentences, no hype.", icon: Wand2 },
    { id: "p-2", title: "Monthly digest", preview: "Turn changelog bullet points into a story-driven digest.", icon: Mail },
    { id: "p-3", title: "Product launch", preview: "Tease, announce, and follow up across 3 emails.", icon: TrendingUp },
  ]);

  const generate = () => {
    setGenerating(true);
    setTimeout(() => {
      const input = subjectInput.trim() || "this campaign";
      setSubjects([
        `7 features that ship in July — one is a game-changer (${input})`,
        `Your ${input} digest is here (and it's packed)`,
        `Inside: the AI tool our customers asked for (${input})`,
        `Don't open this email (unless you love wins) 🦎`,
        `July recap: 7 ships, 1 surprise, 0 fluff (${input})`,
        `The one ${input} email you'll actually read`,
      ]);
      setGenerating(false);
    }, 1400);
  };

  const copySubject = (subject: string) => {
    setCopied(subject);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-transparent to-transparent p-6 sm:p-8">
        <div className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Badge variant="outline" className="bg-background/60 mb-3 gap-1.5">
              <Sparkles className="text-primary size-3" /> AI Studio
            </Badge>
            <h2 className="text-2xl font-semibold tracking-tight">Geko AI Studio</h2>
            <p className="text-muted-foreground mt-1 max-w-lg text-sm">
              Write, optimize, translate and analyze — all in one place.
              Your data never trains external models.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setAiOpen(true)}>
              <Sparkles /> Open assistant
            </Button>
            <Button asChild>
              <Link href="/campaigns/new">
                Generate for a campaign <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={activeTool} onValueChange={setActiveTool} className="flex flex-col gap-4">
        <div className="overflow-x-auto pb-1">
          <TabsList className="h-auto w-max justify-start gap-1 bg-transparent p-0">
            {tools.map((tool) => (
              <TabsTrigger
                key={tool.id}
                value={tool.id}
                className="border-border hover:bg-muted data-[state=active]:bg-card data-[state=active]:shadow-sm flex items-center gap-2 rounded-lg border px-3 py-2"
              >
                <span className={cn("flex size-6 items-center justify-center rounded-md", tool.bg, tool.color)}>
                  <tool.icon className="size-3.5" />
                </span>
                {tool.title}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="subject" className="mt-0">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Subject line generator</CardTitle>
                <CardDescription>Describe your campaign and get 6 proven formats.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <Textarea
                  placeholder="e.g. Our July product digest, for SaaS customers who like practical tips"
                  value={subjectInput}
                  onChange={(e) => setSubjectInput(e.target.value)}
                  className="min-h-24"
                />
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex flex-wrap gap-2">
                    {["Curiosity", "Urgency", "Benefits", "Personal"].map((t) => (
                      <button
                        key={t}
                        onClick={() => setTone((prev) => (prev === t ? null : t))}
                        className={
                          tone === t
                            ? "border-primary bg-primary/10 text-primary rounded-full border px-3 py-1 text-xs font-medium transition-colors"
                            : "border-border text-muted-foreground hover:border-primary hover:text-primary rounded-full border px-3 py-1 text-xs font-medium transition-colors"
                        }
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <Button className="ml-auto" onClick={generate} disabled={generating}>
                    {generating ? <RefreshCw className="animate-spin" /> : <Sparkles />}
                    {generating ? "Writing…" : "Generate subject lines"}
                  </Button>
                </div>

                {subjects.length > 0 && (
                  <div className="flex flex-col gap-2 border-t pt-4">
                    {subjects.map((subject, i) => (
                      <div
                        key={i}
                        className="hover:bg-muted/40 flex items-center gap-3 rounded-lg border px-3 py-2.5"
                      >
                        <span className="bg-primary/10 text-primary flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold">
                          {i + 1}
                        </span>
                        <p className="min-w-0 flex-1 truncate text-sm">{subject}</p>
                        <span className="text-muted-foreground hidden shrink-0 text-[0.65rem] font-medium lg:block">
                          {["Curiosity", "Urgency", "Benefit", "Humor", "Recap", "Personal"][i]}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => copySubject(subject)}
                          aria-label="Copy subject line"
                        >
                          {copied === subject ? <Check className="text-success" /> : <Copy />}
                        </Button>
                      </div>
                    ))}
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-muted-foreground mr-1 text-xs">Was this helpful?</span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Thumbs up"
                        aria-pressed={feedback === "up"}
                        onClick={() => {
                          setFeedback((f) => (f === "up" ? null : "up"));
                          toast.success("Thanks for the feedback");
                        }}
                      >
                        <ThumbsUp className={feedback === "up" ? "text-primary" : ""} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Thumbs down"
                        aria-pressed={feedback === "down"}
                        onClick={() => {
                          setFeedback((f) => (f === "down" ? null : "down"));
                          toast.info("Got it — we'll tune the output");
                        }}
                      >
                        <ThumbsDown className={feedback === "down" ? "text-primary" : ""} />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex flex-col gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">How it works</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {[
                    "We analyze your past campaigns for what performs",
                    "Subject lines adapt to your brand voice",
                    "Every suggestion is yours — nothing is shared",
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="bg-secondary text-secondary-foreground flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                        {i + 1}
                      </span>
                      <p className="text-muted-foreground text-xs leading-relaxed">{step}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Try on a live campaign</CardTitle>
                  <CardDescription>Pick any draft to optimize</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  {["July Product Digest", "Fall Flash Sale — Draft"].map((c) => (
                    <Button key={c} variant="outline" size="sm" className="justify-between">
                      {c} <ArrowRight className="size-3.5" />
                    </Button>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="copy" className="mt-0">
          <CopywriterTool />
        </TabsContent>

        {(activeTool === "spam" || activeTool === "translate" || activeTool === "segments" || activeTool === "timing") && (
          <TabsContent value={activeTool} className="mt-0">
            <ComingSoon tool={tools.find((t) => t.id === activeTool)!} />
          </TabsContent>
        )}
      </Tabs>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent generations</CardTitle>
            <CardDescription>Your latest AI Studio activity</CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm" onClick={() => toast.info("Full generation history is coming soon")}>
                View history
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {recentGenerations.map((gen) => (
                <div key={gen.id} className="hover:bg-muted/40 flex items-start gap-3 px-5 py-4 transition-colors">
                  <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", gen.bg, gen.color)}>
                    <gen.icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{gen.tool}</p>
                      <span className="text-muted-foreground shrink-0 text-xs">{gen.time}</span>
                    </div>
                    <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">“{gen.prompt}”</p>
                    <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">{gen.result}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Saved prompts</CardTitle>
            <CardDescription>Reusable instructions for consistent output</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {savedPrompts.map((prompt) => (
              <div key={prompt.id} className="hover:bg-muted/40 flex items-center gap-3 rounded-lg border px-3 py-3 transition-colors">
                <span className="bg-secondary text-secondary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
                  <prompt.icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{prompt.title}</p>
                  <p className="text-muted-foreground line-clamp-1 text-xs">{prompt.preview}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSubjectInput(prompt.preview);
                    toast.success(`Prompt "${prompt.title}" loaded`);
                  }}
                >
                  Use
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => {
                if (!subjectInput.trim()) {
                  toast.error("Write a prompt first, then save it");
                  return;
                }
                setSavedPrompts((prev) => [
                  {
                    id: `p-${Date.now()}`,
                    title: subjectInput.trim().slice(0, 28),
                    preview: subjectInput.trim(),
                    icon: Wand2,
                  },
                  ...prev,
                ]);
                toast.success("Prompt saved to your library");
              }}
            >
              <Send /> Save new prompt
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CopywriterTool() {
  const [input, setInput] = React.useState("");
  const [output, setOutput] = React.useState("");
  const [generating, setGenerating] = React.useState(false);

  const generate = () => {
    setGenerating(true);
    setTimeout(() => {
      setOutput(
        "Subject: Your July digest is here (and it's packed)\n\nHey {{first_name}},\n\nLast month we shipped 7 things — and one of them changes how you'll write emails forever.\n\nHere's what landed:\n\n1. AI Studio — generate subject lines in one click\n2. Segment builder v2 — behavioral filters now live\n3. 2x faster sends with the new queue\n\nWant the deep dive? The full changelog is on the blog.\n\nHappy sending,\nThe Mailgeko Team 🦎"
      );
      setGenerating(false);
    }, 1200);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Paste your draft</CardTitle>
          <CardDescription>We&apos;ll sharpen copy, fix flow, and match your brand voice.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Textarea
            placeholder="Paste your email draft here, or describe what you want to write…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="min-h-64 flex-1"
          />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => toast.info("Brand voice chooser is coming soon")}>Choose brand voice</Button>
            <Button size="sm" className="ml-auto" onClick={generate} disabled={generating || !input.trim()}>
              {generating ? <RefreshCw className="animate-spin" /> : <Wand2 />}
              {generating ? "Rewriting…" : "Improve copy"}
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Improved version</CardTitle>
          <CardDescription>Edits are tracked — review before you apply.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {output ? (
            <>
              <pre className="bg-muted/50 flex-1 overflow-auto whitespace-pre-wrap rounded-lg border p-4 font-sans text-sm leading-relaxed">
                {output}
              </pre>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">
                  Tone: friendly · Length: −22% · Flesch score: 68
                </span>
                <Button size="sm" onClick={() => toast.success("Draft applied to your campaign")}>
                  <Mail /> Apply to campaign
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed">
              <p className="text-muted-foreground max-w-56 text-center text-sm">
                Your improved copy will appear here.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ComingSoon({ tool }: { tool: Tool }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <span className={cn("flex size-14 items-center justify-center rounded-2xl", tool.bg, tool.color)}>
          <tool.icon className="size-7" />
        </span>
        <div>
          <h3 className="font-semibold">{tool.title}</h3>
          <p className="text-muted-foreground mt-1 max-w-sm text-sm">
            {tool.description}. This tool is in preview — open the assistant to try it now.
          </p>
        </div>
        <Badge variant="outline" className="mt-1">Preview</Badge>
      </CardContent>
    </Card>
  );
}
