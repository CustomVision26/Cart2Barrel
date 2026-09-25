"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { isInternalSiteTrafficPath } from "@/lib/site-traffic";

const DEDUPE_MS = 8_000;

function postPageVisit(path: string, referrer: string | null) {
  void fetch("/api/site-traffic", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, referrer }),
    credentials: "same-origin",
    keepalive: true,
  }).catch(() => {
    /* Ignore network errors; analytics must not break navigation. */
  });
}

/** Records public and dashboard page views; skips admin and API routes. */
export function SiteTrafficTracker() {
  const pathname = usePathname();
  const last = useRef<{ path: string; at: number }>({ path: "", at: 0 });

  useEffect(() => {
    if (!pathname || isInternalSiteTrafficPath(pathname)) return;

    const path = `${window.location.pathname}${window.location.search}`;
    const now = Date.now();
    if (last.current.path === path && now - last.current.at < DEDUPE_MS) {
      return;
    }
    last.current = { path, at: now };

    postPageVisit(path, document.referrer || null);
  }, [pathname]);

  return null;
}
