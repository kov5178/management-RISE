import { useEffect, useRef, useCallback } from "react";
import { toast } from "@/hooks/use-toast";

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const WARNING_BEFORE_MS = 5 * 60 * 1000;

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
  onWarning?: () => void;
  onWarningDismiss?: () => void;
}

export function useIdleTimeout({
  enabled,
  onTimeout,
  onWarning,
  onWarningDismiss,
}: UseIdleTimeoutOptions) {
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningActiveRef = useRef(false);

  const onTimeoutRef = useRef(onTimeout);
  const onWarningRef = useRef(onWarning);
  const onWarningDismissRef = useRef(onWarningDismiss);

  useEffect(() => { onTimeoutRef.current = onTimeout; }, [onTimeout]);
  useEffect(() => { onWarningRef.current = onWarning; }, [onWarning]);
  useEffect(() => { onWarningDismissRef.current = onWarningDismiss; }, [onWarningDismiss]);

  const clearTimers = useCallback(() => {
    if (warningTimerRef.current !== null) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (timeoutTimerRef.current !== null) {
      clearTimeout(timeoutTimerRef.current);
      timeoutTimerRef.current = null;
    }
  }, []);

  const resetTimer = useCallback(() => {
    if (warningActiveRef.current) {
      warningActiveRef.current = false;
      onWarningDismissRef.current?.();
    }
    clearTimers();
    warningTimerRef.current = setTimeout(() => {
      warningActiveRef.current = true;
      onWarningRef.current?.();
    }, IDLE_TIMEOUT_MS - WARNING_BEFORE_MS);

    timeoutTimerRef.current = setTimeout(() => {
      warningActiveRef.current = false;
      onTimeoutRef.current();
    }, IDLE_TIMEOUT_MS);
  }, [clearTimers]);

  useEffect(() => {
    if (!enabled) {
      clearTimers();
      warningActiveRef.current = false;
      return;
    }

    resetTimer();

    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, resetTimer, { passive: true });
    });

    return () => {
      clearTimers();
      warningActiveRef.current = false;
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [enabled, resetTimer, clearTimers]);

  return { resetTimer };
}

export async function performIdleLogout(
  navigate: (path: string) => void,
  reason: "timeout" | "manual" = "timeout",
) {
  try {
    const res = await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    if (!res.ok) {
      console.error("[idle-timeout] Logout request failed with status", res.status);
    }
  } catch (err) {
    console.error("[idle-timeout] Logout request error:", err);
  }

  if (reason === "timeout") {
    toast({
      title: "세션이 만료되었습니다",
      description: "30분 동안 활동이 없어 자동으로 로그아웃되었습니다. 다시 로그인해 주세요.",
      variant: "destructive",
    });
  } else {
    toast({
      title: "로그아웃되었습니다",
      description: "다시 로그인해 주세요.",
    });
  }

  navigate("/login");
}
