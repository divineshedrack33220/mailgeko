import { cn } from "@/lib/utils";

interface GeckoMarkProps {
  className?: string;
  /** Color of the gecko body */
  color?: string;
  /** Color of the eye cutout (usually the background) */
  eyeColor?: string;
}

export function GeckoMark({
  className,
  color = "currentColor",
  eyeColor = "var(--background)",
}: GeckoMarkProps) {
  return (
    <svg
      viewBox="0 0 44 38"
      fill="none"
      aria-hidden="true"
      className={cn("size-6", className)}
    >
      {/* head */}
      <circle cx="12" cy="13" r="7" fill={color} />
      {/* body */}
      <path
        d="M17.5 16.5C24 11.5 33 13.5 35.5 19.5C37.5 24.5 36.5 28.5 32 30.5"
        stroke={color}
        strokeWidth="5.5"
        strokeLinecap="round"
      />
      {/* tail */}
      <path
        d="M32 30.5C28.5 32.5 25 31.5 25.5 28.5"
        stroke={color}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      {/* front foot */}
      <path
        d="M22 21.5C22 24.5 21 26 18 27.5"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
      />
      {/* back foot */}
      <path
        d="M29.5 23.5C30.5 26 31.5 27.5 30.5 30"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
      />
      {/* eye */}
      <circle cx="14.2" cy="10.5" r="1.5" fill={eyeColor} />
    </svg>
  );
}
