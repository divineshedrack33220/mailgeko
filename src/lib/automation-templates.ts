import type { AutomationStep } from "@/lib/types";
import { UserPlus, ShoppingCart, CalendarClock, MousePointerClick, type LucideIcon } from "lucide-react";

export interface AutomationTemplate {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

export const automationTemplates: AutomationTemplate[] = [
  {
    id: "welcome",
    title: "Welcome series",
    description: "5 emails · warm up new subscribers",
    icon: UserPlus,
  },
  {
    id: "abandoned-cart",
    title: "Abandoned cart",
    description: "3 emails · recover lost sales",
    icon: ShoppingCart,
  },
  {
    id: "win-back",
    title: "Win-back",
    description: "2 emails · re-engage lapsed contacts",
    icon: CalendarClock,
  },
  {
    id: "re-order",
    title: "Re-order reminder",
    description: "2 emails · remind of a purchase cycle",
    icon: MousePointerClick,
  },
];

export function automationStep(type: AutomationStep["type"], label: string): AutomationStep {
  return { id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, type, label, config: {} };
}

export function stepsForTemplate(id: string): AutomationStep[] {
  switch (id) {
    case "welcome":
      return [
        automationStep("send-email", "Welcome email"),
        automationStep("delay", "Wait 1 day"),
        automationStep("send-email", "Getting started guide"),
        automationStep("delay", "Wait 3 days"),
        automationStep("send-email", "Community + resources"),
      ];
    case "abandoned-cart":
      return [
        automationStep("send-email", "You left something behind"),
        automationStep("delay", "Wait 24 hours"),
        automationStep("send-email", "Back in stock reminder"),
        automationStep("delay", "Wait 2 days"),
        automationStep("send-email", "Last chance + discount"),
      ];
    case "win-back":
      return [
        automationStep("send-email", "We miss you"),
        automationStep("delay", "Wait 5 days"),
        automationStep("send-email", "Come back + offer"),
      ];
    case "re-order":
      return [
        automationStep("send-email", "Time to re-order"),
        automationStep("delay", "Wait 3 days"),
        automationStep("send-email", "Order reminder"),
      ];
    default:
      return [];
  }
}
