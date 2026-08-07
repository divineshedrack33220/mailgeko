"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Users,
  FileText,
  CalendarClock,
  Rocket,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
  ListFilter,
  Info,
  Clock,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { api } from "@/lib/api";
import type { Campaign, ContactList, Segment, Template } from "@/lib/types";

const steps = [
  { id: 1, label: "Recipients", icon: Users },
  { id: 2, label: "Content", icon: FileText },
  { id: 3, label: "Schedule", icon: CalendarClock },
  { id: 4, label: "Review", icon: Rocket },
];

export default function NewCampaignPage() {
  const router = useRouter();
  const [step, setStep] = React.useState(1);
  const [sending, setSending] = React.useState(false);

  const [lists, setLists] = React.useState<ContactList[]>([]);
  const [segments, setSegments] = React.useState<Segment[]>([]);
  const [templates, setTemplates] = React.useState<Template[]>([]);

  const [selectedLists, setSelectedLists] = React.useState<string[]>([]);
  const [segment, setSegment] = React.useState("none");

  const [template, setTemplate] = React.useState<string>("");
  const [subject, setSubject] = React.useState("");
  const [previewText, setPreviewText] = React.useState("");
  const [fromName, setFromName] = React.useState("Mailgeko");
  const [fromEmail, setFromEmail] = React.useState("mailgeko@clawmark.online");
  const [replyTo, setReplyTo] = React.useState("");

  const [scheduleMode, setScheduleMode] = React.useState<"now" | "later">("now");
  const [scheduleDate, setScheduleDate] = React.useState("");
  const [scheduleTime, setScheduleTime] = React.useState("10:00");

  const [trackOpens, setTrackOpens] = React.useState(true);
  const [trackClicks, setTrackClicks] = React.useState(true);
  const [allowUnsubscribe, setAllowUnsubscribe] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [listsRes, segmentsRes, templatesRes, workspaceRes] = await Promise.all([
          api.get<{ lists: ContactList[] }>("/api/v1/lists"),
          api.get<{ segments: Segment[] }>("/api/v1/segments"),
          api.get<{ templates: Template[] }>("/api/v1/templates"),
          api.get<{ workspace?: { fromName?: string; fromEmail?: string; replyTo?: string } }>("/api/v1/workspace"),
        ]);
        if (cancelled) return;
        setLists(listsRes.lists ?? []);
        setSegments(segmentsRes.segments ?? []);
        setTemplates(templatesRes.templates ?? []);
        const ws = workspaceRes.workspace;
        if (ws) {
          if (ws.fromName) setFromName(ws.fromName);
          if (ws.fromEmail) setFromEmail(ws.fromEmail);
          if (ws.replyTo) setReplyTo(ws.replyTo);
        }
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : "Could not load campaign data");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const recipients = selectedLists.reduce(
    (sum, id) => sum + (lists.find((l) => l.id === id)?.contactCount ?? 0),
    0
  );

  const segmentCount =
    segment !== "none"
      ? segments.find((s) => s.id === segment)?.contactCount ?? 0
      : 0;

  const finalRecipients = segment !== "none" ? Math.min(recipients, segmentCount) : recipients;

  const canContinue = React.useMemo(() => {
    if (step === 1) return selectedLists.length > 0;
    if (step === 2) return subject.trim().length > 0 && fromName.trim().length > 0 && fromEmail.includes("@");
    if (step === 3) {
      if (scheduleMode === "later") return scheduleDate.length > 0;
      return true;
    }
    return true;
  }, [step, selectedLists.length, subject, fromName, fromEmail, scheduleMode, scheduleDate]);

  const finish = async () => {
    setSending(true);
    let scheduleAt: string | undefined;
    if (scheduleMode === "later" && scheduleDate) {
      scheduleAt = new Date(`${scheduleDate}T${scheduleTime || "10:00"}`).toISOString();
    }
    try {
      const res = await api.post<{ campaign: Campaign }>("/api/v1/campaigns", {
        name: subject || "Untitled campaign",
        subject,
        templateId: template,
        previewText,
        plainText: "",
        htmlContent: "",
        status: "draft",
        type: "regular",
        listIds: selectedLists,
        segmentIds: segment !== "none" ? [segment] : [],
        scheduleAt,
        sender: { fromName, fromEmail, replyTo },
        settings: { trackOpens, trackClicks, allowUnsubscribe },
      });
      if (scheduleMode === "now") {
        await api.post(`/api/v1/campaigns/${res.campaign.id}/send`);
      }
      toast.success(scheduleMode === "now" ? "Campaign queued for delivery" : "Campaign scheduled");
      router.push(`/campaigns/${res.campaign.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create campaign");
      setSending(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <Link
          href="/campaigns"
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm transition-colors"
        >
          <ChevronLeft className="size-4" /> Back to campaigns
        </Link>
        <h2 className="text-2xl font-semibold tracking-tight">Create a campaign</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Set up a new email send in four quick steps.
        </p>
      </div>

      <Stepper current={step} steps={steps} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (step < 4) setStep((s) => s + 1);
          else finish();
        }}
        className="flex flex-col gap-6"
      >
        {step === 1 && (
          <RecipientsStep
            lists={lists}
            segments={segments}
            selectedLists={selectedLists}
            onToggleList={(id) =>
              setSelectedLists((prev) =>
                prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id]
              )
            }
            segment={segment}
            onSegmentChange={setSegment}
            recipientCount={finalRecipients}
          />
        )}

        {step === 2 && (
          <ContentStep
            templates={templates}
            template={template}
            onTemplateChange={setTemplate}
            subject={subject}
            onSubjectChange={setSubject}
            previewText={previewText}
            onPreviewTextChange={setPreviewText}
            fromName={fromName}
            onFromNameChange={setFromName}
            fromEmail={fromEmail}
            onFromEmailChange={setFromEmail}
            replyTo={replyTo}
            onReplyToChange={setReplyTo}
          />
        )}

        {step === 3 && (
          <ScheduleStep
            mode={scheduleMode}
            onModeChange={setScheduleMode}
            scheduleDate={scheduleDate}
            onScheduleDateChange={setScheduleDate}
            scheduleTime={scheduleTime}
            onScheduleTimeChange={setScheduleTime}
          />
        )}

        {step === 4 && (
          <ReviewStep
            campaignName={subject}
            recipientCount={finalRecipients}
            fromName={fromName}
            fromEmail={fromEmail}
            scheduleMode={scheduleMode}
            scheduleDate={scheduleDate}
            scheduleTime={scheduleTime}
            trackOpens={trackOpens}
            trackClicks={trackClicks}
            allowUnsubscribe={allowUnsubscribe}
            onTrackOpensChange={setTrackOpens}
            onTrackClicksChange={setTrackClicks}
            onAllowUnsubscribeChange={setAllowUnsubscribe}
            templateName={templates.find((t) => t.id === template)?.name}
          />
        )}

        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => (step === 1 ? router.push("/campaigns") : setStep((s) => s - 1))}
            disabled={sending}
          >
            <ChevronLeft /> {step === 1 ? "Cancel" : "Back"}
          </Button>
          <div className="flex items-center gap-2">
            {step < 4 && (
              <Button variant="outline" type="button" onClick={() => setStep(4)}>
                Skip to review
              </Button>
            )}
            <Button type="submit" disabled={!canContinue || sending}>
              {sending && <Loader2 className="animate-spin" />}
              {step < 4 ? (
                <>
                  Continue <ChevronRight />
                </>
              ) : scheduleMode === "now" ? (
                <>
                  <Rocket /> Send campaign
                </>
              ) : (
                <>
                  <CalendarClock /> Confirm schedule
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Stepper({
  current,
  steps,
}: {
  current: number;
  steps: { id: number; label: string; icon: React.ComponentType<{ className?: string }> }[];
}) {
  return (
    <ol className="flex items-center">
      {steps.map((s, index) => {
        const done = current > s.id;
        const active = current === s.id;
        return (
          <React.Fragment key={s.id}>
            {index > 0 && (
              <li
                className={cn(
                  "mx-2 h-px flex-1 rounded-full",
                  done || active ? "bg-primary" : "bg-border"
                )}
              />
            )}
            <li className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-full border text-sm transition-colors",
                  done
                    ? "bg-primary border-primary text-primary-foreground"
                    : active
                      ? "border-primary text-primary ring-ring/20 ring-4"
                      : "text-muted-foreground border-border"
                )}
              >
                {done ? <Check className="size-4" /> : <s.icon className="size-4" />}
              </span>
              <span
                className={cn(
                  "hidden text-sm font-medium sm:block",
                  active ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {s.label}
              </span>
            </li>
          </React.Fragment>
        );
      })}
    </ol>
  );
}

function StepHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-muted-foreground mt-0.5 text-sm">{description}</p>
    </div>
  );
}

function RecipientsStep({
  lists,
  segments,
  selectedLists,
  onToggleList,
  segment,
  onSegmentChange,
  recipientCount,
}: {
  lists: ContactList[];
  segments: Segment[];
  selectedLists: string[];
  onToggleList: (id: string) => void;
  segment: string;
  onSegmentChange: (value: string) => void;
  recipientCount: number;
}) {
  return (
    <div className="flex flex-col gap-6">
      <StepHeading
        title="Who are you sending to?"
        description="Pick one or more lists, then optionally narrow by segment."
      />
      <Card className="gap-4 py-5">
        <div className="flex items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <ListFilter className="text-primary size-4" />
            <span className="text-sm font-medium">Audience lists</span>
          </div>
          <Badge variant="secondary" className="text-xs">
            {selectedLists.length} selected
          </Badge>
        </div>
        <div className="divide-y">
          {lists.map((list) => {
            const checked = selectedLists.includes(list.id);
            return (
              <label
                key={list.id}
                className={cn(
                  "hover:bg-muted/50 flex cursor-pointer items-center justify-between px-6 py-3 transition-colors",
                  checked && "bg-muted/30"
                )}
              >
                <div className="flex items-center gap-3">
                  <Checkbox checked={checked} onCheckedChange={() => onToggleList(list.id)} />
                  <div>
                    <p className="text-sm font-medium">{list.name}</p>
                    <p className="text-muted-foreground text-xs">{list.description}</p>
                  </div>
                </div>
                <span className="text-muted-foreground text-sm tabular-nums">
                  {formatNumber(list.contactCount)}
                </span>
              </label>
            );
          })}
        </div>
      </Card>

      <Card className="gap-3 py-5">
        <div className="px-6">
          <div className="flex items-center gap-2">
            <Sparkles className="text-primary size-4" />
            <span className="text-sm font-medium">Optional: narrow by segment</span>
          </div>
        </div>
        <div className="px-6">
          <Select value={segment} onValueChange={onSegmentChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">All contacts in selected lists</SelectItem>
              {segments.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} ({formatNumber(s.contactCount ?? 0)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <div className="bg-primary/5 border-primary/15 flex items-center justify-between rounded-xl border px-5 py-4">
        <div>
          <p className="text-sm font-medium">Estimated recipients</p>
          <p className="text-muted-foreground text-xs">
            {segment !== "none" ? "Limited to segment size" : "Sum of selected lists"}
          </p>
        </div>
        <span className="text-primary text-2xl font-semibold tabular-nums">
          {formatNumber(recipientCount)}
        </span>
      </div>
    </div>
  );
}

function ContentStep({
  templates,
  template,
  onTemplateChange,
  subject,
  onSubjectChange,
  previewText,
  onPreviewTextChange,
  fromName,
  onFromNameChange,
  fromEmail,
  onFromEmailChange,
  replyTo,
  onReplyToChange,
}: {
  templates: Template[];
  template: string;
  onTemplateChange: (v: string) => void;
  subject: string;
  onSubjectChange: (v: string) => void;
  previewText: string;
  onPreviewTextChange: (v: string) => void;
  fromName: string;
  onFromNameChange: (v: string) => void;
  fromEmail: string;
  onFromEmailChange: (v: string) => void;
  replyTo: string;
  onReplyToChange: (v: string) => void;
}) {
  const [aiGenerating, setAiGenerating] = React.useState(false);
  const [aiIndex, setAiIndex] = React.useState(0);

  const selectedTemplate = templates.find((t) => t.id === template);
  const aiTopic = subject.trim() || selectedTemplate?.name || "your latest announcement";

  const handleGenerateSubject = async () => {
    if (aiGenerating) return;
    setAiGenerating(true);
    try {
      const res = await api.post<{ subjects: string[] }>("/api/v1/ai/subject", {
        topic: aiTopic,
        count: 3,
      });
      const subjects = (res.subjects ?? []).filter((s) => s.trim());
      if (subjects.length === 0) {
        toast.info("No suggestions were generated — try again");
        return;
      }
      const next = aiIndex % subjects.length;
      setAiIndex(next + 1);
      onSubjectChange(subjects[next]);
      if (subjects.length > 1) {
        toast.success(`Picked suggestion ${next + 1} of ${subjects.length} — click again to cycle`);
      } else {
        toast.success("Subject generated");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not generate subject lines");
    } finally {
      setAiGenerating(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <StepHeading
        title="What's in the email?"
        description="Choose a template and craft your subject line and sender info."
      />

      <Card className="gap-4 py-5">
        <div className="px-6">
          <Label>Email template</Label>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {templates.slice(0, 4).map((t) => (
              <button
                type="button"
                key={t.id}
                onClick={() => onTemplateChange(t.id)}
                className={cn(
                  "hover:border-primary/50 group cursor-pointer rounded-lg border p-3 text-left transition-colors",
                  template === t.id
                    ? "border-primary ring-primary/15 ring-2"
                    : "border-border"
                )}
              >
                <span className="bg-secondary flex h-14 items-center justify-center rounded-md">
                  <FileText className="text-secondary-foreground size-5" />
                </span>
                <span className="mt-2 block truncate text-xs font-medium">{t.name}</span>
                <span className="text-muted-foreground block truncate text-[0.7rem]">
                  {t.category}
                </span>
              </button>
            ))}
          </div>
        </div>

        <Separator />

        <div className="flex flex-col gap-4 px-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="subject">Subject line</Label>
              <button
                type="button"
                onClick={handleGenerateSubject}
                disabled={aiGenerating}
                className="text-primary flex cursor-pointer items-center gap-1 text-xs font-medium hover:underline disabled:cursor-wait disabled:opacity-60"
              >
                {aiGenerating ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                {aiGenerating ? "Generating…" : "Generate with AI"}
              </button>
            </div>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => onSubjectChange(e.target.value)}
              placeholder="e.g. What shipped this month"
            />
            <p className={cn("text-right text-xs tabular-nums", subject.length > 60 ? "text-warning" : "text-muted-foreground")}>
              {subject.length}/90
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="preview">Preview text</Label>
            <Textarea
              id="preview"
              value={previewText}
              onChange={(e) => onPreviewTextChange(e.target.value)}
              placeholder="The snippet shown next to your subject line in the inbox."
              className="min-h-14"
            />
          </div>
        </div>

        <Separator />

        <div className="grid gap-4 px-6 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="from-name">From name</Label>
            <Input id="from-name" value={fromName} onChange={(e) => onFromNameChange(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="from-email">From email</Label>
            <Input id="from-email" type="email" value={fromEmail} onChange={(e) => onFromEmailChange(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="reply-to">
              Reply-to <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="reply-to"
              type="email"
              value={replyTo}
              onChange={(e) => onReplyToChange(e.target.value)}
              placeholder="mailgeko@clawmark.online"
            />
          </div>
        </div>
      </Card>

      <div className="bg-accent/60 flex items-start gap-3 rounded-xl border px-5 py-4">
        <Wand2 className="text-primary mt-0.5 size-4 shrink-0" />
        <p className="text-muted-foreground text-sm leading-relaxed">
          Tip: open rates jump 24% with a subject line under 41 characters.
          Use the <span className="text-foreground font-medium">AI generator</span> to
          get 5 options instantly.
        </p>
      </div>
    </div>
  );
}

function ScheduleStep({
  mode,
  onModeChange,
  scheduleDate,
  onScheduleDateChange,
  scheduleTime,
  onScheduleTimeChange,
}: {
  mode: "now" | "later";
  onModeChange: (v: "now" | "later") => void;
  scheduleDate: string;
  onScheduleDateChange: (v: string) => void;
  scheduleTime: string;
  onScheduleTimeChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <StepHeading
        title="When should it go out?"
        description="Send immediately, or schedule for a specific date and time."
      />

      <RadioGroup
        value={mode}
        onValueChange={(v) => onModeChange(v as "now" | "later")}
        className="grid gap-3"
      >
        {[
          { value: "now", title: "Send now", description: "Queue the campaign for immediate delivery." },
          { value: "later", title: "Schedule for later", description: "Pick a specific date and time." },
        ].map((option) => (
          <label
            key={option.value}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
              mode === option.value
                ? "border-primary bg-primary/5"
                : "hover:bg-muted/50"
            )}
          >
            <RadioGroupItem value={option.value} className="mt-0.5" />
            <div>
              <p className="text-sm font-medium">{option.title}</p>
              <p className="text-muted-foreground text-xs">{option.description}</p>
            </div>
          </label>
        ))}
      </RadioGroup>

      {mode === "later" && (
        <Card className="gap-4 py-5">
          <div className="grid gap-4 px-6 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={scheduleDate}
                onChange={(e) => onScheduleDateChange(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="time">Time</Label>
              <Input
                id="time"
                type="time"
                value={scheduleTime}
                onChange={(e) => onScheduleTimeChange(e.target.value)}
              />
            </div>
          </div>
        </Card>
      )}

      {mode === "now" && (
        <div className="bg-muted/50 flex items-center gap-3 rounded-xl border px-5 py-4">
          <Clock className="text-muted-foreground size-4" />
          <p className="text-muted-foreground text-sm">
            The campaign will enter the send queue immediately and typically
            complete within minutes.
          </p>
        </div>
      )}
    </div>
  );
}

function ReviewStep({
  campaignName,
  recipientCount,
  fromName,
  fromEmail,
  scheduleMode,
  scheduleDate,
  scheduleTime,
  trackOpens,
  trackClicks,
  allowUnsubscribe,
  onTrackOpensChange,
  onTrackClicksChange,
  onAllowUnsubscribeChange,
  templateName,
}: {
  campaignName: string;
  recipientCount: number;
  fromName: string;
  fromEmail: string;
  scheduleMode: string;
  scheduleDate: string;
  scheduleTime: string;
  trackOpens: boolean;
  trackClicks: boolean;
  allowUnsubscribe: boolean;
  onTrackOpensChange: (v: boolean) => void;
  onTrackClicksChange: (v: boolean) => void;
  onAllowUnsubscribeChange: (v: boolean) => void;
  templateName?: string;
}) {
  const scheduleLabel =
    scheduleMode === "now"
      ? "Send immediately"
      : `${scheduleDate || "—"} at ${scheduleTime}`;

  return (
    <div className="flex flex-col gap-6">
      <StepHeading title="Review and launch" description="Double-check everything before this goes out." />

      <Card className="gap-0 overflow-hidden py-0">
        <div className="border-b px-6 py-4">
          <p className="text-sm font-semibold">{campaignName || "Untitled campaign"}</p>
          {templateName && (
            <p className="text-muted-foreground text-xs">Template: {templateName}</p>
          )}
        </div>
        <dl className="divide-y">
          {[
            { label: "Recipients", value: `${formatNumber(recipientCount)} contacts` },
            { label: "From", value: `${fromName} <${fromEmail}>` },
            { label: "Schedule", value: scheduleLabel },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between px-6 py-3">
              <dt className="text-muted-foreground text-sm">{row.label}</dt>
              <dd className="text-sm font-medium">{row.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card className="gap-3 py-5">
        <div className="flex items-center gap-2 px-6">
          <Info className="text-primary size-4" />
          <span className="text-sm font-medium">Tracking & preferences</span>
        </div>
        <div className="divide-y px-6">
          {[
            { label: "Track opens", desc: "Count how many recipients open your email.", value: trackOpens, onChange: onTrackOpensChange },
            { label: "Track clicks", desc: "Track which links get clicked.", value: trackClicks, onChange: onTrackClicksChange },
            { label: "Allow unsubscribe", desc: "Include a one-click unsubscribe link (recommended).", value: allowUnsubscribe, onChange: onAllowUnsubscribeChange },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium">{row.label}</p>
                <p className="text-muted-foreground text-xs">{row.desc}</p>
              </div>
              <Switch checked={row.value} onCheckedChange={row.onChange} />
            </div>
          ))}
        </div>
      </Card>

      <div className="bg-muted/50 flex items-start gap-3 rounded-xl border px-5 py-4">
        <Info className="text-muted-foreground mt-0.5 size-4 shrink-0" />
        <div className="text-sm leading-relaxed">
          <p className="font-medium">Before you send</p>
          <p className="text-muted-foreground text-xs">
            Mailgeko doesn&apos;t verify senders automatically. Use a From address
            on a domain you control, and confirm it&apos;s set up to receive replies.
          </p>
        </div>
      </div>
    </div>
  );
}
