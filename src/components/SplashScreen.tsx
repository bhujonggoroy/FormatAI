import React, { useEffect, useState } from "react";
import { FormatAILogo } from "./FormatAILogo";

interface SplashScreenProps {
  isAppReady: boolean;
  onFinished?: () => void;
}

const SESSION_STORAGE_KEY = "formatai_session_initialized";

/**
 * Clean, minimal, premium warm-editorial FormatAI initial splash screen.
 * - Reuses existing FormatAI logo asset without modification or distortion.
 * - Displays motto: "Paste. Format. Get Documents."
 * - Appears ONLY when the user initially enters/opens the app for the first time in that browsing session.
 * - NEVER appears on browser refresh, reload, or navigation within the session.
 * - Seamlessly fades out when the application completes initialization.
 * - Session flag is marked BEFORE the splash is removed.
 * - Respects prefers-reduced-motion.
 */
export const SplashScreen: React.FC<SplashScreenProps> = ({
  isAppReady,
  onFinished,
}) => {
  // Determine if splash should be shown for this session
  const [shouldShowSplash] = useState<boolean>(() => {
    try {
      // 1. Check if browser navigation was a reload
      let isReload = false;
      if (typeof window !== "undefined") {
        const navEntries =
          window.performance && performance.getEntriesByType
            ? performance.getEntriesByType("navigation")
            : null;
        if (navEntries && navEntries.length > 0) {
          isReload = (navEntries[0] as PerformanceNavigationTiming).type === "reload";
        } else if (window.performance && window.performance.navigation) {
          isReload = window.performance.navigation.type === 1;
        }

        // 2. Check if session already initialized
        const isSessionInitialized =
          sessionStorage.getItem(SESSION_STORAGE_KEY) === "true";

        if (isReload || isSessionInitialized) {
          // If the early static splash in HTML was visible, ensure it's removed immediately
          const earlyEl = document.getElementById("first-paint-splash");
          if (earlyEl) earlyEl.remove();
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  });

  const [shouldRender, setShouldRender] = useState<boolean>(() => shouldShowSplash);
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);

  useEffect(() => {
    // If not showing splash for this session, remove early splash immediately
    if (!shouldShowSplash) {
      const earlyEl = document.getElementById("first-paint-splash");
      if (earlyEl) earlyEl.remove();
      return;
    }

    if (!isAppReady) return;

    // Critical Requirement:
    // Mark session as initialized in sessionStorage BEFORE fading out,
    // so that if a reload occurs, it never shows the splash again.
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, "true");
    } catch {
      // safe fallback
    }

    // Remove the early static HTML splash once React splash is running
    const earlyEl = document.getElementById("first-paint-splash");
    if (earlyEl) earlyEl.remove();

    // Trigger smooth fade out
    const timer = setTimeout(() => {
      setIsFadingOut(true);
    }, 180);

    return () => clearTimeout(timer);
  }, [isAppReady, shouldShowSplash]);

  const handleTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && isFadingOut) {
      setShouldRender(false);
      onFinished?.();
    }
  };

  if (!shouldShowSplash || !shouldRender) {
    return null;
  }

  return (
    <div
      role="status"
      aria-label="FormatAI is loading"
      aria-live="polite"
      onTransitionEnd={handleTransitionEnd}
      className={`fixed inset-0 z-[100000] flex flex-col items-center justify-center bg-[#FAF7F2] select-none transition-opacity duration-500 ease-out px-4 overflow-hidden ${
        isFadingOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center text-center max-w-sm sm:max-w-md w-full animate-splash-enter motion-reduce:animate-none">
        {/* Existing FormatAI Logo — unchanged */}
        <div className="flex items-center justify-center mb-6">
          <FormatAILogo variant="full" size="xl" showTagline={false} />
        </div>

        {/* Motto: EXACTLY "Paste. Format. Get Documents." */}
        <p
          className="text-base sm:text-lg md:text-xl font-medium tracking-tight text-[#8C3D18]"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          Paste. Format. Get Documents.
        </p>
      </div>
    </div>
  );
};
