import React from "react";

export interface AIProviderTheme {
  id: string;
  name: string;
  badgeLabel: string;
  topBarGradient: string;
  headerBg: string;
  cardBorder: string;
  activeRing: string;
  activeBorder: string;
  switchActiveBg: string;
  badgeStyle: string;
  titleColor: string;
  accentText: string;
  keyBadgeBg: string;
  brandTag: string;
}

export const AI_PROVIDER_THEMES: Record<string, AIProviderTheme> = {
  gemini: {
    id: "gemini",
    name: "Google Gemini",
    badgeLabel: "Google AI",
    topBarGradient: "bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600",
    headerBg: "bg-gradient-to-b from-indigo-50/90 via-blue-50/50 to-white",
    cardBorder: "border-indigo-200 hover:border-indigo-400",
    activeRing: "ring-2 ring-indigo-400/50 shadow-md shadow-indigo-100/50",
    activeBorder: "border-indigo-400",
    switchActiveBg: "bg-indigo-600",
    badgeStyle: "bg-indigo-100 text-indigo-900 border-indigo-200",
    titleColor: "text-indigo-950",
    accentText: "text-indigo-600",
    keyBadgeBg: "bg-indigo-50 text-indigo-800 border-indigo-200",
    brandTag: "Gemini",
  },
  groq: {
    id: "groq",
    name: "Groq",
    badgeLabel: "Groq LPU",
    topBarGradient: "bg-gradient-to-r from-orange-500 via-amber-500 to-red-500",
    headerBg: "bg-gradient-to-b from-orange-50/90 via-amber-50/50 to-white",
    cardBorder: "border-orange-200 hover:border-orange-400",
    activeRing: "ring-2 ring-orange-400/50 shadow-md shadow-orange-100/50",
    activeBorder: "border-orange-400",
    switchActiveBg: "bg-orange-600",
    badgeStyle: "bg-orange-100 text-orange-900 border-orange-200",
    titleColor: "text-orange-950",
    accentText: "text-orange-600",
    keyBadgeBg: "bg-orange-50 text-orange-800 border-orange-200",
    brandTag: "Groq",
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    badgeLabel: "Gateway",
    topBarGradient: "bg-gradient-to-r from-purple-500 via-violet-500 to-indigo-600",
    headerBg: "bg-gradient-to-b from-purple-50/90 via-violet-50/50 to-white",
    cardBorder: "border-purple-200 hover:border-purple-400",
    activeRing: "ring-2 ring-purple-400/50 shadow-md shadow-purple-100/50",
    activeBorder: "border-purple-400",
    switchActiveBg: "bg-purple-600",
    badgeStyle: "bg-purple-100 text-purple-900 border-purple-200",
    titleColor: "text-purple-950",
    accentText: "text-purple-600",
    keyBadgeBg: "bg-purple-50 text-purple-800 border-purple-200",
    brandTag: "OpenRouter",
  },
  mistral: {
    id: "mistral",
    name: "Mistral AI",
    badgeLabel: "Frontier",
    topBarGradient: "bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600",
    headerBg: "bg-gradient-to-b from-amber-50/90 via-orange-50/50 to-white",
    cardBorder: "border-amber-300 hover:border-amber-400",
    activeRing: "ring-2 ring-amber-400/50 shadow-md shadow-amber-100/50",
    activeBorder: "border-amber-400",
    switchActiveBg: "bg-amber-600",
    badgeStyle: "bg-amber-100 text-amber-900 border-amber-300",
    titleColor: "text-amber-950",
    accentText: "text-amber-700",
    keyBadgeBg: "bg-amber-50 text-amber-900 border-amber-200",
    brandTag: "Mistral",
  },
  cohere: {
    id: "cohere",
    name: "Cohere",
    badgeLabel: "Enterprise",
    topBarGradient: "bg-gradient-to-r from-teal-600 via-emerald-600 to-amber-600",
    headerBg: "bg-gradient-to-b from-teal-50/90 via-emerald-50/50 to-white",
    cardBorder: "border-teal-200 hover:border-teal-400",
    activeRing: "ring-2 ring-teal-500/50 shadow-md shadow-teal-100/50",
    activeBorder: "border-teal-400",
    switchActiveBg: "bg-teal-700",
    badgeStyle: "bg-teal-100 text-teal-900 border-teal-200",
    titleColor: "text-teal-950",
    accentText: "text-teal-700",
    keyBadgeBg: "bg-teal-50 text-teal-900 border-teal-200",
    brandTag: "Cohere",
  },
  huggingface: {
    id: "huggingface",
    name: "Hugging Face",
    badgeLabel: "HF Hub",
    topBarGradient: "bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500",
    headerBg: "bg-gradient-to-b from-yellow-50/90 via-amber-50/50 to-white",
    cardBorder: "border-yellow-300 hover:border-yellow-400",
    activeRing: "ring-2 ring-yellow-400/50 shadow-md shadow-yellow-100/50",
    activeBorder: "border-yellow-400",
    switchActiveBg: "bg-amber-500",
    badgeStyle: "bg-yellow-100 text-yellow-950 border-yellow-300 font-bold",
    titleColor: "text-yellow-950",
    accentText: "text-amber-800",
    keyBadgeBg: "bg-yellow-50 text-yellow-900 border-yellow-200",
    brandTag: "HuggingFace",
  },
  cloudflare: {
    id: "cloudflare",
    name: "Cloudflare Workers AI",
    badgeLabel: "Edge Workers",
    topBarGradient: "bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600",
    headerBg: "bg-gradient-to-b from-orange-50/90 via-sky-50/50 to-white",
    cardBorder: "border-orange-200 hover:border-orange-400",
    activeRing: "ring-2 ring-orange-400/50 shadow-md shadow-orange-100/50",
    activeBorder: "border-orange-400",
    switchActiveBg: "bg-orange-500",
    badgeStyle: "bg-orange-100 text-orange-900 border-orange-200",
    titleColor: "text-orange-950",
    accentText: "text-orange-600",
    keyBadgeBg: "bg-orange-50 text-orange-800 border-orange-200",
    brandTag: "Cloudflare",
  },
  custom: {
    id: "custom",
    name: "Custom / Local AI",
    badgeLabel: "Self-Hosted",
    topBarGradient: "bg-gradient-to-r from-slate-600 via-zinc-600 to-slate-800",
    headerBg: "bg-gradient-to-b from-slate-100/90 via-zinc-50/60 to-white",
    cardBorder: "border-slate-300 hover:border-slate-400",
    activeRing: "ring-2 ring-slate-400/50 shadow-md shadow-slate-100/50",
    activeBorder: "border-slate-400",
    switchActiveBg: "bg-slate-700",
    badgeStyle: "bg-slate-100 text-slate-800 border-slate-300",
    titleColor: "text-slate-900",
    accentText: "text-slate-700",
    keyBadgeBg: "bg-slate-100 text-slate-700 border-slate-200",
    brandTag: "Custom",
  },
};

