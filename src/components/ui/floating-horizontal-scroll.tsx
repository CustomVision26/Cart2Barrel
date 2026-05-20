"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

type ScrollMetrics = {
  scrollWidth: number;
  clientWidth: number;
  scrollLeft: number;
};

type BarGeometry = {
  left: number;
  width: number;
};

type RegistryEntry = {
  overflow: boolean;
  visibleRatio: number;
  lastInteraction: number;
};

type FloatingHorizontalScrollProps = {
  children: ReactNode;
  className?: string;
  viewportClassName?: string;
};

const registry = new Map<string, RegistryEntry>();
const listeners = new Set<() => void>();
let activeId: string | null = null;

function pickActiveId(): string | null {
  const now = Date.now();
  let bestId: string | null = null;
  let bestScore = -1;

  for (const [id, entry] of registry) {
    if (!entry.overflow || entry.visibleRatio <= 0) continue;

    const recentInteraction = now - entry.lastInteraction < 2500;
    const score =
      (recentInteraction ? 10_000 : 0) + entry.visibleRatio * 100 + entry.visibleRatio;

    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }

  return bestId;
}

function notifyRegistry() {
  const next = pickActiveId();
  if (next === activeId) return;
  activeId = next;
  listeners.forEach((listener) => listener());
}

function register(id: string) {
  registry.set(id, { overflow: false, visibleRatio: 0, lastInteraction: 0 });
  notifyRegistry();
}

function unregister(id: string) {
  registry.delete(id);
  if (activeId === id) {
    activeId = null;
    notifyRegistry();
  }
}

function updateRegistry(id: string, patch: Partial<RegistryEntry>) {
  const current = registry.get(id);
  if (!current) return;
  registry.set(id, { ...current, ...patch });
  notifyRegistry();
}

function markInteraction(id: string) {
  updateRegistry(id, { lastInteraction: Date.now() });
}

function hasHorizontalOverflow(m: ScrollMetrics): boolean {
  return m.scrollWidth > m.clientWidth + 1;
}

