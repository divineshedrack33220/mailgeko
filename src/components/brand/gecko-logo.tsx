import { cn } from "@/lib/utils";
import { GeckoMark } from "@/components/brand/gecko-mark";

interface GeckoLogoProps {
  className?: string;
  markClassName?: string;
  subtitle?: string;
}

export function GeckoLogo({ className, markClassName, subtitle }: GeckoLogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "bg-primary/10 text-primary flex size-9 items-center justify-center rounded-xl",
          markClassName
        )}
      >
        <GeckoMark className="size-6" />
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[1.05rem] font-semibold tracking-tight">
          Mail<span className="text-primary">geko</span>
        </span>
        {subtitle && (
          <span className="text-muted-foreground mt-0.5 text-[0.7rem]">
            {subtitle}
          </span>
        )}
      </span>
    </div>
  );
}
