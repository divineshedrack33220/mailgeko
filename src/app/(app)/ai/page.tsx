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
  Users,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  Trash2,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/format";

interface Tool {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
}

const tools: Tool[] = [
  {
    id: "subject",
    title: "Subject line generator",
    description: "Turn a one-liner into 10 high-converting subjects.",
    icon: PenLine,
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    id: "copy",
    title: "Email copywriter",
    description: "Write or rewrite full campaigns in your brand voice.",
    icon: Mail,
    color: "text-sky-500",
    bg: "bg-info/10",
  },
  {
    id: "spam",
    title: "Spam score & preview",
    description: "Check deliverability and inbox placement risk.",
    icon: ScanSearch,
    color: "text-amber-500",
    bg: "bg-warning/10",
  },
  {
    id: "translate",
    title: "Translate & localize",
    description: "Ship to 40+ languages without losing your voice.",
    icon: Languages,
    color: "text-violet-500",
    bg: "bg-violet-500/10",
  },
  {
    id: "segments",
    title: "Segment suggestions",
    description: "Discover audiences hiding in your contact data.",
    icon: Users,
    color: "text-rose-500",
    bg: "bg-rose-500/10",
  },
  {
    id: "timing",
    title: "Send-time optimizer",
    description: "Find the perfect moment for every subscriber.",
    icon: Clock,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
];

const kindMeta = {
  subject: { label: "Subject lines", icon: PenLine, color: "text-primary", bg: "bg-primary/10" },
  campaign: { label: "Campaign copy", icon: Mail, color: "text-sky-500", bg: "bg-info/10" },
  template: { label: "Template", icon: FileText, color: "text-violet-500", bg: "bg-violet-500/10" },
} as const;

interface AIHistoryItem {
  id: string;
  kind: keyof typeof kindMeta;
  prompt: string;
  result: string;
  createdAt: string;
}

export default function AiStudioPage() {
  const setAiOpen = useUiStore((s) => s.setAiOpen);
  const [activeTool, setActiveTool] = React.useState("subject");
  const [subjectInput, setSubjectInput] = React.useState("");
  const [generating, setGenerating] = React.useState(false);
  const [subjects, setSubjects] = React.useState<string[]>([]);
  const [copied, setCopied] = React.useState<string | null>(null);
  const [tone, setTone] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<"up" | "down" | null>(null);

  const [history, setHistory] = React.useState<AIHistoryItem[]>([]);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<{ id: string; prompt?: string } | null>(null);

  const [brandVoice, setBrandVoice] = React.useState("");
  const [brandVoiceDraft, setBrandVoiceDraft] = React.useState("");
  const [brandVoiceOpen, setBrandVoiceOpen] = React.useState(false);
  const [voiceSaving, setVoiceSaving] = React.useState(false);

  const loadHistory = React.useCallback(async () => {
    try {
      const res = await api.get<{ history: AIHistoryItem[] }>("/api/v1/ai/history");
      setHistory(res.history ?? []);
    } catch {
      // history is best-effort; keep whatever we have
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;    (async () => {
      try {
        const [histRes, voiceRes] = await Promise.all([
          api.get<{ history: AIHistoryItem[] }>("/api/v1/ai/history"),
          api.get<{ brandVoice: string }>("/api/v1/workspace/brand-voice"),
        ]);
        if (cancelled) return;
        setHistory(histRes.history ?? []);
        setBrandVoice(voiceRes.brandVoice ?? "");
        setBrandVoiceDraft(voiceRes.brandVoice ?? "");
      } catch {
        // best-effort initial load
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openHistory = () => {
    loadHistory();
    setHistoryOpen(true);
  };

  const generate = async () => {
    const topic = subjectInput.trim();
    if (!topic) {
      toast.error("Describe your campaign first");
      return;
    }
    setGenerating(true);
    try {
      const res = await api.post<{ subjects: string[] }>("/api/v1/ai/subject", {
        topic,
        tone: tone ?? "",
        count: 6,
      });
      setSubjects(res.subjects);
      await loadHistory();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not generate subject lines");
    } finally {
      setGenerating(false);
    }
  };

  const copySubject = (subject: string) => {
    setCopied(subject);
    setTimeout(() => setCopied(null), 1500);
  };

  const openBrandVoice = () => {
    setBrandVoiceDraft(brandVoice);
    setBrandVoiceOpen(true);
  };

  const saveBrandVoice = async () => {
    setVoiceSaving(true);
    try {
      const res = await api.put<{ brandVoice: string }>("/api/v1/workspace/brand-voice", {
        brandVoice: brandVoiceDraft,
      });
      setBrandVoice(res.brandVoice);
      setBrandVoiceOpen(false);
      toast.success("Brand voice saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save brand voice");
    } finally {
      setVoiceSaving(false);
    }
  };

  const deleteHistory = async (id: string) => {
    setDeletingId(id);
    setDeleteTarget(null);
    try {
      await api.delete(`/api/v1/ai/history/${id}`);
      setHistory((prev) => prev.filter((h) => h.id !== id));
      toast.success("Generation removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete generation");
    } finally {
      setDeletingId(null);
    }
  };

  const recent = history.slice(0, 3);

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
                    {generating ? <Loader2 className="animate-spin" /> : <Sparkles />}
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
            </div>
          </div>
        </TabsContent>

        <TabsContent value="copy" className="mt-0">
          <CopywriterTool
            brandVoice={brandVoice}
            onOpenBrandVoice={openBrandVoice}
            onGenerated={loadHistory}
          />
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
              <Button variant="ghost" size="sm" onClick={openHistory}>
                View history
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="p-0">
            {recent.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-6 py-12">
                <Sparkles className="text-muted-foreground size-6" />
                <p className="text-muted-foreground text-sm">No generations yet — try the subject line generator.</p>
              </div>
            ) : (
              <div className="divide-y">
                {recent.map((gen) => {
                  const meta = kindMeta[gen.kind] ?? kindMeta.campaign;
                  return (
                    <div key={gen.id} className="hover:bg-muted/40 flex items-start gap-3 px-5 py-4 transition-colors">
                      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", meta.bg, meta.color)}>
                        <meta.icon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">{meta.label}</p>
                          <span className="text-muted-foreground shrink-0 text-xs">{timeAgo(gen.createdAt)}</span>
                        </div>
                        <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">“{gen.prompt}”</p>
                        <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">{gen.result}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Generation history</DialogTitle>
            <DialogDescription>Every subject line and campaign generated in your workspace.</DialogDescription>
          </DialogHeader>
          <div className="flex max-h-96 flex-col gap-2 overflow-y-auto">
            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12">
                <Sparkles className="text-muted-foreground size-6" />
                <p className="text-muted-foreground text-sm">No generations yet.</p>
              </div>
            ) : (
              history.map((gen) => {
                const meta = kindMeta[gen.kind] ?? kindMeta.campaign;
                return (
                  <div key={gen.id} className="hover:bg-muted/40 flex items-start gap-3 rounded-lg border p-3 transition-colors">
                    <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg", meta.bg, meta.color)}>
                      <meta.icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{meta.label}</p>
                        <Badge variant="secondary" className="text-[0.65rem]">
                          {timeAgo(gen.createdAt)}
                        </Badge>
                      </div>
                      {gen.prompt && <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">“{gen.prompt}”</p>}
                      <p className="text-muted-foreground mt-1 line-clamp-3 whitespace-pre-wrap text-xs">{gen.result}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setDeleteTarget({ id: gen.id, prompt: gen.prompt })}
                      disabled={deletingId === gen.id}
                      aria-label="Delete generation"
                    >
                      {deletingId === gen.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
                    </Button>
                  </div>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setHistoryOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={brandVoiceOpen} onOpenChange={setBrandVoiceOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Brand voice</DialogTitle>
            <DialogDescription>
              Describe how Mailgeko should write for you. Every generated subject and campaign will follow this voice.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Textarea
              value={brandVoiceDraft}
              onChange={(e) => setBrandVoiceDraft(e.target.value)}
              placeholder="e.g. Friendly and direct, like a helpful teammate. Short sentences, zero hype, plain words. We say 'you' not 'one'."
              className="min-h-32"
            />
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Friendly expert", text: "Warm and knowledgeable, like a helpful teammate. Short sentences, no hype." },
                { label: "Bold & punchy", text: "Confident, punchy, action-oriented. Short sentences, strong verbs, no filler." },
                { label: "Minimalist", text: "Clean and minimal. Very few adjectives, no exclamation marks, calm and precise." },
              ].map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => setBrandVoiceDraft(preset.text)}
                  className="border-border text-muted-foreground hover:border-primary hover:text-primary rounded-full border px-3 py-1 text-xs font-medium transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBrandVoiceOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveBrandVoice} disabled={voiceSaving}>
              {voiceSaving && <Loader2 className="animate-spin" />}
              Save brand voice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this generation?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.prompt
                ? `“${deleteTarget.prompt}”`
                : "This generation"}{" "}
              and its result will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingId !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              disabled={deletingId !== null}
              onClick={() => deleteTarget && deleteHistory(deleteTarget.id)}
            >
              <Trash2 /> Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CopywriterTool({
  brandVoice,
  onOpenBrandVoice,
  onGenerated,
}: {
  brandVoice: string;
  onOpenBrandVoice: () => void;
  onGenerated: () => void;
}) {
  const [input, setInput] = React.useState("");
  const [output, setOutput] = React.useState("");
  const [generating, setGenerating] = React.useState(false);

  const generate = async () => {
    const text = input.trim();
    if (!text) return;
    setGenerating(true);
    setOutput("");
    try {
      const isDraft = text.length > 140 || /\n/.test(text);
      const res = await api.post<{ subject: string; body: string }>("/api/v1/ai/campaign", {
        prompt: isDraft ? "" : text,
        draft: isDraft ? text : "",
        brandVoice,
      });
      setOutput(`Subject: ${res.subject}\n\n${res.body}`);
      onGenerated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not generate campaign");
    } finally {
      setGenerating(false);
    }
  };

  const applyToCampaign = () => {
    const subject = output.match(/^Subject:\s*(.+)$/m)?.[1]?.trim() ?? "";
    const body = output.replace(/^Subject:.*\n?/, "").trim();
    try {
      const draft = JSON.parse(localStorage.getItem("mailgeko_campaign_draft") ?? "{}");
      draft.subject = subject;
      draft.htmlContent = body;
      localStorage.setItem("mailgeko_campaign_draft", JSON.stringify(draft));
    } catch {
      // ignore storage issues
    }
    toast.success("Draft saved — open a campaign to apply it");
  };

  const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

  const lengthDelta = React.useMemo(() => {
    if (!output) return null;
    const body = output.replace(/^Subject:.*\n?/, "").trim();
    const before = wordCount(input);
    const after = wordCount(body);
    if (!before) return null;
    const pct = Math.round(((after - before) / before) * 100);
    if (pct === 0) return "similar length";
    return `${pct > 0 ? "+" : ""}${pct}% words`;
  }, [input, output]);

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
            <Button variant="outline" size="sm" onClick={onOpenBrandVoice}>
              {brandVoice ? <Check className="text-success" /> : <Wand2 />}
              {brandVoice ? "Brand voice set" : "Choose brand voice"}
            </Button>
            <Button size="sm" className="ml-auto" onClick={generate} disabled={generating || !input.trim()}>
              {generating ? <Loader2 className="animate-spin" /> : <Wand2 />}
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
                  {brandVoice ? "Voice: your brand voice" : "Voice: friendly"}
                  {lengthDelta ? ` · Length: ${lengthDelta}` : ""}
                </span>
                <Button size="sm" onClick={applyToCampaign}>
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
