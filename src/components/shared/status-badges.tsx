import type { CampaignStatus, ContactStatus, AutomationStatus } from "@/lib/types";
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
  const live = status === "active";
  return (
    <Badge variant={automationStatusStyles[status]} className={cn(className, "gap-1.5")}>
      {live && <span className="bg-success size-1.5 animate-pulse rounded-full" />}
      {automationStatusLabels[status]}
    </Badge>
  );
}
