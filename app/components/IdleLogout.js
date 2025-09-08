"use client";

import { useEffect, useRef, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { toast } from "sonner";

// Inactivity thresholds
const INACTIVITY_LIMIT_MS = 3 * 60 * 1000; // 5 minutes
const WARNING_BEFORE_MS = 60 * 1000; // warn 1 minute before logout
const WARNING_AT_MS = INACTIVITY_LIMIT_MS - WARNING_BEFORE_MS; // 4 minutes
const LAST_ACTIVITY_KEY = "cp_last_activity_v1";

export default function IdleLogout() {
  const { status } = useSession();

  const warningTimeoutRef = useRef(null);
  const logoutTimeoutRef = useRef(null);
  const warningToastIdRef = useRef(null);

  const clearTimers = useCallback(() => {
    if (warningTimeoutRef.current) {
      window.clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }
    if (logoutTimeoutRef.current) {
      window.clearTimeout(logoutTimeoutRef.current);
      logoutTimeoutRef.current = null;
    }
  }, []);

  const dismissWarningToast = useCallback(() => {
    if (warningToastIdRef.current !== null) {
      toast.dismiss(warningToastIdRef.current);
      warningToastIdRef.current = null;
    }
  }, []);

  // Sign out helper needs to be defined before scheduling logic
  const doLogout = useCallback(async () => {
    dismissWarningToast();
    // Redirect back to home after sign out
    await signOut({ redirect: true, callbackUrl: "/" });
  }, [dismissWarningToast]);

  // Schedule warning/logout relative to the provided timestamp.
  // Implement the warning toast inline to avoid TDZ with other callbacks.
  const scheduleTimersFrom = useCallback(
    (lastTs) => {
      const now = Date.now();
      const elapsed = now - lastTs;
      if (elapsed >= INACTIVITY_LIMIT_MS) {
        // Already idle beyond limit
        doLogout();
        return;
      }

      const warnIn = Math.max(WARNING_AT_MS - elapsed, 0);
      const logoutIn = INACTIVITY_LIMIT_MS - elapsed;

      // Show warning (deferred) and setup auto-logout
      warningTimeoutRef.current = window.setTimeout(() => {
        if (warningToastIdRef.current !== null) return;
        const id = toast.warning(
          "You will be logged out in 1 minute due to inactivity.",
          {
            description:
              "Move your mouse, click, scroll, or press any key to stay signed in.",
            duration: WARNING_BEFORE_MS,
            action: {
              label: "Stay signed in",
              onClick: () => {
                // Treat as activity
                dismissWarningToast();
                clearTimers();
                try {
                  localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
                } catch {}
                scheduleTimersFrom(Date.now());
              },
            },
          }
        );
        warningToastIdRef.current = id;
      }, warnIn);

      logoutTimeoutRef.current = window.setTimeout(doLogout, logoutIn);
    },
    [doLogout, clearTimers, dismissWarningToast]
  );
  
  function readLastActivity() {
    try {
      const v = localStorage.getItem(LAST_ACTIVITY_KEY);
      const n = v ? parseInt(v, 10) : NaN;
      return Number.isFinite(n) ? n : Date.now();
    } catch {
      return Date.now();
    }
  }

  const handleActivity = useCallback(() => {
    // Any interaction resets the timers and hides the warning
    if (status !== "authenticated") return;
    dismissWarningToast();
    clearTimers();
    try {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    } catch {}
    scheduleTimersFrom(Date.now());
  }, [status, scheduleTimersFrom, dismissWarningToast, clearTimers]);

  

  useEffect(() => {
    if (status !== "authenticated") {
      // Ensure timers/listeners are removed when unauthenticated
      dismissWarningToast();
      clearTimers();
      return;
    }

    // List of events considered as user activity
    const events = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "click",
      "wheel",
    ];

    events.forEach((evt) => window.addEventListener(evt, handleActivity, { passive: true }));

    // Sync across tabs: when another tab updates activity, reset our timers
    const onStorage = (e) => {
      if (e.key === LAST_ACTIVITY_KEY && e.newValue) {
        const ts = parseInt(e.newValue, 10);
        if (!Number.isNaN(ts)) {
          dismissWarningToast();
          clearTimers();
          scheduleTimersFrom(ts);
        }
      }
    };
    window.addEventListener("storage", onStorage);

    // Initialize timers on mount for authenticated users
    try {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    } catch {}
    const nowTs = Date.now();
    scheduleTimersFrom(nowTs);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleActivity));
      window.removeEventListener("storage", onStorage);
      dismissWarningToast();
      clearTimers();
    };
  }, [status, handleActivity, scheduleTimersFrom, dismissWarningToast, clearTimers]);

  return null;
}
