"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  Filter,
  Hand,
  Lock,
  Mail,
  Phone,
  Radio,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Workflow,
  Zap,
} from "lucide-react";
import { api, getToken } from "@/lib/api";
import { cn } from "@/lib/utils";
import { getStoredVisitor, getVisitorFromUrl, rememberVisitor } from "@/lib/visitor";
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
  "NO EXCUSES",
  "AGILE",
  "SMART",
  "RELIABLE",
  "STICKY",
  "GROW ON YOUR TERMS",
  "STICK TO THE INBOX",
  "EARN THE INBOX",
  "PRIVATE BY DEFAULT",
  "DELIVERED ON PURPOSE",
  "OWN YOUR AUDIENCE",
  "NO BLACKLISTS",
  "AUTOMATE EVERYTHING",
  "QUICK ON ITS FEET",
  "CLINGS TO THE INBOX",
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
    icon: Send,
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
    icon: Workflow,
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
    icon: BarChart3,
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
    icon: Sparkles,
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
    icon: Filter,
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
    icon: ShieldCheck,
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
    icon: Lock,
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

const PRICING_TIERS = [
  {
    name: "FREE",
    tag: "FOREVER",
    price: "$0",
    period: "",
    highlight: false,
    blurb: "Everything you need to launch.",
    features: [
      "1,000 contacts free forever",
      "10,000 emails / month",
      "Campaign studio + templates",
      "Community support",
    ],
  },
  {
    name: "PRO",
    tag: "MOST POPULAR",
    price: "$19",
    period: "/mo",
    highlight: true,
    blurb: "For teams ready to scale fast.",
    features: [
      "10,000 contacts included",
      "Unlimited email sends",
      "Full AI writer + journey builder",
      "Priority human support 24/7",
    ],
  },
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
  const [index, setIndex] = React.useState(STORIES.length);
  const [dragX, setDragX] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const [paused, setPaused] = React.useState(false);
  const drag = React.useRef({ startX: 0, startIndex: 0, active: false });

  const count = STORIES.length;
  const sets = 3;
  const last = count * (sets - 1);

  React.useEffect(() => {
    const measure = () => {
      if (!trackRef.current) return;
      const first = trackRef.current.firstElementChild as HTMLElement | null;
      if (!first) return;
      const gap = 24;
      const cw = first.offsetWidth + gap;
      setCardWidth(cw);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [count]);

  const goTo = React.useCallback(
    (next: number, dur = 700) => {
      setDragX(0);
      const clamped = Math.max(0, Math.min(last, next));
      setIndex(clamped);
      if (trackRef.current) {
        trackRef.current.style.transition = `transform ${dur}ms cubic-bezier(0.16, 1, 0.3, 1)`;
      }
    },
    [last]
  );

  React.useEffect(() => {
    if (index > 0 && index < last) return;
    const timer = setTimeout(() => {
      if (trackRef.current) trackRef.current.style.transition = "none";
      setIndex(count);
      requestAnimationFrame(() => {
        if (trackRef.current) trackRef.current.style.transition = "";
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [index, count, last]);

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
    setDragX(drag.current.startIndex * cardWidth - delta - drag.current.startIndex * cardWidth);
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
          {Array.from({ length: sets }).flatMap((_, set) =>
            STORIES.map((s) => (
              <article key={`${set}-${s.tag}`} className="lg-story-card">
                <div className="lg-card-art h-[clamp(150px,18vh,224px)]">
                  <div className="lg-font-mono absolute top-4 left-4 text-[10px] tracking-[0.2em] text-[var(--lg-accent)]">
                    {s.tag}
                  </div>
                  <div className="lg-badge absolute right-4 bottom-4">
                    {s.badge}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="lg-font-display text-5xl leading-none tracking-tight text-[var(--lg-fg)]">
                      {s.name.charAt(0)}
                    </span>
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
            ))
          )}
        </div>
      </div>
      <div className="mx-auto mt-10 flex max-w-[1600px] items-center justify-between px-6 lg:px-10">
        <div className="flex items-center gap-2">
          {STORIES.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i + count, 500)}
              aria-label={`Go to story ${i + 1}`}
              style={{
                width: i === index % count ? 32 : 8,
                height: 2,
                background: i === index % count ? "var(--lg-accent)" : "var(--lg-border-light)",
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
  const [visitorName, setVisitorName] = React.useState<string | null>(null);
  const [stickyVisible, setStickyVisible] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const fromUrl = getVisitorFromUrl();
      const stored = getStoredVisitor();
      const email = fromUrl.email ?? stored.email;
      let name = fromUrl.name ?? stored.name ?? null;

      if (name || email) rememberVisitor(name, email);

      if (!name && getToken()) {
        try {
          const res = await api.get<{ user: { name: string; email: string } }>("/api/v1/me");
          if (cancelled) return;
          const word = res.user?.name?.trim().split(/\s+/)[0];
          if (word) name = word.toUpperCase();
          rememberVisitor(name, res.user?.email);
        } catch {
          // not authenticated or API unavailable — keep the generic headline
        }
      }

      if (cancelled) return;
      setVisitorName(name);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const { frame } = useHeroReel(REEL_IMAGES.length);

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

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const hero = root.querySelector<HTMLElement>("#lg-hero");
    const start = root.querySelector<HTMLElement>("#lg-start");
    if (!hero) return;
    const update = () => {
      const heroGone = hero.getBoundingClientRect().bottom < 0;
      const startVisible = start
        ? start.getBoundingClientRect().top < window.innerHeight &&
          start.getBoundingClientRect().bottom > 0
        : false;
      setStickyVisible(heroGone && !startVisible);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

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
      <section className="relative flex min-h-dvh w-full flex-col overflow-hidden" id="lg-hero">
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

        <div className="lg-hero-inner relative z-10 mx-auto flex w-full max-w-[1600px] flex-1 flex-col justify-center px-6 pt-28 pb-10 lg:pt-32 lg:pb-14">
          <div className="lg-reveal lg-in-view mx-auto max-w-5xl">
            <h1
              className={cn(
                "lg-font-display lg-hero-h1 mb-8 text-center text-[var(--lg-hero-fg)] leading-[0.9]",
                visitorName ? "text-[clamp(2.75rem,6.05vw,5.25rem)]" : "text-[clamp(3rem,7.7vw,6.3rem)]"
              )}
            >
              <span className="lg-headline-line">
                <span>
                  {visitorName ? (
                    <>
                      <span className="text-[var(--lg-hero-accent)]">{visitorName}</span>
                      {", YOUR EXCUSES"}
                    </>
                  ) : (
                    "YOUR EXCUSES"
                  )}
                </span>
              </span>
              <span className="lg-headline-line">
                <span className="lg-text-stroke">AREN&apos;T GROWING</span>
              </span>
              <span className="lg-headline-line">
                <span>
                  YOUR <span className="text-[var(--lg-hero-accent)]">BUSINESS.</span>
                </span>
              </span>
            </h1>
            <p className="lg-font-body mx-auto max-w-xl text-center text-lg leading-relaxed text-[var(--lg-hero-dim)] md:text-xl">
              The privacy-first, AI-powered email marketing platform. Agile, quick-footed, and
              built to stick in the inbox —{" "}
              <span className="text-[var(--lg-hero-fg)]">without selling your data</span>.
            </p>
          </div>

          <div className="mx-auto mt-12 w-full max-w-5xl">
            <div className="flex items-center justify-center gap-4">
              <div className="flex -space-x-3">
                {["JK", "AM", "SR", "DL"].map((initials) => (
                  <div
                    key={initials}
                    className="flex h-[52px] w-[52px] items-center justify-center rounded-full border-2 border-[var(--lg-bg)] bg-[#15202c]"
                  >
                    <span className="lg-font-mono text-sm text-[var(--lg-hero-accent)]">{initials}</span>
                  </div>
                ))}
                <div className="bg-[var(--lg-accent)] flex h-[52px] w-[52px] items-center justify-center rounded-full border-2 border-[var(--lg-bg)]">
                  <span className="lg-font-display text-[1.1rem] text-[var(--lg-primary-foreground)]">42K</span>
                </div>
              </div>
              <div>
                <div className="lg-font-mono text-[11px] tracking-[0.2em] text-[var(--lg-hero-muted)] uppercase">
                  Trusted By
                </div>
                <div className="lg-font-heading text-[0.95rem] tracking-wider text-[var(--lg-hero-fg)]">
                  42,000+ growing teams
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 overflow-hidden border-t border-white/10 bg-[#0a111a]/70 py-3 backdrop-blur-sm">
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
                <div className="lg-card-art h-[clamp(120px,15vh,200px)]">
                  <div className="lg-font-mono absolute top-3 left-4 text-[10px] tracking-[0.2em] text-[var(--lg-accent)]">
                    {p.num} / {p.tag}
                  </div>
                  <div className="lg-badge absolute top-3 right-4">
                    {p.intensity}
                  </div>
                  <div className="absolute inset-x-0 bottom-3 flex items-center justify-between px-4">
                    <p.icon className="lg-card-art-icon size-9" />
                    <span className="lg-font-mono text-[10px] tracking-[0.2em] text-[var(--lg-silver-dim)] uppercase">
                      {p.tag}
                    </span>
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="lg-font-display mb-2 text-lg md:text-xl">{p.title}</h3>
                  <p className="mb-4 text-xs leading-snug text-[var(--lg-fg-dim)]">{p.body}</p>
                  <div className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 border-b border-[var(--lg-border-light)] pb-4">
                    {p.meta.map(([k, v]) => (
                      <div key={k}>
                        <div className="lg-font-mono text-[9px] tracking-[0.2em] text-[var(--lg-muted)] uppercase">
                          {k}
                        </div>
                        <div className="lg-font-heading text-sm">{v}</div>
                      </div>
                    ))}
                  </div>
                  <a
                    href="#lg-start"
                    className="lg-link-underline lg-font-heading flex items-center justify-between text-xs tracking-[0.15em] uppercase"
                  >
                    <span>Explore Tool</span>
                    <ArrowRight className="size-3.5 text-[var(--lg-accent)]" />
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
                    <div className="lg-card-art h-[clamp(150px,22vh,230px)]">
                      <div className="lg-font-mono absolute top-4 left-4 text-[10px] tracking-[0.2em] text-[var(--lg-accent)]">
                        {f.num}
                      </div>
                      <div className="lg-badge absolute top-4 right-4">
                        {f.badge}
                      </div>
                      <div className="absolute right-4 bottom-4 left-4 flex items-center justify-between">
                        <f.icon className="lg-card-art-icon size-8" />
                        <span className="lg-font-mono text-[10px] tracking-[0.15em] text-[var(--lg-silver-dim)] uppercase">
                          {f.role}
                        </span>
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
              <div className="lg-booking-frame p-6 lg:p-9">
                <div className="lg-font-mono mb-2 text-[10px] tracking-[0.2em] text-[var(--lg-accent)] uppercase">
                  {"// Simple pricing"}
                </div>
                <h3 className="lg-font-display mb-1.5 text-2xl">START FREE. SCALE WHEN READY.</h3>
                <p className="mb-6 text-sm text-[var(--lg-fg-dim)]">
                  14-day pro trial, 1,000 contacts free forever. No credit card required.
                </p>

                <div className="space-y-3">
                  {PRICING_TIERS.map((tier) => (
                    <div
                      key={tier.name}
                      className={cn(
                        "relative flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between",
                        tier.highlight
                          ? "lg-tier-highlight border border-[var(--lg-accent)]"
                          : "border border-[var(--lg-border-light)]"
                      )}
                    >
                      {tier.highlight && (
                        <span className="lg-badge absolute -top-2.5 right-4">{tier.tag}</span>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="lg-font-display text-xl">{tier.name}</h4>
                          {!tier.highlight && <span className="lg-badge">{tier.tag}</span>}
                        </div>
                        <p className="mt-1 text-xs text-[var(--lg-fg-dim)]">{tier.blurb}</p>
                        <ul className="mt-3 grid gap-1.5 text-xs text-[var(--lg-fg-dim)] sm:grid-cols-2">
                          {tier.features.map((f) => (
                            <li key={f} className="flex items-center gap-2">
                              <Check className="size-3.5 shrink-0 text-[var(--lg-accent)]" />
                              {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="shrink-0 text-right">
                        <div
                          className={cn(
                            "lg-font-display text-3xl",
                            tier.highlight && "text-[var(--lg-accent)]"
                          )}
                        >
                          {tier.price}
                          <span className="text-sm text-[var(--lg-muted)]">{tier.period}</span>
                        </div>
                        {tier.highlight && (
                          <div className="lg-font-mono mt-1 text-[9px] tracking-[0.15em] text-[var(--lg-muted)] uppercase">
                            Pay-as-you-grow · Cancel anytime
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <Link
                  href="/register"
                  className="lg-pulse-btn bg-[var(--lg-accent)] mt-6 flex w-full items-center justify-center gap-4 rounded-full py-4 font-display text-xl tracking-wider text-[var(--lg-primary-foreground)] transition-colors hover:bg-[var(--lg-accent-bright)]"
                >
                  <span>START FREE</span>
                  <Send className="size-5" />
                </Link>
                <p className="lg-font-mono mt-3 text-center text-[10px] tracking-[0.15em] text-[var(--lg-muted)] uppercase">
                  No charge · No credit card · Setup in 5 minutes
                </p>
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
      <div
        className={cn(
          "lg-sticky-cta fixed inset-x-0 bottom-0 z-40 border-t border-[var(--lg-border)] bg-[var(--lg-bg-darker)]/95 backdrop-blur-md transition-all duration-500",
          stickyVisible
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-full opacity-0"
        )}
      >
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-6 py-2.5 lg:px-10">
          <div className="lg-font-display text-lg tracking-wide text-[var(--lg-fg)] lg:text-xl">
            START FREE. <span className="text-[var(--lg-accent)]">SCALE WHEN READY.</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="lg-font-mono hidden text-[10px] tracking-[0.15em] text-[var(--lg-muted)] uppercase md:inline">
              1,000 contacts free forever
            </span>
            <Link
              href="/register"
              className="bg-[var(--lg-accent)] px-5 py-2.5 font-display text-[10px] tracking-widest text-[var(--lg-primary-foreground)] transition-colors hover:bg-[var(--lg-accent-bright)]"
            >
              START FREE
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
