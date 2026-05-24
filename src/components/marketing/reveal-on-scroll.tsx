"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ComponentPropsWithoutRef,
  type ElementType,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

type RevealOnScrollProps<T extends ElementType = "div"> = {
  children: ReactNode;
  className?: string;
  delayMs?: number;
  variant?: "load" | "scroll";
  as?: T;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "className">;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function RevealOnScroll<T extends ElementType = "div">({
  children,
  className,
  delayMs = 0,
  variant = "scroll",
  as,
  ...props
}: RevealOnScrollProps<T>) {
  const Component = (as ?? "div") as ElementType;
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setVisible(true);
      return;
    }

    if (variant === "load") {
      const id = window.setTimeout(() => setVisible(true), delayMs);
      return () => window.clearTimeout(id);
    }

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          window.setTimeout(() => setVisible(true), delayMs);
          observer.disconnect();
        }
      },
      { threshold: 0.14, rootMargin: "0px 0px -6% 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [delayMs, variant]);

  return (
    <Component
      {...props}
      ref={ref}
      className={cn("marketing-reveal", visible && "marketing-reveal--visible", className)}
      style={{ "--reveal-delay": `${delayMs}ms`, ...(props.style as CSSProperties) }}
    >
      {children}
    </Component>
  );
}
