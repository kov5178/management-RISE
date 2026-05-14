import { useEffect, useRef, useCallback } from "react";
import { toast } from "@/hooks/use-toast";

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "click",
];

interface UseIdleTimeoutOptions {
  enabled: boolean;
  onTimeout: () => void;
}

export function useIdleTimeout({ enabled, onTimeout }: UseIdleTimeoutOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTimeoutRef = useRef(onTimeout);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  const resetTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      onTimeoutRef.current();
    }, IDLE_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    resetTimer();

    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, resetTimer, { passive: true });
    });

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [enabled, resetTimer]);
}

export async function performIdleLogout(navigate: (path: string) => void) {
  try {
    const res = await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    if (!res.ok) {
      console.error("[idle-timeout] Logout request failed with status", res.status);
    }
  } catch (err) {
    console.error("[idle-timeout] Logout request error:", err);
  }

  toast({
    title: "세션이 만료되었습니다",
    description: "30분 동안 활동이 없어 자동으로 로그아웃되었습니다. 다시 로그인해 주세요.",
    variant: "destructive",
  });

  navigate("/login");
}
