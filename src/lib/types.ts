export type ContactStatus = "active" | "unsubscribed" | "bounced" | "spam";

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  read: boolean;
  readAt?: string;
  createdAt: string;
}


export interface Contact {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  position?: string;
  country?: string;
  city?: string;
  phoneNumber?: string;
  customFields: Record<string, string>;
  tags: string[];
  status: ContactStatus;
  createdAt: string;
  updatedAt: string;
  lastEngagementAt?: string;
}

export interface ContactList {
  id: string;
  name: string;
  description?: string;
  contactCount: number;
  createdAt: string;
}

export interface SegmentCondition {
  id: string;
  field: string;
  operator: string;
  value: string;
}

export interface Segment {
  id: string;
  name: string;
  description?: string;
  matchType: "all" | "any";
  conditions: SegmentCondition[];
  contactCount?: number;
  createdAt: string;
  updatedAt: string;
}

export type CampaignStatus =
  | "active"
  | "draft"
  | "scheduled"
  | "sending"
  | "sent"
  | "paused"
  | "completed"
  | "failed";

export type CampaignType = "regular" | "automated" | "test";

export interface CampaignStats {
  recipients: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  unsubscribed: number;
  uniqueOpens: number;
  uniqueClicks: number;
}

export type RecipientStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained"
  | "unsubscribed"
  | "failed"
  | "skipped";

export interface CampaignRecipient {
  contactId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  status: RecipientStatus;
  error?: string;
  messageId?: string;
  automationRunId?: string;
  sentAt?: string;
  deliveredAt?: string;
  openedAt?: string;
  clickedAt?: string;
  bouncedAt?: string;
  complainedAt?: string;
  unsubscribedAt?: string;
}

export interface Campaign {
  id: string;
  name: string;
  subject: string;
  templateId?: string;
  previewText?: string;
  plainText?: string;
  htmlContent?: string;
  status: CampaignStatus;
  type: CampaignType;
  listIds: string[];
  segmentIds?: string[];
  scheduleAt?: string;
  sender: {
    fromName: string;
    fromEmail: string;
    replyTo?: string;
  };
  settings: {
    trackOpens: boolean;
    trackClicks: boolean;
    allowUnsubscribe: boolean;
    customHeaders?: Record<string, string>;
  };
  stats: CampaignStats;
  createdAt: string;
  updatedAt: string;
}

export type AutomationStatus = "active" | "paused" | "draft";

export type AutomationStepType =
  | "send-email"
  | "condition"
  | "delay"
  | "add-tag"
  | "remove-tag"
  | "unsubscribe"
  | "webhook";

export interface AutomationStep {
  id: string;
  type: AutomationStepType;
  label: string;
  config: Record<string, unknown>;
}

export interface Automation {
  id: string;
  name: string;
  description: string;
  trigger: {
    type: "welcome" | "purchase" | "abandoned_cart" | "birthday" | "custom";
    label: string;
    conditions: SegmentCondition[];
    delay?: number;
  };
  steps: AutomationStep[];
  status: AutomationStatus;
  contacts?: number;
  activeCount?: number;
  completedCount?: number;
  failedCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationRun {
  id: string;
  status: "active" | "processing" | "completed" | "failed";
  contact: {
    id: string;
    email: string;
    name: string;
  };
  stepIndex: number;
  attempts: number;
  error?: string;
  runAt: string;
  updatedAt: string;
}

export type TemplateCategory =
  | "Newsletter"
  | "Promotional"
  | "Transactional"
  | "Welcome"
  | "Abandoned Cart"
  | "Re-engagement"
  | "Announcement";

export interface Template {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  thumbnail: "promo" | "newsletter" | "welcome" | "transactional" | "cart";
  mjml: string;
  html: string;
  variables: string[];
  tags: string[];
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
  usedCount: number;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "Owner" | "Admin" | "Manager" | "Viewer";
  status: "active" | "invited";
  lastActive?: string;
  invitedAt?: string;
  twoFactorEnabled?: boolean;
}

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsed?: string;
  expiresAt?: string;
}

export interface SeriesPoint {
  date: string;
  value: number;
  secondary?: number;
}

export interface LinkStat {
  url: string;
  clicks: number;
}

export interface DeviceStat {
  name: string;
  count: number;
}

export interface CountryStat {
  country: string;
  code: string;
  opens: number;
}

export interface BillingPlan {
  id: string;
  name: string;
  priceMonthly: number;
  emailsPerMonth: number;
  maxContacts: number;
  maxUsers: number;
  features: string[];
}

export interface BillingUsage {
  contacts: number;
  emailsThisMonth: number;
}

export interface BillingLimits {
  plan: string;
  planName: string;
  maxContacts: number;
  maxEmailsPerMonth: number;
  contacts: number;
  emailsThisMonth: number;
  contactsExceeded: boolean;
  emailsExceeded: boolean;
}
