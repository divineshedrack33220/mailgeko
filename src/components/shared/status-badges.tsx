import type { CampaignStatus, ContactStatus, AutomationStatus, RecipientStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const campaignStatusStyles: Record<CampaignStatus, "success" | "info" | "warning" | "secondary" | "destructive" | "outline"> = {
  active: "success",
  draft: "secondary",
  scheduled: "info",
  sending: "warning",
  sent: "success",
  paused: "outline",
  completed: "success",
  failed: "destructive",
};

const campaignStatusLabels: Record<CampaignStatus, string> = {
  active: "Active",
  draft: "Draft",
  scheduled: "Scheduled",
  sending: "Sending",
  sent: "Sent",
  paused: "Paused",
  completed: "Completed",
  failed: "Failed",
};

export function CampaignStatusBadge({
  status,
  className,
}: {
  status: CampaignStatus;
  className?: string;
}) {
  const live = status === "sending";
  return (
    <Badge variant={campaignStatusStyles[status]} className={cn(className, "gap-1.5")}>
      {live && <span className="bg-warning size-1.5 animate-pulse rounded-full" />}
      {campaignStatusLabels[status]}
    </Badge>
  );
}

const contactStatusStyles: Record<ContactStatus, "success" | "outline" | "destructive" | "warning"> = {
  active: "success",
  unsubscribed: "outline",
  bounced: "destructive",
  spam: "warning",
};

const contactStatusLabels: Record<ContactStatus, string> = {
  active: "Active",
  unsubscribed: "Unsubscribed",
  bounced: "Bounced",
  spam: "Spam",
};

export function ContactStatusBadge({
  status,
  className,
}: {
  status: ContactStatus;
  className?: string;
}) {
  return (
    <Badge variant={contactStatusStyles[status]} className={className}>
      {contactStatusLabels[status]}
    </Badge>
  );
}

const automationStatusStyles: Record<AutomationStatus, "success" | "secondary" | "warning"> = {
  active: "success",
  paused: "warning",
  draft: "secondary",
};

const automationStatusLabels: Record<AutomationStatus, string> = {
  active: "Active",
  paused: "Paused",
  draft: "Draft",
};

export function AutomationStatusBadge({
  status,
  className,
}: {
  status: AutomationStatus;
  className?: string;
}) {
  return (
    <Badge variant={automationStatusStyles[status]} className={className}>
      {automationStatusLabels[status]}
    </Badge>
  );
}

const recipientStatusStyles: Record<RecipientStatus, "success" | "info" | "warning" | "secondary" | "destructive" | "outline"> = {
  queued: "warning",
  sent: "info",
  delivered: "success",
  opened: "success",
  clicked: "success",
  bounced: "destructive",
  complained: "destructive",
  unsubscribed: "secondary",
  failed: "destructive",
  skipped: "outline",
};

const recipientStatusLabels: Record<RecipientStatus, string> = {
  queued: "Queued",
  sent: "Sent",
  delivered: "Delivered",
  opened: "Opened",
  clicked: "Clicked",
  bounced: "Bounced",
  complained: "Complained",
  unsubscribed: "Unsubscribed",
  failed: "Failed",
  skipped: "Skipped",
};

export function RecipientStatusBadge({
  status,
  className,
}: {
  status: RecipientStatus;
  className?: string;
}) {
  return (
    <Badge variant={recipientStatusStyles[status]} className={className}>
      {recipientStatusLabels[status]}
    </Badge>
  );
}