export function getAIProviderTheme(providerId: string): AIProviderTheme {
  const normId = providerId.toLowerCase().trim();
  if (AI_PROVIDER_THEMES[normId]) {
    return AI_PROVIDER_THEMES[normId];
  }
  // Generic fallback
  return {
    id: providerId,
    name: providerId,
    badgeLabel: "AI Provider",
    topBarGradient: "bg-gradient-to-r from-blue-500 to-indigo-600",
    headerBg: "bg-gradient-to-b from-slate-50/90 to-white",
    cardBorder: "border-slate-200 hover:border-slate-300",
    activeRing: "ring-2 ring-blue-400/50 shadow-md",
    activeBorder: "border-blue-400",
    switchActiveBg: "bg-blue-600",
    badgeStyle: "bg-slate-100 text-slate-800 border-slate-200",
    titleColor: "text-slate-900",
    accentText: "text-blue-600",
    keyBadgeBg: "bg-slate-100 text-slate-700 border-slate-200",
    brandTag: providerId.toUpperCase(),
  };
}

interface AIBrandLogoProps {
  providerId: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * High-fidelity, official-style SVG Logo for each AI Provider
 */
export const AIBrandLogo: React.FC<AIBrandLogoProps> = ({
  providerId,
  className = "",
  size = "md",
}) => {
  const normId = providerId.toLowerCase().trim();

  const sizeClasses =
    size === "sm"
      ? "w-4 h-4"
      : size === "lg"
      ? "w-7 h-7"
      : "w-5 h-5";

  switch (normId) {
    case "gemini":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className={`${sizeClasses} ${className} shrink-0`}
          aria-label="Google Gemini Logo"
        >
          <defs>
            <linearGradient id={`gemini-grad-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4285F4" />
              <stop offset="40%" stopColor="#9B72CB" />
              <stop offset="100%" stopColor="#D96570" />
            </linearGradient>
          </defs>
          <path
            d="M12 2C12 7.523 7.523 12 2 12C7.523 12 12 16.477 12 22C12 16.477 16.477 12 22 12C16.477 12 12 7.523 12 2Z"
            fill={`url(#gemini-grad-${size})`}
          />
        </svg>
      );

    case "groq":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className={`${sizeClasses} ${className} shrink-0`}
          aria-label="Groq Logo"
        >
          <rect width="24" height="24" rx="6" fill="#F55036" />
          <path
            d="M6.5 12C6.5 8.96 8.96 6.5 12 6.5C14.1 6.5 15.93 7.68 16.85 9.4L14.2 10.75C13.75 9.8 12.95 9.2 12 9.2C10.45 9.2 9.2 10.45 9.2 12C9.2 13.55 10.45 14.8 12 14.8C13.1 14.8 14 14.15 14.5 13.2H11.8V10.8H17.2V13.8C16.2 16 14.3 17.5 12 17.5C8.96 17.5 6.5 15.04 6.5 12Z"
            fill="white"
          />
        </svg>
      );

    case "openrouter":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className={`${sizeClasses} ${className} shrink-0`}
          aria-label="OpenRouter Logo"
        >
          <rect width="24" height="24" rx="6" fill="#6366F1" />
          <path
            d="M12 4.5L18.5 8.25V15.75L12 19.5L5.5 15.75V8.25L12 4.5Z"
            stroke="white"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12" r="2.2" fill="white" />
          <path
            d="M12 4.5V9.8M12 14.2V19.5M5.5 8.25L10.1 10.9M13.9 13.1L18.5 15.75M18.5 8.25L13.9 10.9M10.1 13.1L5.5 15.75"
            stroke="white"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      );

    case "mistral":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className={`${sizeClasses} ${className} shrink-0`}
          aria-label="Mistral AI Logo"
        >
          <rect width="24" height="24" rx="6" fill="#FF7000" />
          <rect x="5" y="5.5" width="3" height="3" fill="#FFE500" rx="0.5" />
          <rect x="16" y="5.5" width="3" height="3" fill="#FFE500" rx="0.5" />
          <rect x="5" y="8.8" width="3" height="3" fill="#FF5200" rx="0.5" />
          <rect x="8.7" y="8.8" width="3" height="3" fill="#FFE500" rx="0.5" />
          <rect x="12.3" y="8.8" width="3" height="3" fill="#FFE500" rx="0.5" />
          <rect x="16" y="8.8" width="3" height="3" fill="#FF5200" rx="0.5" />
          <rect x="5" y="12.1" width="3" height="3" fill="#DC2626" rx="0.5" />
          <rect x="8.7" y="12.1" width="6.6" height="3" fill="#FF5200" rx="0.5" />
          <rect x="16" y="12.1" width="3" height="3" fill="#DC2626" rx="0.5" />
          <rect x="5" y="15.4" width="3" height="3" fill="#991B1B" rx="0.5" />
          <rect x="16" y="15.4" width="3" height="3" fill="#991B1B" rx="0.5" />
        </svg>
      );

