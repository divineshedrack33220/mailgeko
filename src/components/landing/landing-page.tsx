"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Hand,
  Mail,
  Phone,
  Radio,
  Send,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GeckoMark } from "@/components/brand/gecko-mark";

interface LandingPageProps {
  fonts: string;
}

const REEL_IMAGES = [
  "/landing/reel-1.svg",
  "/landing/reel-2.svg",
  "/landing/reel-3.svg",
  "/landing/reel-4.svg",
  "/landing/reel-5.svg",
];

const TICKER = [
  "AGILE",
  "SMART",
  "RELIABLE",
  "STICKY",
  "SEND SMART",
  "STICKY DELIVERABILITY",
  "CLINGS TO THE INBOX",
  "QUICK ON ITS FEET",
  "AUTOMATE EVERYTHING",
  "PRIVACY FIRST",
  "DELIVERABILITY IS EARNED",
  "NO BLACKLISTS",
  "GROW ON YOUR TERMS",
  "OWN YOUR AUDIENCE",
];

const STATS = [
  { count: 2400, suffix: "+", label: "Million emails delivered", accent: true },
  { count: 42500, suffix: "", label: "Teams onboarded" },
  { count: 99, suffix: "", label: "Average deliverability" },
  { count: 24, suffix: "/7", label: "Human support, always" },
];

const PLATFORMS = [
  {
    num: "01",
    tag: "CAMPAIGNS",
    intensity: "DRAG · DROP",
    title: "CAMPAIGN STUDIO",
    img: "/landing/card-campaign.svg",
    body: "A visual drag-and-drop editor, reusable templates, and granular audience targeting. Design once, send everywhere — no code required.",
    meta: [
      ["Setup", "5 MIN"],
      ["Scale", "UNLIMITED"],
      ["Integrations", "40+"],
      ["A/B test", "BUILT IN"],
    ],
  },
  {
    num: "02",
    tag: "AUTOMATION",
    intensity: "ZERO CODE",
    title: "JOURNEY BUILDER",
    img: "/landing/card-journey.svg",
    body: "Visual automation flows for welcome series, abandoned carts, and win-back campaigns. Trigger on real behavior, not guesswork.",
    meta: [
      ["Triggers", "12+ EVENTS"],
      ["Steps", "UNLIMITED"],
      ["Wait / Split", "YEP"],
      ["Personalize", "100%"],
    ],
  },
  {
    num: "03",
    tag: "ANALYTICS",
    intensity: "LIVE METRICS",
    title: "REAL-TIME REPORTS",
    img: "/landing/card-reports.svg",
    body: "Opens, clicks, and revenue attribution streaming live — plus AI suggestions that tell you what to improve next.",
    meta: [
      ["Latency", "< 1s"],
      ["Revenue", "ATTRIBUTED"],
      ["Reports", "AUTO"],
      ["Export", "CSV / API"],
    ],
  },
];

const FEATURES = [
  {
    num: "/ 01",
    badge: "10× FASTER",
    name: "AI WRITER",
    img: "/landing/flip-aiwriter.svg",
    role: "Copywriting Engine",
    creds: "12 YRS · GPT",
    hover: "HOVER →",
    profileTag: "AI Copy Engine",
    title: "Credentials",
    points: [
      "Subject lines that earn opens",
      "Brand-voice matching, learned",
      "Previews, plain-text, alt text",
    ],
    signature: "GHOST WRITER",
    sigNote: "Draft a full campaign from a single prompt.",
  },
  {
    num: "/ 02",
    badge: "0.3s QUERIES",
    name: "SEGMENTATION",
    img: "/landing/flip-segmentation.svg",
    role: "Audience Engine",
    creds: "RFM · TAGS",
    hover: "HOVER →",
    profileTag: "Audience Engine",
    title: "Credentials",
    points: [
      "RFM, tags, custom fields",
      "Live audience previews",
      "Save segments, reuse anywhere",
    ],
    signature: "AUDIENCE ENGINE",
    sigNote: "Target the right inbox every single time.",
  },
  {
    num: "/ 03",
    badge: "99.2% INBOX",
    name: "DELIVERABILITY",
    img: "/landing/flip-deliverability.svg",
    role: "Inbox First",
    creds: "SPF · DKIM · DMARC",
    hover: "HOVER →",
    profileTag: "Deliverability",
    title: "Credentials",
    points: [
      "SPF, DKIM, DMARC auto-setup",
      "Warmup included on every plan",
      "Blacklist monitoring, always on",
    ],
    signature: "INBOX FIRST",
    sigNote: "Inbox placement that sticks — and keeps sticking.",
  },
  {
    num: "/ 04",
    badge: "GDPR NATIVE",
    name: "DATA PRIVACY",
    img: "/landing/flip-privacy.svg",
    role: "Own Your Data",
    creds: "EU HOSTED",
    hover: "HOVER →",
    profileTag: "Privacy",
    title: "Credentials",
    points: [
      "EU-hosted infrastructure",
      "No ad-network tracking",
      "Export or delete anytime",
    ],
    signature: "YOUR DATA",
    sigNote: "Your audience, your rules. Always.",
  },
];

