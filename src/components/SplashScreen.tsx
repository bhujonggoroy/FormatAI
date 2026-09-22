import React, { useEffect, useState } from "react";
import { FormatAILogo } from "./FormatAILogo";

interface SplashScreenProps {
  isAppReady: boolean;
  onFinished?: () => void;
}

/**
 * Clean, minimal, premium warm-editorial FormatAI initial splash screen.
 * - Reuses existing FormatAI logo asset without modification or distortion.
 * - Exactly displays motto: "Paste. Format. Get Documents."
 * - Smooth entrance with subtle 98% -> 100% scale and fade-in.
 * - Fades out seamlessly when isAppReady is true.
 * - Respects prefers-reduced-motion.
 * - No horizontal overflow, completely responsive across mobile and desktop.
 */
export const SplashScreen: React.FC<SplashScreenProps> = ({
  isAppReady,
  onFinished,
}) => {
  const [shouldRender, setShouldRender] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    if (!isAppReady) return;

    // Small micro-tick to ensure initial paint before initiating the fade-out
    const timer = setTimeout(() => {
      setIsFadingOut(true);
    }, 150);

    return () => clearTimeout(timer);
  }, [isAppReady]);

  // Once fade-out transition concludes, unmount splash completely from DOM
  const handleTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && isFadingOut) {
      setShouldRender(false);
      onFinished?.();
    }
  };

  if (!shouldRender) return null;

  return (
    <div
      role="status"
      aria-label="FormatAI is loading"
      aria-live="polite"
      onTransitionEnd={handleTransitionEnd}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#FAF7F2] select-none transition-opacity duration-500 ease-out px-4 overflow-hidden ${
        isFadingOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center text-center max-w-sm sm:max-w-md w-full animate-splash-enter motion-reduce:animate-none">
        {/* Existing FormatAI Logo — cleanly presented without distortion or alteration */}
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
