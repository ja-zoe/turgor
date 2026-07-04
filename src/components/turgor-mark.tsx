import { useId } from "react";

/**
 * The Turgor drop mark as an inline SVG (same geometry as public/turgor-logo.svg),
 * colored by theme tokens instead of Forest Floor constants so it harmonizes with
 * any org theme: outline/stem/upper leaf inherit currentColor, the lower leaf reads
 * as a cutout via --background, and the fill/waterline derive from --on-track.
 * The clipPath id comes from useId() — the mark can appear twice on one page
 * (hero + footer) and duplicate SVG ids break clipping.
 */
export function TurgorMark({
  size = 16,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const clipId = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label="Turgor"
      className={className}
    >
      <defs>
        <clipPath id={clipId}>
          <path d="M24 3.5C36 15 36.5 32.5 24 44.5 11.5 32.5 12 15 24 3.5Z" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect x="0" y="26" width="48" height="24" fill="var(--on-track)" />
        <ellipse
          cx="24"
          cy="26"
          rx="16"
          ry="3.4"
          fill="color-mix(in srgb, var(--on-track) 75%, white)"
        />
      </g>
      <path
        d="M24 3.5C36 15 36.5 32.5 24 44.5 11.5 32.5 12 15 24 3.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
      />
      <line
        x1="24"
        y1="9"
        x2="24"
        y2="40"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M24 22 L30 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M24 28 L18 24"
        stroke="var(--background)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
