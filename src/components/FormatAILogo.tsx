import React, { useState } from "react";

export type FormatAILogoVariant = "icon" | "header" | "full" | "image";

interface FormatAILogoProps {
  variant?: FormatAILogoVariant;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | number;
  className?: string;
  showTagline?: boolean;
  taglineClassName?: string;
  useImageOnly?: boolean;
}

export const FORMAT_AI_BRAND = {
  name: "FormatAI",
  tagline: "Paste. Format. Get Documents.",
  colors: {
    terracotta: "#C45525",
    terracottaLight: "#D96838",
    terracottaDark: "#9E3C14",
    espresso: "#23150D",
    cream: "#FAF4EE",
    creamDark: "#EDE2D4",
  },
};

/**
 * Precision brand icon rendering the official 3D dual-sheet fold mark.
 * Defaults to the crisp extracted asset (/format-ai-icon-transparent.png)
 * with instant fallback to a precision SVG geometry if the image fails.
 */
export const FormatAIIcon: React.FC<{
  size?: "xs" | "sm" | "md" | "lg" | "xl" | number;
  className?: string;
  preferSvg?: boolean;
}> = ({ size = "md", className = "", preferSvg = false }) => {
  const [imageError, setImageError] = useState(false);

  let dimension = 36;
  if (typeof size === "number") {
    dimension = size;
  } else {
    switch (size) {
      case "xs":
        dimension = 20;
        break;
      case "sm":
        dimension = 28;
        break;
      case "md":
        dimension = 36;
        break;
      case "lg":
        dimension = 48;
        break;
      case "xl":
        dimension = 64;
        break;
    }
  }

  // Use the transparent high-res brand render if not preferSvg and image hasn't errored
  if (!preferSvg && !imageError) {
    return (
      <img
        src="/format-ai-icon-transparent.png"
        alt="FormatAI Icon"
        width={dimension}
        height={dimension}
        style={{ width: `${dimension}px`, height: `${dimension}px` }}
        className={`shrink-0 select-none object-contain drop-shadow-sm transition-transform duration-200 ${className}`}
        loading="eager"
        referrerPolicy="no-referrer"
        onError={() => setImageError(true)}
      />
    );
  }

  // High-fidelity SVG vector fallback matching the clay folded document mark
  return (
    <svg
      width={dimension}
      height={dimension}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none transition-transform duration-200 ${className}`}
      aria-label="FormatAI Official Brand Icon"
    >
      <defs>
        <filter id="doc-shadow-filter" x="-15%" y="-10%" width="135%" height="135%" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="2.5" stdDeviation="3" floodColor="#000" floodOpacity="0.18" />
        </filter>
        <linearGradient id="terracotta-sheet-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#CF5D2A" />
          <stop offset="100%" stopColor="#9E3C14" />
        </linearGradient>
        <linearGradient id="cream-sheet-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FAF5EE" />
          <stop offset="100%" stopColor="#EDE2D3" />
        </linearGradient>
        <linearGradient id="fold-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#DE6C37" />
          <stop offset="100%" stopColor="#A84318" />
        </linearGradient>
      </defs>

      {/* Back Document Sheet (Terracotta / Clay Orange) */}
      <rect
        x="18"
        y="22"
        width="52"
        height="62"
        rx="14"
        fill="url(#terracotta-sheet-grad)"
      />

      {/* Front Document Sheet (Cream Parchment with folded flap) */}
      <g filter="url(#doc-shadow-filter)">
        <path
          d="M 32 14
             L 58 14
             L 78 34
             L 78 72
             A 14 14 0 0 1 64 86
             L 46 86
             A 14 14 0 0 1 32 72
             Z"
          fill="url(#cream-sheet-grad)"
        />

        {/* Soft shadow under fold */}
        <path
          d="M 58 14
             L 58 28
             A 6 6 0 0 0 64 34
             L 78 34
             Z"
          fill="#542310"
          opacity="0.18"
        />

        {/* Folded corner flap with gentle curled curve */}
        <path
          d="M 58 14
             C 58.5 24, 63 32.5, 78 34
             L 64 34
             A 6 6 0 0 1 58 28
             Z"
          fill="url(#fold-grad)"
        />
      </g>
    </svg>
  );
};

export const FormatAILogo: React.FC<FormatAILogoProps> = ({
  variant = "header",
  size = "md",
  className = "",
  showTagline = true,
  taglineClassName = "",
}) => {
  if (variant === "icon") {
    return <FormatAIIcon size={size} className={className} />;
  }

  if (variant === "image") {
    return (
      <div className={`inline-flex flex-col items-center justify-center ${className}`}>
        <img
          src="/brand-logo-trimmed.png"
          alt="FormatAI — Paste. Format. Get Documents."
          referrerPolicy="no-referrer"
          className="max-w-full h-auto max-h-48 object-contain rounded-xl shadow-xs"
          onError={(e) => {
            // Fallback to transparent or full logo lockup
            const target = e.target as HTMLImageElement;
            if (target.src.includes("brand-logo-trimmed.png")) {
              target.src = "/brand-logo-transparent.png";
            } else {
              target.style.display = "none";
            }
          }}
        />
      </div>
    );
  }

  if (variant === "full") {
    return (
      <div className={`flex flex-col items-center text-center select-none ${className}`}>
        {/* Brand Mark Icon */}
        <div className="mb-2.5 transform hover:scale-105 transition-transform duration-200 drop-shadow-sm">
          <FormatAIIcon size={typeof size === "number" ? size : size === "xl" ? 84 : 64} />
        </div>

        {/* Logotype: Format (Espresso) + AI (Terracotta) */}
        <div className="flex items-baseline tracking-tight font-serif">
          <span
            className="font-black text-2xl sm:text-3xl lg:text-4xl"
            style={{ color: FORMAT_AI_BRAND.colors.espresso }}
          >
            Format
          </span>
          <span
            className="font-black text-2xl sm:text-3xl lg:text-4xl ml-0.5"
            style={{ color: FORMAT_AI_BRAND.colors.terracotta }}
          >
            AI
          </span>
        </div>

        {/* Tagline with side accent rules */}
        {showTagline && (
          <div className="mt-2.5 flex items-center justify-center gap-2.5 w-full max-w-xs sm:max-w-sm">
            <span
              className="h-[1.5px] flex-1 rounded-full opacity-80"
              style={{ backgroundColor: FORMAT_AI_BRAND.colors.terracotta }}
            />
            <span
              className={`text-[10px] sm:text-[11px] font-serif tracking-widest text-slate-800 uppercase font-semibold whitespace-nowrap ${taglineClassName}`}
            >
              {FORMAT_AI_BRAND.tagline}
            </span>
            <span
              className="h-[1.5px] flex-1 rounded-full opacity-80"
              style={{ backgroundColor: FORMAT_AI_BRAND.colors.terracotta }}
            />
          </div>
        )}
      </div>
    );
  }

  // Default: variant === "header"
  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <FormatAIIcon size={size} className="hover:scale-105 transition-transform" />
      <div className="flex flex-col leading-none">
        <div className="flex items-baseline tracking-tight font-serif">
          <span
            className="font-black text-base sm:text-lg tracking-tight"
            style={{ color: FORMAT_AI_BRAND.colors.espresso }}
          >
            Format
          </span>
          <span
            className="font-black text-base sm:text-lg ml-0.5 tracking-tight"
            style={{ color: FORMAT_AI_BRAND.colors.terracotta }}
          >
            AI
          </span>
        </div>
        {showTagline && (
          <span className={`text-[9px] sm:text-[9.5px] text-slate-500 font-serif tracking-wider uppercase truncate mt-0.5 hidden xl:inline-block ${taglineClassName}`}>
            {FORMAT_AI_BRAND.tagline}
          </span>
        )}
      </div>
    </div>
  );
};
