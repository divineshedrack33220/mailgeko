"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/page-header";
import { api } from "@/lib/api";
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
  const [saving, setSaving] = React.useState(false);

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
        description="Start with a name and a category — you'll be editing MJML next."
        icon={FileText}
      />
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
