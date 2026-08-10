import Link from "next/link";

interface LandingNavCTAProps {
  visitorName: string | null;
}

export function LandingNavCTA({ visitorName }: LandingNavCTAProps) {
  if (visitorName) {
    return (
      <Link
        href="/dashboard"
        className="bg-[var(--lg-accent)] font-heading text-xs tracking-[0.2em] text-[var(--lg-primary-foreground)] uppercase rounded-full px-5 py-2.5 transition-colors hover:bg-[var(--lg-accent-bright)]"
      >
        Go to dashboard
      </Link>
    );
  }

  return (
    <>
      <Link
        href="/login"
        className="lg-nav-link hidden sm:inline-block"
      >
        Sign in
      </Link>
      <Link
        href="/register"
        className="bg-[var(--lg-accent)] font-heading text-xs tracking-[0.2em] text-[var(--lg-primary-foreground)] uppercase rounded-full px-5 py-2.5 transition-colors hover:bg-[var(--lg-accent-bright)]"
      >
        Get Started
      </Link>
    </>
  );
}