const STORIES = [
  {
    tag: "CASE / 01",
    badge: "+31% REVENUE",
    name: "HALO SKINCARE",
    time: "E-COMMERCE",
    quote:
      "The automated welcome flow Mailgeko set up in an afternoon recovered more revenue in a quarter than our old tool did all year.",
    stats: [
      ["+31", "% revenue"],
      ["2.1", "× ROI"],
      ["6", "weeks"],
    ],
  },
  {
    tag: "CASE / 02",
    badge: "+27 PTS OPEN",
    name: "NORTHWIND CAFÉ",
    time: "NEWSLETTER",
    quote:
      "Open rates jumped from 34% to 61% after we let Mailgeko tune subject lines. Our readers actually look forward to Tuesday now.",
    stats: [
      ["61", "% opens"],
      ["+27", "points"],
      ["90", "sends"],
    ],
  },
  {
    tag: "CASE / 03",
    badge: "1 IN 5 WON BACK",
    name: "VELA CO.",
    time: "SAAS",
    quote:
      "The win-back journey pulls lapsed users back before they disappear. One in five returns — and Mailgeko proves it in the revenue report.",
    stats: [
      ["1:5", "win-backs"],
      ["-38", "% churn"],
      ["100", "automated"],
    ],
  },
  {
    tag: "CASE / 04",
    badge: "45 ACCOUNTS",
    name: "BLUEPRINT AGENCY",
    time: "AGENCY",
    quote:
      "Forty-five client accounts under one roof. Workspace permissions, white-label reports, and no per-client fees to juggle.",
    stats: [
      ["45", "accounts"],
      ["0", "per-client fees"],
      ["4.9", "client rating"],
    ],
  },
  {
    tag: "CASE / 05",
    badge: "1M SUBSCRIBERS",
    name: "KITE STUDIOS",
    time: "CREATORS",
    quote:
      "We hit a million subscribers without a single blacklist hit. Mailgeko's deliverability setup is just, frankly, unfair.",
    stats: [
      ["1M", "subscribers"],
      ["0", "blacklist hits"],
      ["99.4", "% delivered"],
    ],
  },
  {
    tag: "CASE / 06",
    badge: "99.4% DELIVERED",
    name: "ARBOR COFFEE",
    time: "RETAIL",
    quote:
      "Switched from a big-name platform and our inbox rate went up overnight. The team migrated 18k contacts in an afternoon.",
    stats: [
      ["99.4", "% inbox"],
      ["18k", "contacts"],
      ["1", "afternoon"],
    ],
  },
];

const USE_CASES = ["Newsletter", "E-commerce", "SaaS", "Agency", "Creator"];

const AUDIENCE_TIERS = [
  { label: "Startup", range: "< 1K" },
  { label: "Growing", range: "1–10K" },
  { label: "Scaling", range: "10–100K" },
  { label: "Enterprise", range: "100K+" },
];

const FOOTER_COLS = [
  {
    title: "Platform",
    links: ["Campaign Studio", "Automation", "Analytics", "Deliverability", "Pricing"],
  },
  {
    title: "Product",
    links: ["AI Writer", "Segments", "Templates", "Integrations", "API"],
  },
  {
    title: "Company",
    links: ["About", "Customers", "Security", "Privacy", "Status"],
  },
];

function useInViewAnimation(rootRef: React.RefObject<HTMLDivElement | null>) {
  React.useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const revealEls = Array.from(
      root.querySelectorAll<HTMLElement>(".lg-reveal:not(.lg-in-view)")
    );
    const staggerEls = Array.from(
      root.querySelectorAll<HTMLElement>(".lg-reveal-stagger:not(.lg-in-view)")
    );
    const counters = Array.from(root.querySelectorAll<HTMLElement>("[data-count]"));

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("lg-in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.05, rootMargin: "0px 0px -20px 0px" }
    );
    revealEls.forEach((el) => observer.observe(el));
    staggerEls.forEach((el) => observer.observe(el));

    const counterObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target as HTMLElement;
          const target = Number(el.dataset.count ?? "0");
          const suffix = el.dataset.suffix ?? "";
          const duration = 1800;
          const start = performance.now();
          const step = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const value = Math.floor(eased * target);
            el.textContent = `${value.toLocaleString()}${suffix}`;
            if (progress < 1) requestAnimationFrame(step);
            else el.textContent = `${target.toLocaleString()}${suffix}`;
          };
          requestAnimationFrame(step);
          counterObserver.unobserve(el);
        });
      },
      { threshold: 0.25 }
    );
    counters.forEach((el) => counterObserver.observe(el));

    return () => {
      observer.disconnect();
      counterObserver.disconnect();
    };
  }, [rootRef]);
}

