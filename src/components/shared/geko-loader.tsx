import { cn } from "@/lib/utils";

interface GekoLoaderProps {
  label?: string;
  className?: string;
}

export function GekoLoader({ label = "Loading", className }: GekoLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "bg-background/85 flex flex-col items-center justify-center gap-6 backdrop-blur-md",
        className
      )}
    >
      <span className="sr-only">{label} Mailgeko</span>

      <div className="bg-primary/10 absolute inset-x-0 top-0 h-1 overflow-hidden">
        <div className="animate-gecko-slide bg-gradient-to-r from-transparent via-primary to-transparent h-full w-1/3" />
      </div>

      <div className="relative">
        <div className="animate-gecko-pulse bg-primary/20 absolute -inset-6 rounded-full blur-2xl" />
        <div className="bg-card border-border shadow-lg relative flex size-28 items-center justify-center rounded-[1.75rem] border">
          <GeckoAnimated className="animate-gecko-hop text-primary size-20" />
        </div>
      </div>

      <div className="flex flex-col items-center gap-1.5">
        <span className="text-xl font-semibold tracking-tight">
          Mail<span className="text-primary">geko</span>
        </span>
        <span className="text-muted-foreground text-sm">{label}</span>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="animate-gecko-dot bg-primary size-1.5 rounded-full" />
        <span className="animate-gecko-dot bg-primary size-1.5 rounded-full [animation-delay:150ms]" />
        <span className="animate-gecko-dot bg-primary size-1.5 rounded-full [animation-delay:300ms]" />
      </div>
    </div>
  );
}

function GeckoAnimated({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 44 38" fill="none" aria-hidden="true" className={className}>
      <g>
        {/* head */}
        <circle cx="12" cy="13" r="7" fill="currentColor" />
        {/* body */}
        <path
          d="M17.5 16.5C24 11.5 33 13.5 35.5 19.5C37.5 24.5 36.5 28.5 32 30.5"
          stroke="currentColor"
          strokeWidth="5.5"
          strokeLinecap="round"
        />
        {/* tail */}
        <g
          className="animate-gecko-tail"
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        >
          <path
            d="M32 30.5C28.5 32.5 25 31.5 25.5 28.5"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </g>
        {/* front foot */}
        <path
          d="M22 21.5C22 24.5 21 26 18 27.5"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
        {/* back foot */}
        <path
          d="M29.5 23.5C30.5 26 31.5 27.5 30.5 30"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
        {/* eye */}
        <circle
          cx="14.2"
          cy="10.5"
          r="1.5"
          fill="var(--card)"
          className="animate-gecko-eye"
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        />
      </g>
    </svg>
  );
}
