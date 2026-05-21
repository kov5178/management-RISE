import { useEffect, useRef, useCallback } from "react";
import { toast } from "@/hooks/use-toast";

const DEFAULT_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
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
  timeoutMs?: number;
  onTimeout: () => void;
  onWarning?: () => void;
  onWarningDismiss?: () => void;
}

export function useIdleTimeout({
  enabled,
  timeoutMs = DEFAULT_IDLE_TIMEOUT_MS,
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
  const timeoutMsRef = useRef(timeoutMs);

  useEffect(() => { onTimeoutRef.current = onTimeout; }, [onTimeout]);
  useEffect(() => { onWarningRef.current = onWarning; }, [onWarning]);
  useEffect(() => { onWarningDismissRef.current = onWarningDismiss; }, [onWarningDismiss]);
  useEffect(() => { timeoutMsRef.current = timeoutMs; }, [timeoutMs]);

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
    const currentTimeoutMs = timeoutMsRef.current;
    if (warningActiveRef.current) {
      warningActiveRef.current = false;
      onWarningDismissRef.current?.();
    }
    clearTimers();
    const warningDelay = Math.max(0, currentTimeoutMs - WARNING_BEFORE_MS);
    warningTimerRef.current = setTimeout(() => {
      warningActiveRef.current = true;
      onWarningRef.current?.();
    }, warningDelay);

    timeoutTimerRef.current = setTimeout(() => {
      warningActiveRef.current = false;
      onTimeoutRef.current();
    }, currentTimeoutMs);
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
  timeoutMinutes = 30,
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
      description: `${timeoutMinutes}분 동안 활동이 없어 자동으로 로그아웃되었습니다. 다시 로그인해 주세요.`,
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
