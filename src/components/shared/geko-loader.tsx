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

      <div className="loader" />

      <div className="flex flex-col items-center gap-1.5">
        <span className="text-xl font-semibold tracking-tight">
          Mail<span className="text-primary">geko</span>
        </span>
        <span className="text-muted-foreground text-sm">{label}</span>
      </div>
    </div>
  );
}
