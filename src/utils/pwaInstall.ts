import { useState, useEffect } from "react";

// Vanilla JavaScript event handling for PWA beforeinstallprompt & appinstalled
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<(state: { hasNativePrompt: boolean; isInstalled: boolean }) => void>();

export function isRunningStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function hasNativeInstallPrompt(): boolean {
  return deferredInstallPrompt !== null;
}

function notifyListeners() {
  const state = {
    hasNativePrompt: hasNativeInstallPrompt(),
    isInstalled: isRunningStandalone(),
  };
  listeners.forEach((listener) => {
    try {
      listener(state);
    } catch (e) {
      console.warn("Error notifying install listener:", e);
    }
  });
}

// Global Vanilla JS listeners attached once at module initialization
if (typeof window !== "undefined") {
  const checkAutoPrompt = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("direct_install") === "true" && deferredInstallPrompt) {
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
        await deferredInstallPrompt.prompt();
        const choice = await deferredInstallPrompt.userChoice;
        if (choice && choice.outcome === "accepted") {
          deferredInstallPrompt = null;
          notifyListeners();
        }
      }
    } catch (err) {
      console.warn("Auto direct install error:", err);
    }
  };

  window.addEventListener("beforeinstallprompt", async (event) => {
    event.preventDefault();
    deferredInstallPrompt = event as BeforeInstallPromptEvent;
    notifyListeners();
    await checkAutoPrompt();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    notifyListeners();
  });
}

export async function triggerNativeInstallPrompt(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferredInstallPrompt) {
    return "unavailable";
  }

  try {
    await deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    if (choice && choice.outcome === "accepted") {
      deferredInstallPrompt = null;
      notifyListeners();
      return "accepted";
    }
    return "dismissed";
  } catch (err) {
    console.warn("Error invoking native install prompt:", err);
    return "unavailable";
  }
}

/**
 * Direct install execution:
 * 1. If native prompt is available: directly invokes native prompt.
 * 2. If running inside preview iframe (where browsers block native prompts):
 *    directly launches the top-level tab with ?direct_install=true.
 */
export async function directInstallApp(): Promise<"prompted" | "opened_tab" | "already_installed" | "unsupported"> {
  if (isRunningStandalone()) {
    return "already_installed";
  }

  if (deferredInstallPrompt) {
    try {
      await deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      if (choice && choice.outcome === "accepted") {
        deferredInstallPrompt = null;
        notifyListeners();
      }
      return "prompted";
    } catch (e) {
      console.warn("Direct install prompt error:", e);
    }
  }

  if (typeof window !== "undefined") {
    const isInIframe = window.self !== window.top;
    if (isInIframe) {
      const targetUrl = new URL(window.location.href);
      targetUrl.searchParams.set("direct_install", "true");
      window.open(targetUrl.toString(), "_blank", "noopener,noreferrer");
      return "opened_tab";
    }
  }

  return "unsupported";
}

// Backward-compatible aliases
export const hasInstallPrompt = hasNativeInstallPrompt;
export const isInstallPromptAvailable = hasNativeInstallPrompt;
export const triggerInstallPrompt = triggerNativeInstallPrompt;

export function usePWAInstallPrompt() {
  const [state, setState] = useState(() => ({
    hasNativePrompt: hasNativeInstallPrompt(),
    isInstalled: isRunningStandalone(),
  }));

  useEffect(() => {
    setState({
      hasNativePrompt: hasNativeInstallPrompt(),
      isInstalled: isRunningStandalone(),
    });

    const handler = (newState: { hasNativePrompt: boolean; isInstalled: boolean }) => {
      setState(newState);
    };

    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  return {
    hasNativePrompt: state.hasNativePrompt,
    isInstalled: state.isInstalled,
    canInstall: !state.isInstalled,
    triggerInstall: triggerNativeInstallPrompt,
    directInstall: directInstallApp,
  };
}
