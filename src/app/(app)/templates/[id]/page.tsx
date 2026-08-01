"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ChevronLeft,
  Save,
  Send,
  Monitor,
  Tablet,
  Smartphone,
  Plus,
  Code2,
  Eye,
  Variable,
  Check,
  Loader2,
  Undo2,
  Redo2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { Template } from "@/lib/types";

const fallbackMjml = `<mjml>
  <mj-body background-color="#f4f4f5">
    <mj-section background-color="#ffffff" padding="40px 32px" border-radius="12px">
      <mj-column>
        <mj-image src="https://mailgeko.dev/logo.png" width="120px" />
        <mj-divider border-color="#e4e4e7" />
        <mj-text font-size="28px" font-weight="700" color="#18181b">
          Hi {{first_name}}, welcome!
        </mj-text>
        <mj-text font-size="16px" line-height="1.6" color="#52525b">
          Start with a great subject line and a clear call to action.
        </mj-text>
        <mj-button href="{{cta_url}}" background-color="#059669" color="#ffffff" border-radius="8px" padding="14px 28px">
          Get started →
        </mj-button>
        <mj-spacer height="24px" />
        <mj-text font-size="12px" color="#a1a1aa" align="center">
          You're receiving this because you subscribed to {{company}}.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

const builtInVariables = [
  { name: "{{first_name}}", label: "First name" },
  { name: "{{last_name}}", label: "Last name" },
  { name: "{{company}}", label: "Company" },
  { name: "{{email}}", label: "Email address" },
  { name: "{{cta_url}}", label: "CTA link" },
  { name: "{{unsubscribe_url}}", label: "Unsubscribe link" },
];

export default function TemplateEditorPage() {
  const params = useParams<{ id: string }>();
  const [template, setTemplate] = React.useState<Template | null>(null);
  const [loading, setLoading] = React.useState(true);

  const [name, setName] = React.useState("");
  const [mode, setMode] = React.useState<"code" | "html">("code");
  const [previewDevice, setPreviewDevice] = React.useState<"desktop" | "tablet" | "mobile">("desktop");
  const [testOpen, setTestOpen] = React.useState(false);
  const [testEmails, setTestEmails] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [code, setCode] = React.useState(fallbackMjml);
  const [history, setHistory] = React.useState<string[]>([fallbackMjml]);
  const [historyIndex, setHistoryIndex] = React.useState(0);
  const [variablesOpen, setVariablesOpen] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ template: Template }>(`/api/v1/templates/${params.id}`);
        if (cancelled) return;
        setTemplate(res.template);
        setName(res.template.name);
        const initial = res.template.mjml || fallbackMjml;
        setCode(initial);
        setHistory([initial]);
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "Could not load template");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const onCodeChange = (next: string) => {
    const trimmed = history.slice(0, historyIndex + 1);
    setHistory([...trimmed, next]);
    setHistoryIndex(trimmed.length);
    setCode(next);
  };

  const undo = () => {
    if (historyIndex <= 0) return;
    setHistoryIndex((i) => i - 1);
    setCode(history[historyIndex - 1]);
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    setHistoryIndex((i) => i + 1);
    setCode(history[historyIndex + 1]);
  };
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const insertVariable = (variable: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    setCode((prev) => prev.slice(0, start) + variable + prev.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + variable.length, start + variable.length);
    });
  };

  const handleSave = async () => {
    if (!template) return;
    setSaving(true);
    try {
      await api.patch(`/api/v1/templates/${template.id}`, {
        name,
        description: template.description,
        category: template.category,
        thumbnail: template.thumbnail,
        mjml: code,
        html: code,
        variables: template.variables,
        tags: template.tags,
        isFavorite: template.isFavorite,
      });
      setSaved(true);
      toast.success("Template saved");
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save template");
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (!template) return;
    const emails = testEmails
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
    if (emails.length === 0) return;
    setSending(true);
    try {
      await api.post(`/api/v1/templates/${template.id}/send-test`, {
        emails,
        subject: `${template.name} — test`,
      });
      setTestOpen(false);
      toast.success(`Test sent to ${emails.length} recipient${emails.length > 1 ? "s" : ""}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send test email");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-24">
        <Loader2 className="animate-spin text-muted-foreground size-6" />
        <p className="text-muted-foreground text-sm">Loading template…</p>
      </div>
    );
  }

  if (!template) return null;

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href="/templates" aria-label="Back to templates">
            <ChevronLeft />
          </Link>
        </Button>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-8 w-64 border-transparent bg-transparent font-medium shadow-none hover:border-border focus:border-input"
        />
        <Badge variant="secondary" className="hidden sm:inline-flex">
          {template.category}
        </Badge>
        <div className="ml-auto flex items-center gap-2">
          <Tabs value={mode} onValueChange={(v) => setMode(v as "code" | "html")}>
            <TabsList className="h-8">
              <TabsTrigger value="code" className="gap-1.5">
                <Code2 className="size-3.5" /> MJML
              </TabsTrigger>
              <TabsTrigger value="html" className="gap-1.5">
                <Eye className="size-3.5" /> HTML
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Separator orientation="vertical" className="h-6" />
          <Button variant="outline" size="sm" onClick={() => setTestOpen(true)}>
            <Send /> Test send
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saved ? <Check /> : <Save />}
            {saved ? "Saved" : "Save"}
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_auto]">
        <div className="flex min-w-0 flex-col border-r">
          <div className="bg-muted/40 flex items-center justify-between border-b px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground flex items-center gap-1.5 font-mono text-xs">
                <Code2 className="size-3.5" /> template.{mode === "html" ? "html" : "mjml"}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon-sm" aria-label="Undo" onClick={undo} disabled={historyIndex === 0}>
                <Undo2 />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Redo" onClick={redo} disabled={historyIndex >= history.length - 1}>
                <Redo2 />
              </Button>
            </div>
          </div>
          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
            spellCheck={false}
            className="bg-card font-mono scrollbar-thin min-h-0 flex-1 resize-none p-4 text-[0.8rem] leading-relaxed whitespace-pre outline-none"
          />
        </div>

        <div className="flex min-h-0 w-full flex-col lg:w-[52rem]">
          <div className="flex items-center justify-between border-b px-4 py-2">
            <span className="text-muted-foreground text-xs font-medium">Preview</span>
            <div className="flex items-center gap-1">
              {[
                { value: "desktop" as const, icon: Monitor, label: "Desktop" },
                { value: "tablet" as const, icon: Tablet, label: "Tablet" },
                { value: "mobile" as const, icon: Smartphone, label: "Mobile" },
              ].map((device) => (
                <Button
                  key={device.value}
                  variant={previewDevice === device.value ? "secondary" : "ghost"}
                  size="icon-sm"
                  onClick={() => setPreviewDevice(device.value)}
                  aria-label={device.label}
                >
                  <device.icon />
                </Button>
              ))}
            </div>
          </div>

          <ScrollArea className="bg-muted/50 min-h-0 flex-1">
            <div className="flex justify-center px-4 py-6">
              <div
                className={cn(
                  "bg-background w-full overflow-hidden rounded-lg border shadow-sm transition-all",
                  previewDevice === "desktop" && "max-w-[640px]",
                  previewDevice === "tablet" && "max-w-[420px]",
                  previewDevice === "mobile" && "max-w-[320px]"
                )}
              >
                <div className="flex items-center justify-between border-b px-4 py-2.5">
                  <div className="flex gap-1.5">
                    <span className="bg-destructive/70 size-2.5 rounded-full" />
                    <span className="bg-warning/70 size-2.5 rounded-full" />
                    <span className="bg-success/70 size-2.5 rounded-full" />
                  </div>
                  <span className="text-muted-foreground text-[0.65rem] font-medium">
                    mailgeko.dev — Inbox
                  </span>
                  <span className="w-8" />
                </div>
                <div className="border-b px-4 py-3">
                  <p className="text-sm font-semibold">Hi {"{{first_name}}"}, {template.name}</p>
                  <p className="text-muted-foreground text-xs">Mailgeko Team · 10:00 AM</p>
                  <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                    We&apos;re thrilled to have you on board. Here are three things you can do to get the most…
                  </p>
                </div>
                <div className="bg-[#f4f4f5] p-4">
                  <div className="bg-background mx-auto overflow-hidden rounded-xl shadow-sm" style={{ maxWidth: 480 }}>
                    <div className="p-6">
                      <div className="bg-primary/10 text-primary mx-auto flex size-14 items-center justify-center rounded-xl">
                        <span className="text-xl">🦎</span>
                      </div>
                      <h1 className="mt-4 text-center text-xl font-bold">
                        Hi {"{{first_name}}"}, {template.name}
                      </h1>
                      <p className="text-muted-foreground mt-2 text-center text-sm leading-relaxed">
                        We&apos;re thrilled to have you on board. Here are three
                        things you can do to get the most out of your first week.
                      </p>
                      <div className="mt-5 rounded-lg border bg-muted/40 p-4 text-xs text-muted-foreground">
                        ✓ Verify your sending domain
                        <br />✓ Import your first contacts
                        <br />✓ Launch a welcome automation
                      </div>
                      <div className="mt-5 flex justify-center">
                        <span className="bg-primary rounded-lg px-6 py-3 text-sm font-medium text-primary-foreground">
                          Get started →
                        </span>
                      </div>
                    </div>
                    <div className="border-t bg-muted/40 px-6 py-3 text-center text-[0.65rem] text-muted-foreground">
                      © Mailgeko · Unsubscribe
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>

        <aside
          className={cn(
            "border-l bg-card",
            variablesOpen ? "flex w-full max-w-[240px] flex-col" : "hidden lg:block"
          )}
        >
          {variablesOpen && (
            <>
              <div className="flex items-center justify-between border-b px-4 py-2.5">
                <span className="flex items-center gap-1.5 text-xs font-medium">
                  <Variable className="text-primary size-3.5" /> Variables
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setVariablesOpen(false)}
                  aria-label="Close variables panel"
                  className="h-6 w-6"
                >
                  <ChevronLeft className="size-3.5" />
                </Button>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-3">
                  <p className="text-muted-foreground px-1 pb-2 text-[0.65rem] font-medium uppercase">
                    Insert at cursor
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {builtInVariables.map((variable) => (
                      <button
                        key={variable.name}
                        onClick={() => insertVariable(variable.name)}
                        className="hover:bg-accent group flex cursor-pointer items-center justify-between rounded-md border px-2.5 py-1.5 text-left transition-colors"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-mono text-xs text-primary">
                            {variable.name}
                          </span>
                          <span className="text-muted-foreground block text-[0.65rem]">
                            {variable.label}
                          </span>
                        </span>
                        <Plus className="text-muted-foreground group-hover:text-foreground size-3.5 shrink-0" />
                      </button>
                    ))}
                  </div>
                  <div className="mt-4">
                    <p className="text-muted-foreground px-1 pb-2 text-[0.65rem] font-medium uppercase">
                      Custom
                    </p>
                    <Button variant="outline" size="sm" className="w-full" onClick={() => insertVariable("{{custom_value}}")}>
                      <Plus /> Add variable
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </aside>
      </div>

      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send a test email</DialogTitle>
            <DialogDescription>
              Preview the template with your variables filled in.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="test-emails">Recipients</Label>
              <Input
                id="test-emails"
                value={testEmails}
                onChange={(e) => setTestEmails(e.target.value)}
                placeholder="you@company.com, colleague@company.com"
              />
              <p className="text-muted-foreground text-xs">
                Separate multiple addresses with commas.
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg border px-4 py-3">
              <p className="text-muted-foreground text-xs">
                Variables preview:{" "}
                <span className="font-mono text-primary">first_name = Sarah</span>,{" "}
                <span className="font-mono text-primary">company = Acme Corp</span>
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendTest} disabled={sending || !testEmails.includes("@")}>
              {sending && <Loader2 className="animate-spin" />}
              Send test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
