import { GeckoLogo } from "@/components/brand/gecko-logo";
import { GeckoMark } from "@/components/brand/gecko-mark";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid h-dvh lg:grid-cols-2">
      <div className="bg-sidebar text-sidebar-foreground relative hidden flex-col justify-between overflow-hidden p-10 lg:flex">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(600px 400px at 20% 0%, color-mix(in oklab, var(--primary) 22%, transparent), transparent), radial-gradient(700px 500px at 90% 100%, color-mix(in oklab, var(--chart-2) 14%, transparent), transparent)",
          }}
        />
        <GeckoLogo className="relative z-10" />

        <div className="relative z-10 max-w-md">
          <Badge variant="success" className="mb-5">
            <span className="size-1.5 animate-pulse rounded-full bg-current" />
            Self-hosted · Your data stays yours
          </Badge>
          <blockquote className="text-2xl leading-snug font-medium tracking-tight text-balance">
            “Your contacts, your campaigns, your analytics — on infrastructure you
            control, with open/click tracking and AI writing built in.”
          </blockquote>
          <div className="mt-6 flex items-center gap-3">
            <Avatar className="size-10">
              <AvatarFallback className="bg-primary/20 text-primary font-semibold">
                MG
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">Mailgeko</p>
              <p className="text-muted-foreground text-xs">
                Self-hostable email marketing
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-6">
          <div className="flex gap-4">
            {["Agile", "Smart", "Reliable", "Sticky"].map((value) => (
              <span
                key={value}
                className="text-muted-foreground text-xs font-medium tracking-wide uppercase"
              >
                {value}
              </span>
            ))}
          </div>
          <GeckoMark className="text-primary ml-auto size-8" />
        </div>
      </div>

      <div className="flex h-dvh flex-col overflow-hidden px-6 sm:px-12">
        <div className="lg:hidden">
          <GeckoLogo />
        </div>
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </main>
        <p className="text-muted-foreground py-2 text-center text-xs">
          © {new Date().getFullYear()} Mailgeko, Inc. All rights reserved.
        </p>
      </div>
    </div>
  );
}