export function FloatingHorizontalScroll({
  children,
  className,
  viewportClassName,
}: FloatingHorizontalScrollProps) {
  const instanceId = useId();
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startScrollLeft: number } | null>(null);
  const viewportDomId = `${instanceId}-viewport`;

  const [metrics, setMetrics] = useState<ScrollMetrics>({
    scrollWidth: 0,
    clientWidth: 0,
    scrollLeft: 0,
  });
  const [barGeometry, setBarGeometry] = useState<BarGeometry>({ left: 0, width: 0 });
  const [showBar, setShowBar] = useState(false);
  const [visibleRatio, setVisibleRatio] = useState(0);
  const [isActive, setIsActive] = useState(false);

  const readMetrics = useCallback((): ScrollMetrics | null => {
    const el = viewportRef.current;
    if (!el) return null;
    return {
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      scrollLeft: el.scrollLeft,
    };
  }, []);

  const sync = useCallback(() => {
    const el = viewportRef.current;
    const next = readMetrics();
    if (!next || !el) return;

    const overflow = hasHorizontalOverflow(next);
    setMetrics(next);
    setShowBar(overflow);

    const rect = el.getBoundingClientRect();
    setBarGeometry({
      left: rect.left,
      width: rect.width,
    });

    updateRegistry(instanceId, { overflow });
  }, [instanceId, readMetrics]);

  useEffect(() => {
    register(instanceId);
    const onActiveChange = () => {
      setIsActive(activeId === instanceId);
    };
    listeners.add(onActiveChange);
    onActiveChange();

    return () => {
      listeners.delete(onActiveChange);
      unregister(instanceId);
    };
  }, [instanceId]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    sync();

    const ro = new ResizeObserver(sync);
    ro.observe(el);
    if (el.firstElementChild) {
      ro.observe(el.firstElementChild);
    }

    const onViewportScroll = () => {
      markInteraction(instanceId);
      sync();
    };

    el.addEventListener("scroll", onViewportScroll, { passive: true });
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, { passive: true });

    const io = new IntersectionObserver(
      ([entry]) => {
        const ratio = entry?.intersectionRatio ?? 0;
        const intersecting = entry?.isIntersecting ?? false;
        const nextRatio = intersecting ? ratio : 0;
        setVisibleRatio(nextRatio);
        updateRegistry(instanceId, { visibleRatio: nextRatio });
        sync();
      },
      { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] },
    );
    io.observe(el);

    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", onViewportScroll);
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync);
      io.disconnect();
    };
  }, [instanceId, sync]);

  const maxScrollLeft = Math.max(0, metrics.scrollWidth - metrics.clientWidth);
  const thumbWidth = Math.max(
    28,
    (metrics.clientWidth / Math.max(metrics.scrollWidth, 1)) * metrics.clientWidth,
  );
  const thumbMaxOffset = Math.max(0, metrics.clientWidth - thumbWidth);
  const thumbOffset =
    maxScrollLeft > 0 ? (metrics.scrollLeft / maxScrollLeft) * thumbMaxOffset : 0;

  const scrollToClientX = useCallback(
    (clientX: number) => {
      const el = viewportRef.current;
      const track = trackRef.current;
      if (!el || !track || maxScrollLeft <= 0) return;

      const rect = track.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      el.scrollLeft = ratio * maxScrollLeft;
    },
    [maxScrollLeft],
  );

  const onViewportPointerEnter = () => {
    markInteraction(instanceId);
  };

  const onTrackPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    markInteraction(instanceId);
    const target = event.target as HTMLElement;
    if (target.dataset.scrollThumb === "true") return;
    scrollToClientX(event.clientX);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onThumbPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    markInteraction(instanceId);
    const el = viewportRef.current;
    if (!el) return;
    dragRef.current = { startX: event.clientX, startScrollLeft: el.scrollLeft };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onBarPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const el = viewportRef.current;
    if (!drag || !el || maxScrollLeft <= 0 || thumbMaxOffset <= 0) return;

    const deltaX = event.clientX - drag.startX;
    const scrollPerPx = maxScrollLeft / thumbMaxOffset;
    el.scrollLeft = Math.min(
      maxScrollLeft,
      Math.max(0, drag.startScrollLeft + deltaX * scrollPerPx),
    );
  };

  const onBarPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const barVisible =
    showBar && visibleRatio > 0 && isActive && barGeometry.width > 0;

  const barPointerHandlers = {
    onPointerMove: onBarPointerMove,
    onPointerUp: onBarPointerUp,
    onPointerCancel: onBarPointerUp,
  };

  return (
    <div className={cn("relative", className)}>
      <div
        id={viewportDomId}
        ref={viewportRef}
        onPointerEnter={onViewportPointerEnter}
        className={cn(
          "overflow-x-auto",
          "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
          viewportClassName,
        )}
      >
        {children}
      </div>

      {barVisible ?
        <div
          role="scrollbar"
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={maxScrollLeft}
          aria-valuenow={Math.round(metrics.scrollLeft)}
          aria-controls={viewportDomId}
          className="pointer-events-none fixed bottom-4 z-40 px-2"
          style={{
            left: barGeometry.left,
            width: barGeometry.width,
          }}
        >
          <div
            ref={trackRef}
            className="pointer-events-auto relative mx-auto h-2.5 max-w-full cursor-pointer rounded-full border border-border/60 bg-background/85 px-1 shadow-lg backdrop-blur-md"
            onPointerDown={onTrackPointerDown}
            {...barPointerHandlers}
          >
            <div
              data-scroll-thumb="true"
              className="absolute top-0.5 h-1.5 cursor-grab rounded-full bg-primary/75 active:cursor-grabbing hover:bg-primary"
              style={{
                width: thumbWidth,
                transform: `translateX(${thumbOffset}px)`,
              }}
              onPointerDown={onThumbPointerDown}
              {...barPointerHandlers}
            />
          </div>
        </div>
      : null}
    </div>
  );
}
