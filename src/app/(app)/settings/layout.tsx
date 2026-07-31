"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, User, Users, KeyRound, Bell, ShieldCheck, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { title: "Profile", href: "/settings", icon: User },
  { title: "Team", href: "/settings/team", icon: Users },
  { title: "API keys", href: "/settings/api-keys", icon: KeyRound },
  { title: "Notifications", href: "/settings/notifications", icon: Bell },
  { title: "Security", href: "/settings/security", icon: ShieldCheck },
  { title: "Billing", href: "/settings/billing", icon: CreditCard },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Settings className="text-primary size-6" /> Settings
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage your workspace, team, security and billing.
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <nav className="flex w-full shrink-0 gap-1 overflow-x-auto lg:w-48 lg:flex-col lg:gap-0.5">
          {tabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <tab.icon className="size-4" />
                {tab.title}
              </Link>
            );
          })}
        </nav>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
