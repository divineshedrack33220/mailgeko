"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, FileText, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/shared/page-header";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { canManage } from "@/lib/permissions";
import type { Template, TemplateCategory } from "@/lib/types";

const initialMjml = `<mjml>
  <mj-body background-color="#f4f4f5">
    <mj-section background-color="#ffffff" padding="40px 32px" border-radius="12px">
      <mj-column>
        <mj-text font-size="24px" font-weight="700" color="#18181b">
          Hello {{first_name}}!
        </mj-text>
        <mj-text font-size="16px" line-height="1.6" color="#52525b">
          Write your email copy here.
        </mj-text>
        <mj-button href="{{cta_url}}" background-color="#3bb974" color="#ffffff" border-radius="8px">
          Call to action →
        </mj-button>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

const categories: TemplateCategory[] = [
  "Newsletter",
  "Promotional",
  "Transactional",
  "Welcome",
  "Abandoned Cart",
  "Re-engagement",
  "Announcement",
];

export default function NewTemplatePage() {
  const router = useRouter();
  const role = useAuthStore((s) => s.role);

  React.useEffect(() => {
    if (role && !canManage(role)) router.replace("/dashboard");
  }, [role, router]);

  if (role && !canManage(role)) return null;

  const [saving, setSaving] = React.useState(false);
  const [aiPrompt, setAiPrompt] = React.useState("");
  const [aiCategory, setAiCategory] = React.useState<TemplateCategory>("Newsletter");
  const [aiGenerating, setAiGenerating] = React.useState(false);

  const generateWithAi = async () => {
    if (!aiPrompt.trim()) {
      toast.error("Describe the template you want first");
      return;
    }
    setAiGenerating(true);
    try {
      const gen = await api.post<{
        mjml: string;
        html: string;
        name: string;
        category: string;
        subject: string;
        variables: string[];
      }>("/api/v1/templates/generate", { prompt: aiPrompt, brandVoice: "" });
      const res = await api.post<{ template: Template }>("/api/v1/templates", {
        name: gen.name,
        description: gen.subject,
        category: aiCategory,
        thumbnail: "newsletter",
        mjml: gen.mjml,
        html: gen.html,
        variables: gen.variables,
        tags: [],
        isFavorite: false,
      });
      toast.success("Template generated");
      router.push(`/templates/${res.template.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not generate template");
      setAiGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    if (!name) {
      toast.error("Enter a template name");
      return;
    }
    setSaving(true);
    try {
      const res = await api.post<{ template: Template }>("/api/v1/templates", {
        name,
        description: String(data.get("description") ?? "").trim(),
        category: String(data.get("category") ?? "Newsletter"),
        thumbnail: "newsletter",
        mjml: initialMjml,
        html: initialMjml,
        variables: ["first_name", "company", "cta_url", "unsubscribe_url"],
        tags: [],
        isFavorite: false,
      });
      toast.success("Template created");
      router.push(`/templates/${res.template.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create template");
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/templates"
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm transition-colors"
        >
          <ChevronLeft className="size-4" /> Back to templates
        </Link>
      </div>
      <PageHeader
        title="New template"
        description="Describe what you want and let AI write it, or start with a name and a category — you'll be editing MJML next."
        icon={FileText}
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="text-primary size-4" /> Generate with AI
          </CardTitle>
          <CardDescription>
            Describe the email you want — audience, offer, and tone. We&apos;ll build a ready-to-edit MJML template and
            open it in the editor. Uses your saved brand voice when set.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ai-prompt">What should this template say?</Label>
              <Textarea
                id="ai-prompt"
                placeholder="e.g. A welcome email for new SaaS signups — introduce the product, link to a getting-started guide, and end with a 'Book a demo' button."
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                className="min-h-28"
              />
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex w-56 flex-col gap-2">
                <Label htmlFor="ai-category">Category</Label>
                <select
                  id="ai-category"
                  value={aiCategory}
                  onChange={(e) => setAiCategory(e.target.value as TemplateCategory)}
                  className="border-input bg-background ring-offset-background focus-visible:ring-ring h-9 rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <Button onClick={generateWithAi} disabled={aiGenerating}>
                {aiGenerating ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {aiGenerating ? "Writing…" : "Generate template"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Template details</CardTitle>
          <CardDescription>You can adjust the content in the MJML editor after creating.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input id="name" name="name" placeholder="e.g. Monthly newsletter" required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="category">Category</Label>
                <select
                  id="category"
                  name="category"
                  defaultValue="Newsletter"
                  className="border-input bg-background ring-offset-background focus-visible:ring-ring h-9 rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" name="description" placeholder="A short note about this template" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" asChild>
                <Link href="/templates">Cancel</Link>
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="animate-spin" />}
                Create template
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