function useHeroReel(count: number, duration = 5000) {
  const [frame, setFrame] = React.useState(0);
  const [progress, setProgress] = React.useState(0);
  React.useEffect(() => {
    let raf = 0;
    let t = 0;
    const tick = () => {
      t += 50;
      setProgress(Math.min((t / duration) * 100, 100));
      if (t >= duration) {
        t = 0;
        setFrame((f) => (f + 1) % count);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [count, duration]);
  return { frame, progress };
}

function StoriesCarousel() {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [cardWidth, setCardWidth] = React.useState(424);
  const [maxScroll, setMaxScroll] = React.useState(0);
  const [index, setIndex] = React.useState(0);
  const [dragX, setDragX] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const [paused, setPaused] = React.useState(false);
  const drag = React.useRef({ startX: 0, startIndex: 0, active: false });

  const count = STORIES.length;

  React.useEffect(() => {
    const measure = () => {
      if (!trackRef.current) return;
      const first = trackRef.current.firstElementChild as HTMLElement | null;
      if (!first) return;
      const gap = 24;
      const padding = 32;
      const cw = first.offsetWidth + gap;
      setCardWidth(cw);
      const total = count * cw - gap + padding * 2;
      setMaxScroll(Math.max(0, total - (trackRef.current.parentElement?.offsetWidth ?? 0)));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [count]);

  const goTo = React.useCallback(
    (next: number, dur = 700) => {
      setDragX(0);
      const clamped = Math.max(0, Math.min(count - 1, next));
      setIndex(clamped);
      if (trackRef.current) {
        trackRef.current.style.transition = `transform ${dur}ms cubic-bezier(0.16, 1, 0.3, 1)`;
      }
    },
    [count]
  );

  React.useEffect(() => {
    if (paused || dragging) return;
    const timer = setInterval(() => {
      goTo(index + 1);
    }, 4500);
    return () => clearInterval(timer);
  }, [index, paused, dragging, goTo]);

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { startX: e.clientX, startIndex: index, active: true };
    setDragging(true);
    setPaused(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current.active) return;
    const delta = e.clientX - drag.current.startX;
    const raw = drag.current.startIndex * cardWidth - delta;
    let offset = raw;
    if (raw < 0) offset = raw * 0.35;
    else if (raw > maxScroll) offset = maxScroll + (raw - maxScroll) * 0.35;
    setDragX(offset - drag.current.startIndex * cardWidth);
  };
  const onPointerUp = () => {
    if (!drag.current.active) return;
    const startIndex = drag.current.startIndex;
    const moved = Math.round((startIndex * cardWidth + dragX) / cardWidth);
    setDragX(0);
    setDragging(false);
    drag.current.active = false;
    goTo(moved);
    setTimeout(() => setPaused(false), 1200);
  };

  return (
    <>
      <div
        className="relative overflow-hidden"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          ref={trackRef}
          className={cn("lg-story-track", dragging && "lg-dragging")}
          style={{
            transform: `translateX(${dragX - index * cardWidth}px)`,
            touchAction: "pan-y",
          }}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {STORIES.map((s, i) => (
            <article key={s.tag} className="lg-story-card">
              <div className="relative h-56 overflow-hidden">
                <img
                  src={`/landing/story-${i}.svg`}
                  className="lg-img-noir h-full w-full object-cover"
                  alt={s.name}
                />
                <div className="absolute top-4 left-4 lg-font-mono text-[10px] tracking-[0.2em] text-[var(--lg-accent)]">
                  {s.tag}
                </div>
                <div className="lg-badge absolute right-4 bottom-4">
                  {s.badge}
                </div>
              </div>
              <div className="p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="lg-font-display text-2xl">{s.name}</h3>
                  <span className="lg-font-mono text-[10px] tracking-[0.15em] text-[var(--lg-muted)]">
                    {s.time}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-[var(--lg-fg-dim)] italic mb-5">
                  &ldquo;{s.quote}&rdquo;
                </p>
                <div className="grid grid-cols-3 gap-2 border-t border-[var(--lg-border-light)] pt-4">
                  {s.stats.map(([v, l]) => (
                    <div key={l}>
                      <div className="lg-font-display text-xl text-[var(--lg-accent)]">{v}</div>
                      <div className="lg-font-mono text-[9px] tracking-[0.15em] text-[var(--lg-muted)] uppercase">
                        {l}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
      <div className="mx-auto mt-10 flex max-w-[1600px] items-center justify-between px-6 lg:px-10">
        <div className="flex items-center gap-2">
          {STORIES.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i, 500)}
              aria-label={`Go to story ${i + 1}`}
              style={{
                width: i === index ? 32 : 8,
                height: 2,
                background: i === index ? "var(--lg-accent)" : "var(--lg-border-light)",
                transition: "all 0.4s",
              }}
            />
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => goTo(index - 1)}
            className="flex h-11 w-11 items-center justify-center border border-[var(--lg-border-light)] transition-all hover:border-[var(--lg-accent)] hover:bg-[var(--lg-accent)] hover:text-[var(--lg-primary-foreground)]"
            aria-label="Previous stories"
          >
            <ArrowLeft className="size-4" />
          </button>
          <button
            onClick={() => goTo(index + 1)}
            className="flex h-11 w-11 items-center justify-center border border-[var(--lg-border-light)] transition-all hover:border-[var(--lg-accent)] hover:bg-[var(--lg-accent)] hover:text-[var(--lg-primary-foreground)]"
            aria-label="Next stories"
          >
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    </>
  );
}

export function LandingPage({ fonts }: LandingPageProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [useCase, setUseCase] = React.useState(USE_CASES[0]);
  const [audience, setAudience] = React.useState(AUDIENCE_TIERS[0].label);
  const [form, setForm] = React.useState({ name: "", email: "" });
  const [submitting, setSubmitting] = React.useState(false);

  const { frame, progress } = useHeroReel(REEL_IMAGES.length);

  useInViewAnimation(rootRef);

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const flipCards = Array.from(root.querySelectorAll<HTMLElement>(".lg-flip-card"));
    flipCards.forEach((card) => {
      card.addEventListener("click", () => {
        if (window.matchMedia("(hover: none)").matches) {
          card.classList.toggle("lg-flipped");
        }
      });
    });
    return () => {
      flipCards.forEach((card) =>
        card.removeEventListener("click", () => {
          card.classList.remove("lg-flipped");
        })
      );
    };
  }, []);

  const [stickyVisible, setStickyVisible] = React.useState(false);
  React.useEffect(() => {
    const hero = rootRef.current?.querySelector("#lg-hero");
    const booking = rootRef.current?.querySelector("#lg-start");
    if (!hero || !booking) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.target === hero) {
            const atBooking =
              booking.getBoundingClientRect().top < window.innerHeight &&
              booking.getBoundingClientRect().bottom > 0;
            setStickyVisible(!entry.isIntersecting && !atBooking);
          }
        });
      },
      { threshold: 0 }
    );
    observer.observe(hero);
    observer.observe(booking);
    return () => observer.disconnect();
  }, []);

  const submitForm = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      toast.success("Request received", {
        description: "Your account is ready — check your inbox to sign in.",
      });
      setForm({ name: "", email: "" });
      window.location.href = "/register";
    }, 400);
  };

  return (
    <div ref={rootRef} className={cn("landing lg-bg-textured", fonts)}>
      <div className="lg-grain" />

      {/* ===================== NAV ===================== */}
      <header className="border-b border-[var(--lg-border)] bg-[var(--lg-bg-darker)]/80 fixed top-0 right-0 left-0 z-50 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-4 lg:px-10">
          <Link href="/" className="lg-group group flex items-center gap-3">
            <div className="bg-[var(--lg-accent)] relative flex h-9 w-9 items-center justify-center rounded-lg">
              <span className="lg-gecko-nudge">
                <GeckoMark className="size-6 text-[var(--lg-primary-foreground)]" eyeColor="var(--lg-accent)" />
              </span>
              <div className="absolute -inset-1 rounded-lg border border-[var(--lg-accent)] opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <div>
              <div className="lg-font-display text-2xl leading-none tracking-wider">
                MAIL<span className="text-[var(--lg-accent)]">GEKO</span>
              </div>
              <div className="lg-font-mono mt-0.5 text-[10px] tracking-[0.3em] text-[var(--lg-muted)]">
                EMAIL · AUTOMATION · AI
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-10 lg:flex">
            <a href="#lg-platform" className="lg-nav-link">
              Platform
            </a>
            <a href="#lg-features" className="lg-nav-link">
              Features
            </a>
            <a href="#lg-stories" className="lg-nav-link">
              Customers
            </a>
            <a href="#lg-start" className="lg-nav-link">
              Pricing
            </a>
            <a href="#lg-start" className="lg-nav-link">
              Contact
            </a>
          </nav>

          <div className="flex items-center gap-5">
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
              Start Free
            </Link>
          </div>
        </div>
      </header>

      {/* ===================== HERO ===================== */}
      <section className="relative h-screen min-h-[760px] w-full overflow-hidden" id="lg-hero">
        <div className="absolute inset-0" style={{ willChange: "transform" }} id="lg-reelContainer">
          {REEL_IMAGES.map((src, i) => (
            <div key={src} className={cn("lg-reel-frame", i === frame && "lg-active")}>
              <img src={src} alt="Mailgeko platform" />
            </div>
          ))}
        </div>

        <div className="lg-hero-overlay" />

        <div className="lg-gecko-hero" aria-hidden="true">
          <div className="lg-gecko-tail-anim">
            <GeckoMark className="h-24 w-24 text-[var(--lg-hero-accent)]" eyeColor="#0a0a0a" />
          </div>
        </div>

        <div className="relative z-10 mx-auto flex h-full max-w-[1600px] flex-col justify-end px-6 pt-32 pb-20 lg:px-10">
          <div className="lg-chip absolute top-32 right-6 z-20 lg:right-10">
            <span className="size-1.5 rounded-full bg-[var(--lg-accent)]" />
            <span>INBOX-FIRST ENGINE · LIVE</span>
          </div>

          <div className="lg-reveal lg-in-view max-w-5xl">
            <div className="lg-section-marker mb-6">
              <span>EST. 2025 · YOUR EMAIL, YOUR RULES · STICKY BY DESIGN</span>
            </div>
            <h1 className="lg-font-display mb-8 text-[var(--lg-hero-fg)] text-[clamp(2.75rem,7vw,5.75rem)] leading-[0.9]">
              <span className="lg-headline-line">
                <span>SENT WITH</span>
              </span>
              <span className="lg-headline-line">
                <span className="lg-text-stroke">PRECISION.</span>
              </span>
              <span className="lg-headline-line">
                <span>
                  DELIVERED ON <span className="text-[var(--lg-hero-accent)]">PURPOSE.</span>
                </span>
              </span>
            </h1>
            <p className="lg-font-body max-w-xl text-base leading-relaxed text-[var(--lg-hero-dim)] md:text-lg">
              The privacy-first, AI-powered email marketing platform. Agile, quick-footed, and
              built to stick in the inbox —{" "}
              <span className="text-[var(--lg-hero-fg)]">without selling your data</span>.
            </p>
          </div>

          <div className="mt-12 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex -space-x-3">
                <img
                  src="/landing/avatar-1.svg"
                  className="lg-img-noir h-12 w-12 rounded-full border-2 border-[var(--lg-bg)] object-cover"
                  alt="Team member"
                />
                <img
                  src="/landing/avatar-2.svg"
                  className="lg-img-noir h-12 w-12 rounded-full border-2 border-[var(--lg-bg)] object-cover"
                  alt="Team member"
                />
                <img
                  src="/landing/avatar-3.svg"
                  className="lg-img-noir h-12 w-12 rounded-full border-2 border-[var(--lg-bg)] object-cover"
                  alt="Team member"
                />
                <img
                  src="/landing/avatar-4.svg"
                  className="lg-img-noir h-12 w-12 rounded-full border-2 border-[var(--lg-bg)] object-cover"
                  alt="Team member"
                />
                <div className="bg-[var(--lg-accent)] flex h-12 w-12 items-center justify-center rounded-full border-2 border-[var(--lg-bg)]">
                  <span className="lg-font-display text-base text-[var(--lg-primary-foreground)]">42K</span>
                </div>
              </div>
              <div>
                <div className="lg-font-mono text-[10px] tracking-[0.2em] text-[var(--lg-hero-muted)] uppercase">
                  Trusted By
                </div>
                <div className="lg-font-heading text-sm tracking-wider text-[var(--lg-hero-fg)]">
                  42,000+ growing teams
                </div>
              </div>
            </div>

            <div className="flex w-full max-w-md items-center gap-6 lg:w-auto">
              <div className="lg-font-mono text-[10px] tracking-[0.2em] text-[var(--lg-hero-muted)]">
                <span className="text-[var(--lg-hero-accent)]">0{frame + 1}</span> / 05
              </div>
              <div className="lg-progress-bar flex-1">
                <div className="lg-progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <div className="lg-font-mono text-[10px] tracking-[0.2em] text-[var(--lg-hero-accent)]">
                PRODUCT REEL
              </div>
            </div>
          </div>
        </div>

        <div className="absolute right-0 bottom-0 left-0 z-10 overflow-hidden border-t border-white/10 bg-[#0a111a]/70 py-3 backdrop-blur-sm">
          <div className="lg-marquee-track lg-font-display text-sm tracking-[0.25em] text-[var(--lg-hero-dim)]">
            {[...TICKER, ...TICKER].map((word, i) => (
              <React.Fragment key={i}>
                <span className="px-8">{word}</span>
                <span className="text-[var(--lg-hero-accent)]">◆</span>
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== STATS ===================== */}
      <section className="relative overflow-hidden border-y border-[var(--lg-border)] bg-[var(--lg-bg-darker)]">
        <div className="mx-auto max-w-[1600px] px-6 py-16 lg:px-10 lg:py-20">
          <div className="lg-reveal-stagger grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="border-l border-[var(--lg-border-light)] pl-6">
                <div
                  className={cn(
                    "lg-font-display lg-number-display text-4xl md:text-5xl",
                    s.accent ? "text-[var(--lg-accent)]" : "text-[var(--lg-fg)]"
                  )}
                  data-count={s.count}
                  data-suffix={s.suffix}
                >
                  0
                </div>
                <div className="lg-font-mono mt-2 text-[11px] tracking-[0.2em] text-[var(--lg-muted)] uppercase">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== PLATFORM ===================== */}
      <section className="relative py-28 scroll-mt-24 lg:py-36" id="lg-platform">
        <div className="mx-auto max-w-[1600px] px-6 lg:px-10">
          <div className="lg-reveal mb-20 grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <div className="lg-section-marker mb-6">
                <span>01 — Platform</span>
              </div>
              <h2 className="lg-font-display text-4xl leading-[0.95] md:text-5xl lg:text-6xl">
                One tool.<br />
                <span className="lg-text-stroke">Every campaign.</span>
                <br />
                <span className="text-[var(--lg-accent)]">Every inbox.</span>
              </h2>
            </div>
            <div className="flex flex-col justify-end lg:col-span-6 lg:col-start-7">
              <p className="mb-6 text-lg leading-relaxed text-[var(--lg-fg-dim)]">
                Mailgeko is engineered around one objective — measurable, aggressive growth. Choose
                your flow. We bring the tools, the automation, and the sticky deliverability that
                refuses to let your emails land in spam.
              </p>
              <div className="flex flex-wrap gap-3">
                {["All Tools", "Campaigns", "Automation", "Analytics"].map((p) => (
                  <span key={p} className={cn("lg-goal-pill", p === "All Tools" && "lg-active")}>
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="lg-reveal-stagger grid gap-6 md:grid-cols-3 lg:gap-8">
            {PLATFORMS.map((p) => (
              <article key={p.title} className="lg-program-card lg-info-card lg-notch-corner group">
                <div className="relative h-72 overflow-hidden">
                  <img
                    src={p.img}
                    className="lg-program-img lg-img-noir h-full w-full object-cover"
                    alt={p.title}
                  />
                  <div className="from-[var(--lg-bg-card)] absolute inset-0 bg-gradient-to-t via-transparent to-transparent" />
                  <div className="lg-font-mono absolute top-4 left-4 text-[11px] tracking-[0.2em] text-[var(--lg-accent)]">
                    {p.num} / {p.tag}
                  </div>
                  <div className="lg-badge absolute top-4 right-4">
                    {p.intensity}
                  </div>
                </div>
                <div className="p-7">
                  <h3 className="lg-font-display mb-3 text-2xl md:text-3xl">{p.title}</h3>
                  <p className="mb-6 text-sm leading-relaxed text-[var(--lg-fg-dim)]">{p.body}</p>
                  <div className="mb-6 grid grid-cols-2 gap-x-4 gap-y-3 border-b border-[var(--lg-border-light)] pb-6">
                    {p.meta.map(([k, v]) => (
                      <div key={k}>
                        <div className="lg-font-mono text-[10px] tracking-[0.2em] text-[var(--lg-muted)] uppercase">
                          {k}
                        </div>
                        <div className="lg-font-heading text-base">{v}</div>
                      </div>
                    ))}
                  </div>
                  <a
                    href="#lg-start"
                    className="lg-link-underline lg-font-heading flex items-center justify-between text-sm tracking-[0.15em] uppercase"
                  >
                    <span>Explore Tool</span>
                    <ArrowRight className="size-4 text-[var(--lg-accent)]" />
                  </a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== FEATURES (flip cards) ===================== */}
      <section
        className="relative scroll-mt-24 border-t border-[var(--lg-border)] bg-[var(--lg-bg-darker)] py-28 lg:py-36"
        id="lg-features"
      >
        <div className="mx-auto max-w-[1600px] px-6 lg:px-10">
          <div className="lg-reveal mb-20 grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="lg-section-marker mb-6">
                <span>02 — The Engine Room</span>
              </div>
              <h2 className="lg-font-display text-4xl leading-[0.95] md:text-5xl lg:text-6xl">
                Tools that <span className="text-[var(--lg-accent)]">build</span> <br />
                habits that <span className="lg-text-stroke">convert.</span>
              </h2>
            </div>
            <div className="flex flex-col justify-end lg:col-span-4 lg:col-start-9">
              <p className="text-base leading-relaxed text-[var(--lg-fg-dim)]">
                Every Mailgeko capability ships production-ready and obsessively tested. Hover any
                card to see what happens under the hood.
              </p>
            </div>
          </div>

          <div className="lg-reveal-stagger grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.name} className="lg-flip-card">
                <div className="lg-flip-inner">
                  <div className="lg-flip-face lg-flip-front lg-info-card flex flex-col">
                    <div className="lg-coach-img-wrap">
                      <img
                        src={f.img}
                        alt={f.name}
                      />
                      <div className="lg-font-mono absolute top-4 left-4 text-[10px] tracking-[0.2em] text-[var(--lg-accent)]">
                        {f.num}
                      </div>
                      <div className="lg-badge absolute top-4 right-4">
                        {f.badge}
                      </div>
                      <div className="absolute right-4 bottom-4 left-4">
                        <div className="lg-font-mono text-[10px] tracking-[0.2em] text-[var(--lg-silver-dim)] uppercase">
                          {f.role}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col justify-between p-6">
                      <div>
                        <h3 className="lg-font-display text-3xl leading-none">{f.name}</h3>
                        <p className="lg-font-heading mt-2 text-xs uppercase tracking-wider text-[var(--lg-muted)]">
                          {f.role}
                        </p>
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t border-[var(--lg-border-light)] pt-4">
                        <span className="lg-font-mono text-[10px] tracking-[0.15em] text-[var(--lg-muted)]">
                          {f.creds}
                        </span>
                        <span className="lg-font-mono text-[10px] tracking-[0.15em] text-[var(--lg-accent)]">
                          HOVER →
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="lg-flip-face lg-flip-back lg-info-card bg-[var(--lg-bg-card)] flex flex-col p-7">
                    <div className="lg-font-mono mb-4 text-[10px] tracking-[0.2em] text-[var(--lg-accent)] uppercase">
                      / {f.profileTag}
                    </div>
                    <h3 className="lg-font-display mb-5 text-2xl">{f.title}</h3>
                    <ul className="mb-6 space-y-2.5 text-sm">
                      {f.points.map((pt) => (
                        <li key={pt} className="flex items-center gap-3">
                          <Check className="size-3.5 text-[var(--lg-accent)]" />
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-auto border-t border-[var(--lg-border-light)] pt-5">
                      <div className="lg-font-mono mb-2 text-[10px] tracking-[0.2em] text-[var(--lg-muted)] uppercase">
                        Signature Capability
                      </div>
                      <div className="lg-font-display text-2xl text-[var(--lg-accent)]">
                        {f.signature}
                      </div>
                      <p className="mt-2 text-xs text-[var(--lg-fg-dim)]">{f.sigNote}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== CUSTOMER STORIES ===================== */}
      <section className="relative scroll-mt-24 overflow-hidden py-28 lg:py-36" id="lg-stories">
        <div className="mx-auto mb-16 max-w-[1600px] px-6 lg:px-10">
          <div className="lg-reveal grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="lg-section-marker mb-6">
                <span className="inline-flex items-center gap-3">
                  <span className="lg-gecko-hop inline-flex">
                    <GeckoMark className="size-5 text-[var(--lg-accent)]" eyeColor="#0a0a0a" />
                  </span>
                  03 — Forged With Mailgeko
                </span>
              </div>
              <h2 className="lg-font-display text-4xl leading-[0.95] md:text-5xl lg:text-6xl">
                Real teams.<br />
                <span className="text-[var(--lg-accent)]">Relentless</span> growth.
              </h2>
            </div>
            <div className="flex flex-col justify-end lg:col-span-4 lg:col-start-9">
              <p className="mb-5 text-base leading-relaxed text-[var(--lg-fg-dim)]">
                Every result below was earned in production — measured, attributed, and delivered to
                the inbox. Drag the carousel to read their journey.
              </p>
              <div className="lg-font-mono flex items-center gap-3 text-[10px] tracking-[0.2em] text-[var(--lg-muted)] uppercase">
                <Hand className="size-4 text-[var(--lg-accent)]" />
                <span>Drag · Swipe · Auto-advance</span>
              </div>
            </div>
          </div>
        </div>

        <StoriesCarousel />
      </section>

      {/* ===================== GET STARTED ===================== */}
      <section
        className="relative scroll-mt-24 border-t border-[var(--lg-border)] bg-[var(--lg-bg-darker)] py-28 lg:py-36"
        id="lg-start"
      >
        <div className="mx-auto max-w-[1600px] px-6 lg:px-10">
          <div className="lg-reveal mb-16 grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <div className="lg-section-marker mb-6">
                <span>04 — Begin the Process</span>
              </div>
              <h2 className="lg-font-display text-4xl leading-[0.95] md:text-5xl lg:text-6xl">
                STOP SENDING<br />
                <span className="lg-text-stroke">BLIND.</span>{" "}
                <span className="text-[var(--lg-accent)]">START GROWING.</span>
              </h2>
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
            <div className="lg-reveal lg:col-span-7">
              <div className="lg-booking-frame p-8 lg:p-12">
                <div className="lg-font-mono mb-3 text-[11px] tracking-[0.2em] text-[var(--lg-accent)] uppercase">
                  {"// Create your account"}
                </div>
                <h3 className="lg-font-display mb-2 text-3xl">CLAIM YOUR FREE TIER</h3>
                <p className="mb-8 text-sm text-[var(--lg-fg-dim)]">
                  14-day pro trial, 1,000 contacts free forever. No credit card required.
                </p>

                <form onSubmit={submitForm} className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div>
                      <label className="lg-font-mono text-[10px] tracking-[0.2em] text-[var(--lg-muted)] uppercase">
                        Full Name
                      </label>
                      <input
                        type="text"
                        className="lg-form-input"
                        placeholder="Enter your name"
                        required
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="lg-font-mono text-[10px] tracking-[0.2em] text-[var(--lg-muted)] uppercase">
                        Team Size
                      </label>
                      <input
                        type="text"
                        className="lg-form-input"
                        placeholder="e.g. 5 people"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="lg-font-mono text-[10px] tracking-[0.2em] text-[var(--lg-muted)] uppercase">
                      Work Email
                    </label>
                    <input
                      type="email"
                      className="lg-form-input"
                      placeholder="you@company.com"
                      required
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="lg-font-mono mb-3 block text-[10px] tracking-[0.2em] text-[var(--lg-muted)] uppercase">
                      Primary Use Case
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {USE_CASES.map((uc) => (
                        <span
                          key={uc}
                          className={cn("lg-goal-pill", uc === useCase && "lg-active")}
                          onClick={() => setUseCase(uc)}
                        >
                          {uc}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="lg-font-mono mb-3 block text-[10px] tracking-[0.2em] text-[var(--lg-muted)] uppercase">
                      Audience Size
                    </label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {AUDIENCE_TIERS.map((t) => (
                        <label key={t.label} className="cursor-pointer">
                          <input
                            type="radio"
                            name="audience"
                            className="peer sr-only"
                            checked={audience === t.label}
                            onChange={() => setAudience(t.label)}
                          />
                          <div className="border border-[var(--lg-border-light)] py-3 text-center font-heading text-xs uppercase tracking-wider text-[var(--lg-fg-dim)] transition-all peer-checked:border-[var(--lg-accent)] peer-checked:bg-[var(--lg-accent)] peer-checked:text-[var(--lg-primary-foreground)]">
                            {t.label}
                            <br />
                            <span className="lg-font-mono text-[9px]">{t.range}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="lg-pulse-btn bg-[var(--lg-accent)] mt-4 flex w-full items-center justify-center gap-4 rounded-full py-5 font-display text-2xl tracking-wider text-[var(--lg-primary-foreground)] transition-colors hover:bg-[var(--lg-accent-bright)]"
                  >
                    <span>{submitting ? "CREATING…" : "START FOR FREE"}</span>
                    <Send className="size-5" />
                  </button>

                  <p className="lg-font-mono text-center text-[10px] tracking-[0.15em] text-[var(--lg-muted)] uppercase">
                    No charge · No credit card · Setup in 5 minutes
                  </p>
                </form>
              </div>
            </div>

            <div className="lg-reveal lg:col-span-5" style={{ "--lg-delay": "0.2s" } as React.CSSProperties}>
              <div className="space-y-6">
                <div className="lg-info-card p-7">
                  <div className="lg-font-mono mb-2 text-[10px] tracking-[0.2em] text-[var(--lg-accent)] uppercase">
                    / Pricing
                  </div>
                  <h4 className="lg-font-display mb-3 text-2xl">FREE TIER FOREVER</h4>
                  <p className="mb-4 text-sm leading-relaxed text-[var(--lg-fg-dim)]">
                    Up to 1,000 contacts and 10,000 emails a month. Upgrade only when you&apos;re
                    ready to scale.
                  </p>
                  <div className="lg-font-mono flex items-center gap-3 text-[11px] text-[var(--lg-silver)]">
                    <TrendingUp className="size-4 text-[var(--lg-accent)]" />
                    <span>PAY-AS-YOU-GROW · CANCEL ANYTIME</span>
                  </div>
                </div>

                <div className="lg-info-card p-7">
                  <div className="lg-font-mono mb-2 text-[10px] tracking-[0.2em] text-[var(--lg-accent)] uppercase">
                    / Support
                  </div>
                  <h4 className="lg-font-display mb-3 text-2xl">HUMANS ON DUTY</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between border-b border-[var(--lg-border-light)] pb-2">
                      <span className="text-[var(--lg-fg-dim)]">Live chat</span>
                      <span className="lg-font-mono text-[var(--lg-silver)]">24/7</span>
                    </div>
                    <div className="flex justify-between border-b border-[var(--lg-border-light)] pb-2">
                      <span className="text-[var(--lg-fg-dim)]">Email response</span>
                      <span className="lg-font-mono text-[var(--lg-silver)]">&lt; 4 HRS</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--lg-fg-dim)]">Onboarding</span>
                      <span className="lg-font-mono text-[var(--lg-silver)]">FREE COACH</span>
                    </div>
                  </div>
                </div>

                <div className="lg-info-card p-7">
                  <div className="lg-font-mono mb-2 text-[10px] tracking-[0.2em] text-[var(--lg-accent)] uppercase">
                    / Direct Contact
                  </div>
                  <h4 className="lg-font-display mb-3 text-2xl">REACH THE TEAM</h4>
                  <div className="space-y-2.5 text-sm">
                    <a
                      href="mailto:hello@mailgeko.dev"
                      className="flex items-center gap-3 transition-colors hover:text-[var(--lg-accent)]"
                    >
                      <Mail className="size-4 text-[var(--lg-accent)]" />
                      <span className="lg-font-mono">hello@mailgeko.dev</span>
                    </a>
                    <a
                      href="#lg-start"
                      className="flex items-center gap-3 transition-colors hover:text-[var(--lg-accent)]"
                    >
                      <Phone className="size-4 text-[var(--lg-accent)]" />
                      <span className="lg-font-mono">+1 (555) 010-2025</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== FOOTER ===================== */}
      <footer className="relative overflow-hidden border-t border-[var(--lg-border)] bg-[var(--lg-bg-darker)] py-16">
        <div className="mx-auto max-w-[1600px] px-6 lg:px-10">

          <div className="relative mb-12 grid gap-10 md:grid-cols-12">
            <div className="md:col-span-5">
              <div className="mb-5 flex items-center gap-3">
                <div className="bg-[var(--lg-accent)] flex h-10 w-10 items-center justify-center">
                  <span className="lg-gecko-hop inline-flex">
                    <GeckoMark className="size-6 text-[var(--lg-primary-foreground)]" eyeColor="var(--lg-accent)" />
                  </span>
                </div>
                <div>
                  <div className="lg-font-display text-2xl leading-none tracking-wider">
                    MAIL<span className="text-[var(--lg-accent)]">GEKO</span>
                  </div>
                  <div className="lg-font-mono mt-0.5 text-[10px] tracking-[0.3em] text-[var(--lg-muted)]">
                    EST. 2025 · EU HOSTED
                  </div>
                </div>
              </div>
              <p className="mb-6 max-w-md text-sm leading-relaxed text-[var(--lg-fg-dim)]">
                The privacy-first, AI-powered email marketing platform. Campaigns, automation, and
                analytics — without selling your data.
              </p>
              <div className="mb-6 flex flex-wrap gap-x-6 gap-y-2">
                {["Agile", "Smart", "Reliable", "Sticky"].map((v) => (
                  <span
                    key={v}
                    className="lg-font-mono text-[10px] tracking-[0.25em] text-[var(--lg-accent)] uppercase"
                  >
                    {v}
                  </span>
                ))}
              </div>
              <div className="flex gap-3">
                {[Mail, Zap, Radio, Users].map((Icon, i) => (
                  <a
                    key={i}
                    href="#lg-start"
                    className="border-[var(--lg-border-light)] hover:bg-[var(--lg-accent)] hover:text-[var(--lg-primary-foreground)] flex h-10 w-10 items-center justify-center border transition-all hover:border-[var(--lg-accent)]"
                    aria-label="Mailgeko social"
                  >
                    <Icon className="size-4" />
                  </a>
                ))}
              </div>
            </div>

            {FOOTER_COLS.map((col) => (
              <div key={col.title} className="md:col-span-2">
                <h5 className="lg-font-mono mb-4 text-[10px] tracking-[0.2em] text-[var(--lg-accent)] uppercase">
                  {col.title}
                </h5>
                <ul className="space-y-2 text-sm">
                  {col.links.map((l) => (
                    <li key={l}>
                      <a
                        href="#lg-start"
                        className="lg-link-underline text-[var(--lg-fg-dim)] transition-colors hover:text-[var(--lg-fg)]"
                      >
                        {l}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <div className="md:col-span-3">
              <h5 className="lg-font-mono mb-4 text-[10px] tracking-[0.2em] text-[var(--lg-accent)] uppercase">
                Newsletter
              </h5>
              <p className="mb-4 text-xs leading-relaxed text-[var(--lg-fg-dim)]">
                Weekly growth notes, product updates, and deliverability tips. No spam — ever.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  toast.success("Subscribed", { description: "You're on the list. Welcome aboard." });
                  e.currentTarget.reset();
                }}
                className="flex border border-[var(--lg-border-light)] transition-colors focus-within:border-[var(--lg-accent)]"
              >
                <input
                  type="email"
                  placeholder="email@address.com"
                  className="flex-1 bg-transparent px-3 py-2.5 text-sm text-[var(--lg-fg)] outline-none placeholder:text-[var(--lg-muted)]"
                />
                <button
                  type="submit"
                  className="bg-[var(--lg-accent)] px-4 text-[var(--lg-primary-foreground)] transition-colors hover:bg-[var(--lg-accent-bright)]"
                  aria-label="Subscribe"
                >
                  <ArrowRight className="size-4" />
                </button>
              </form>
            </div>
          </div>

          <div className="lg-font-mono relative flex flex-col justify-between gap-4 border-t border-[var(--lg-border)] pt-6 text-[11px] tracking-[0.15em] text-[var(--lg-muted)] uppercase md:flex-row">
            <div>© 2026 MAILGEKO</div>
            <div className="flex gap-6">
              <a href="#lg-start" className="transition-colors hover:text-[var(--lg-accent)]">
                Privacy
              </a>
              <a href="#lg-start" className="transition-colors hover:text-[var(--lg-accent)]">
                Terms
              </a>
              <a href="#lg-start" className="transition-colors hover:text-[var(--lg-accent)]">
                Security
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* ===================== STICKY CTA ===================== */}
      <div className={cn("lg-sticky-cta", stickyVisible && "lg-visible")}>
        <div className="border-t border-[var(--lg-accent)]/25 bg-[var(--lg-bg-darker)]/95 backdrop-blur-md">
          <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-6 py-4 lg:px-10">
            <div className="flex items-center gap-5">
              <div className="lg-font-mono hidden items-center gap-2 text-[11px] tracking-[0.2em] text-[var(--lg-accent)] sm:flex">
                <span className="size-2 rounded-full bg-[var(--lg-accent)]" />
                <span>FREE TIER OPEN</span>
              </div>
              <div>
                <div className="lg-font-display text-xl leading-none md:text-2xl">
                  CLAIM YOUR FREE TIER
                </div>
                <div className="lg-font-mono mt-1 text-[10px] tracking-[0.15em] text-[var(--lg-muted)] uppercase">
                  14-DAY PRO · NO CREDIT CARD · SETUP IN 5 MIN
                </div>
              </div>
            </div>
            <Link
              href="/register"
              className="lg-pulse-btn bg-[var(--lg-accent)] flex items-center gap-3 rounded-full whitespace-nowrap px-6 py-3.5 font-heading text-xs tracking-[0.2em] text-[var(--lg-primary-foreground)] uppercase transition-colors hover:bg-[var(--lg-accent-bright)] md:px-8 md:text-sm"
            >
              <span>START FREE</span>
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
