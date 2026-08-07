"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { xml } from "@codemirror/lang-xml";
import { oneDark } from "@codemirror/theme-one-dark";
import { undo as cmUndo, redo as cmRedo } from "@codemirror/commands";
import {
  X,
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
  Copy,
  AlertCircle,
  Braces,
  LayoutGrid,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  EmailBuilder,
  Device,
} from "@/components/email-builder/EmailBuilder";
import {
  Block,
  DesignSettings,
  defaultSettings,
  blocksToMjml,
  parseMjml,
} from "@/components/email-builder/blocks";

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
        <mj-button href="{{cta_url}}" background-color="#3bb974" color="#ffffff" border-radius="8px" padding="14px 28px">
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

const sampleValues: Record<string, string> = {
  "{{first_name}}": "Sarah",
  "{{last_name}}": "Johnson",
  "{{company}}": "Acme Corp",
  "{{email}}": "sarah@acme.com",
  "{{cta_url}}": "https://example.com/cta",
  "{{unsubscribe_url}}": "https://example.com/unsubscribe",
};

type CompileError = { line?: number; message: string; tagName?: string };

const applySampleValues = (source: string) =>
  Object.entries(sampleValues).reduce((acc, [key, value]) => acc.split(key).join(value), source);

const extractVariables = (source: string) => {
  const names = new Set<string>();
  const re = /{{\s*([a-zA-Z_][a-zA-Z0-9_.-]*)\s*}}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) names.add(match[1]);
  return Array.from(names);
};

const editorTheme = EditorView.theme({
  "&": { fontSize: "0.82rem", height: "100%" },
  ".cm-scroller": {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
    lineHeight: "1.6",
  },
  ".cm-content": { padding: "16px 0" },
  ".cm-gutters": { paddingLeft: "4px" },
});

