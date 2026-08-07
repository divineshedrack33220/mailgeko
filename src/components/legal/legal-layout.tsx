import Link from "next/link";

interface LegalLayoutProps {
  title: string;
  updated: string;
  children: React.ReactNode;
}

export function LegalLayout({ title, updated, children }: LegalLayoutProps) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-muted-foreground hover:text-foreground text-sm font-medium">
            ← Back to Mailgeko
          </Link>
          <span className="text-muted-foreground text-sm font-medium">Mailgeko</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-foreground text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground mt-2 text-sm">Last updated: {updated}</p>
        <div className="text-muted-foreground mt-8 space-y-6 text-sm leading-relaxed">
          {children}
        </div>
      </main>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-foreground text-lg font-semibold">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