    case "cohere":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className={`${sizeClasses} ${className} shrink-0`}
          aria-label="Cohere Logo"
        >
          <rect width="24" height="24" rx="6" fill="#1C382D" />
          <path
            d="M7 14.5C7 11.46 9.46 9 12.5 9C15.54 9 18 11.46 18 14.5C18 16.43 16.43 18 14.5 18C12.57 18 11 16.43 11 14.5C11 13.67 11.67 13 12.5 13C13.33 13 14 13.67 14 14.5"
            stroke="#D2614B"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <circle cx="12.5" cy="6.5" r="2.2" fill="#FFE58F" />
        </svg>
      );

    case "huggingface":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className={`${sizeClasses} ${className} shrink-0`}
          aria-label="Hugging Face Logo"
        >
          <rect width="24" height="24" rx="6" fill="#FFD21E" />
          {/* Eyes */}
          <circle cx="8.5" cy="11" r="1.4" fill="#202020" />
          <circle cx="15.5" cy="11" r="1.4" fill="#202020" />
          {/* Smile */}
          <path
            d="M9.5 14C10.2 16 13.8 16 14.5 14"
            stroke="#202020"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          {/* Hugging paws */}
          <path
            d="M4.5 12C4 10 5 9 6 10.5L7.5 12.5C6.5 13.5 5 14 4.5 12Z"
            fill="#FFAE00"
            stroke="#202020"
            strokeWidth="0.8"
          />
          <path
            d="M19.5 12C20 10 19 9 18 10.5L16.5 12.5C17.5 13.5 19 14 19.5 12Z"
            fill="#FFAE00"
            stroke="#202020"
            strokeWidth="0.8"
          />
        </svg>
      );

    case "cloudflare":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className={`${sizeClasses} ${className} shrink-0`}
          aria-label="Cloudflare Workers AI Logo"
        >
          <rect width="24" height="24" rx="6" fill="#F38020" />
          <path
            d="M17.5 15.5C18.88 15.5 20 14.38 20 13C20 11.66 18.96 10.56 17.65 10.51C17.23 8.52 15.48 7 13.35 7C11.61 7 10.12 7.99 9.4 9.45C9.02 9.32 8.62 9.25 8.2 9.25C6.43 9.25 5 10.68 5 12.45C5 12.57 5.01 12.69 5.03 12.81C4.42 13.26 4 14 4 14.85C4 16.04 4.96 17 6.15 17H17.5"
            fill="white"
          />
        </svg>
      );

    case "custom":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className={`${sizeClasses} ${className} shrink-0`}
          aria-label="Custom AI Endpoint Logo"
        >
          <rect width="24" height="24" rx="6" fill="#334155" />
          <path
            d="M7 8.5L10.5 12L7 15.5M12.5 15.5H17"
            stroke="#10B981"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    default:
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className={`${sizeClasses} ${className} shrink-0`}
          aria-label="AI Logo"
        >
          <rect width="24" height="24" rx="6" fill="#3B82F6" />
          <circle cx="12" cy="12" r="4" fill="white" />
          <path
            d="M12 4V6M12 18V20M4 12H6M18 12H20"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
  }
};