export default function TemplateEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [template, setTemplate] = React.useState<Template | null>(null);
  const [loading, setLoading] = React.useState(true);

  const [name, setName] = React.useState("");
  const [mode, setMode] = React.useState<"design" | "code" | "html">("design");
  const [previewDevice, setPreviewDevice] = React.useState<"desktop" | "tablet" | "mobile">("desktop");
  const [designBlocks, setDesignBlocks] = React.useState<Block[]>([]);
  const [designSettings, setDesignSettings] = React.useState<DesignSettings>(defaultSettings);
  const [testOpen, setTestOpen] = React.useState(false);
  const [testEmails, setTestEmails] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [code, setCode] = React.useState(fallbackMjml);
  const [compiledHtml, setCompiledHtml] = React.useState("");
  const [compileErrors, setCompileErrors] = React.useState<CompileError[]>([]);
  const [rendering, setRendering] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const [variablesOpen, setVariablesOpen] = React.useState(true);
  const [sampleData, setSampleData] = React.useState(true);

  const editorRef = React.useRef<EditorView | null>(null);
  const loadedRef = React.useRef(false);

  const detectedVariables = React.useMemo(() => extractVariables(code), [code]);
  const availableBuiltIns = builtInVariables.filter(
    (b) => !detectedVariables.includes(b.name.slice(2, -2))
  );

  const renderRaw = React.useCallback(async (source: string) => {
    const res = await fetch("/api/preview/mjml", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mjml: source }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? "Failed to render MJML");
    return { html: data.html ?? "", errors: (data.errors ?? []) as CompileError[] };
  }, []);

  const compile = React.useCallback(
    async (source: string) => {
      setRendering(true);
      try {
        const input = sampleData ? applySampleValues(source) : source;
        const { html, errors } = await renderRaw(input);
        setCompiledHtml(html);
        setCompileErrors(errors);
      } catch (err) {
        setCompiledHtml("");
        setCompileErrors([
          { message: err instanceof Error ? err.message : "Failed to render MJML" },
        ]);
      } finally {
        setRendering(false);
      }
    },
    [renderRaw, sampleData]
  );

  React.useEffect(() => {
    if (!loadedRef.current) return;
    const timer = setTimeout(() => {
      void compile(code);
    }, 400);
    return () => clearTimeout(timer);
  }, [code, compile]);

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
        const parsed = parseMjml(initial);
        if (parsed) {
          setDesignBlocks(parsed.blocks);
          setDesignSettings({ ...defaultSettings, ...parsed.settings });
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "Could not load template");
        }
      } finally {
        if (!cancelled) {
          loadedRef.current = true;
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const handleSave = React.useCallback(async () => {
    if (!template || saving) return;
    setSaving(true);
    try {
      const saveSource = mode === "design" ? blocksToMjml(designBlocks, designSettings) : code;
      const saveVariables = extractVariables(saveSource);
      let html = "";
      try {
        const { html: fresh } = await renderRaw(saveSource);
        html = fresh;
      } catch {
        html = "";
      }
      await api.patch(`/api/v1/templates/${template.id}`, {
        name,
        description: template.description,
        category: template.category,
        thumbnail: template.thumbnail,
        mjml: saveSource,
        html: html || saveSource,
        variables: saveVariables,
        tags: template.tags,
        isFavorite: template.isFavorite,
      });
      setSaved(true);
      setDirty(false);
      toast.success("Template saved");
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save template");
    } finally {
      setSaving(false);
    }
  }, [template, saving, name, mode, designBlocks, designSettings, code, renderRaw]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void handleSave();
      } else if (e.key === "Escape") {
        router.push("/templates");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, handleSave]);

  const onCodeChange = React.useCallback((value: string) => {
    setCode(value);
    setDirty(true);
  }, []);

  const builderVariables = React.useMemo(() => {
    const seen = new Set<string>();
    const vars: { name: string; label: string }[] = [];
    for (const b of builtInVariables) {
      if (!seen.has(b.name)) {
        seen.add(b.name);
        vars.push(b);
      }
    }
    for (const v of detectedVariables) {
      const name = `{{${v}}}`;
      if (!seen.has(name)) {
        seen.add(name);
        vars.push({ name, label: v });
      }
    }
    return vars;
  }, [detectedVariables]);

  const handleModeChange = React.useCallback(
    (next: "design" | "code" | "html") => {
      if (next === "design") {
        const parsed = parseMjml(code);
        if (parsed) {
          setDesignBlocks(parsed.blocks);
          setDesignSettings({ ...defaultSettings, ...parsed.settings });
        }
      }
      setMode(next);
    },
    [code]
  );

  const handleDesignChange = React.useCallback(
    (blocks: Block[], settings: DesignSettings) => {
      setDesignBlocks(blocks);
      setDesignSettings(settings);
      setCode(blocksToMjml(blocks, settings));
      setDirty(true);
    },
    []
  );

  const onCreateEditor = React.useCallback((view: EditorView) => {
    editorRef.current = view;
  }, []);

  const undo = React.useCallback(() => {
    if (editorRef.current) cmUndo(editorRef.current);
  }, []);
  const redo = React.useCallback(() => {
    if (editorRef.current) cmRedo(editorRef.current);
  }, []);

  const insertVariable = React.useCallback((variable: string) => {
    const view = editorRef.current;
    if (view) {
      const { from } = view.state.selection.main;
      view.dispatch({
        changes: { from, insert: variable },
        selection: { anchor: from + variable.length },
        scrollIntoView: true,
      });
      view.focus();
      return;
    }
    setCode((prev) => prev + variable);
    setDirty(true);
  }, []);

  const copyHtml = async () => {
    try {
      await navigator.clipboard.writeText(compiledHtml);
      toast.success("Copied HTML to clipboard");
    } catch {
      toast.error("Could not copy HTML");
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
    <div className="bg-background fixed inset-0 z-[60] flex flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b px-4 py-3">
        <Button variant="ghost" size="icon-sm" asChild aria-label="Close editor">
          <Link href="/templates">
            <X />
          </Link>
        </Button>
        <div className="flex items-center gap-1.5">
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setDirty(true);
            }}
            className="h-8 w-64 border-transparent bg-transparent font-medium shadow-none hover:border-border focus:border-input"
          />
          <span
            title={dirty ? "Unsaved changes" : "All changes saved"}
            className={cn(
              "size-1.5 rounded-full transition-colors",
              dirty ? "bg-primary" : "bg-transparent"
            )}
          />
        </div>
        <Badge variant="secondary" className="hidden sm:inline-flex">
          {template.category}
        </Badge>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setTestOpen(true)}>
            <Send /> Test send
          </Button>
          <Button size="sm" onClick={() => void handleSave()} disabled={saving}>
            {saved ? <Check /> : saving ? <Loader2 className="animate-spin" /> : <Save />}
            {saved ? "Saved" : saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </header>

      <div
        className={cn(
          "min-h-0 flex-1",
          mode === "design"
            ? "grid grid-cols-1"
            : cn(
                "grid grid-cols-1",
                variablesOpen
                  ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,auto)_240px]"
                  : "lg:grid-cols-[minmax(0,1fr)_minmax(0,auto)]"
              )
        )}
      >
        {mode === "design" ? (
          <EmailBuilder
            blocks={designBlocks}
            settings={designSettings}
            onChange={handleDesignChange}
            device={previewDevice}
            onDeviceChange={setPreviewDevice}
            variables={builderVariables}
            mode={mode}
            onModeChange={handleModeChange}
            emptyHint="Start with a banner image or a hero section, then add text and a button."
          />
        ) : (
          <>
        <div className="flex min-w-0 flex-col border-r">
          <div className="bg-muted/40 flex items-center gap-3 border-b px-3 py-2">
            <Tabs value={mode} onValueChange={(v) => handleModeChange(v as "design" | "code" | "html")}>
              <TabsList className="h-8">
                <TabsTrigger value="design" className="gap-1.5">
                  <LayoutGrid className="size-3.5" /> Design
                </TabsTrigger>
                <TabsTrigger value="code" className="gap-1.5">
                  <Code2 className="size-3.5" /> MJML
                </TabsTrigger>
                <TabsTrigger value="html" className="gap-1.5">
                  <Eye className="size-3.5" /> HTML
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <span className="text-muted-foreground hidden font-mono text-xs sm:inline">
              template.{mode === "html" ? "html" : "mjml"}
            </span>
            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Open variables panel"
                onClick={() => setVariablesOpen(true)}
                className={cn(variablesOpen && "hidden")}
              >
                <Variable />
              </Button>
              {mode === "html" && compiledHtml ? (
                <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={copyHtml}>
                  <Copy className="size-3.5" /> Copy
                </Button>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Undo"
                    onClick={undo}
                  >
                    <Undo2 />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Redo"
                    onClick={redo}
                  >
                    <Redo2 />
                  </Button>
                </>
              )}
            </div>
          </div>
          <div className="min-h-0 flex-1">
            {mode === "code" ? (
              <CodeMirror
                value={code}
                height="100%"
                style={{ height: "100%" }}
                theme={isDark ? oneDark : undefined}
                extensions={[xml(), editorTheme]}
                onChange={onCodeChange}
                onCreateEditor={onCreateEditor}
                basicSetup={{
                  foldGutter: true,
                  highlightActiveLine: true,
                  highlightActiveLineGutter: true,
                  bracketMatching: true,
                  closeBrackets: true,
                  autocompletion: false,
                }}
              />
            ) : compiledHtml ? (
              <CodeMirror
                value={compiledHtml}
                height="100%"
                style={{ height: "100%" }}
                editable={false}
                theme={isDark ? oneDark : undefined}
                extensions={[xml(), editorTheme]}
                basicSetup={{ lineNumbers: true, foldGutter: true, autocompletion: false }}
              />
            ) : (
              <div className="bg-muted/40 flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-4 text-center">
                <Eye className="text-muted-foreground size-6" />
                <p className="text-muted-foreground text-sm">
                  {compileErrors.length > 0
                    ? "Fix the MJML errors to see the compiled HTML."
                    : "Compiled HTML will appear here."}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex min-h-0 w-full flex-col lg:w-[46rem]">
          <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs font-medium">Preview</span>
              {rendering && <Loader2 className="text-muted-foreground size-3.5 animate-spin" />}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant={sampleData ? "secondary" : "ghost"}
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => setSampleData((v) => !v)}
                aria-label="Toggle sample data"
              >
                <Braces className="size-3.5" /> Sample data
              </Button>
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

          {compileErrors.length > 0 && (
            <div className="bg-destructive/10 border-destructive/30 flex items-start gap-2 border-b px-4 py-2">
              <AlertCircle className="text-destructive mt-0.5 size-4 shrink-0" />
              <div className="min-w-0">
                <p className="text-destructive text-xs font-medium">MJML validation</p>
                <ul className="text-destructive/80 mt-0.5 space-y-0.5 text-xs">
                  {compileErrors.slice(0, 3).map((err, i) => (
                    <li key={i} className="font-mono">
                      {err.line ? `Line ${err.line}: ` : ""}
                      {err.message}
                    </li>
                  ))}
                  {compileErrors.length > 3 && (
                    <li>…and {compileErrors.length - 3} more</li>
                  )}
                </ul>
              </div>
            </div>
          )}

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
                {compiledHtml ? (
                  <iframe
                    title="Email preview"
                    srcDoc={compiledHtml}
                    sandbox=""
                    className="h-[720px] w-full"
                  />
                ) : (
                  <div className="flex h-[720px] flex-col items-center justify-center gap-2 p-6 text-center">
                    <Loader2 className="text-muted-foreground size-5 animate-spin" />
                    <p className="text-muted-foreground text-xs">Rendering preview…</p>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </div>

        <aside className={cn("border-l bg-card", variablesOpen ? "flex w-60 flex-col" : "hidden")}>
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
                  <X className="size-3.5" />
                </Button>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-3">
                  <p className="text-muted-foreground px-1 pb-2 text-[0.65rem] font-medium uppercase">
                    Insert at cursor
                  </p>
                  {detectedVariables.length > 0 && (
                    <div className="mb-4">
                      <p className="text-muted-foreground px-1 pb-2 text-[0.65rem] font-medium uppercase">
                        Used in template
                      </p>
                      <div className="flex flex-col gap-1.5">
                        {detectedVariables.map((variable) => (
                          <button
                            key={variable}
                            onClick={() => insertVariable(`{{${variable}}}`)}
                            className="hover:bg-accent group flex cursor-pointer items-center justify-between rounded-md border px-2.5 py-1.5 text-left transition-colors"
                          >
                            <span className="text-primary min-w-0 truncate font-mono text-xs">
                              {`{{${variable}}}`}
                            </span>
                            <Plus className="text-muted-foreground group-hover:text-foreground size-3.5 shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {availableBuiltIns.length > 0 && (
                    <div className="mb-4">
                      <p className="text-muted-foreground px-1 pb-2 text-[0.65rem] font-medium uppercase">
                        Available variables
                      </p>
                      <div className="flex flex-col gap-1.5">
                        {availableBuiltIns.map((variable) => (
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
                    </div>
                  )}
                  <div>
                    <p className="text-muted-foreground px-1 pb-2 text-[0.65rem] font-medium uppercase">
                      Custom
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => insertVariable("{{custom_value}}")}
                    >
                      <Plus /> Add variable
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </aside>
          </>
        )}
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
