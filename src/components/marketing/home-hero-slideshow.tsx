"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { DASHBOARD_AI_ASSISTED_ITEM_REQUEST_ROUTE } from "@/lib/dashboard-items-routes";
import { cn } from "@/lib/utils";

const ROTATE_MS = 60_000;

const HERO_SLIDES = [
  {
    src: "/marketing/hero-scene-3-hd.jpg",
    alt: "Cobalt barrel with sneakers, headphones, and folded towels",
    fit: "object-cover object-[68%_center]",
  },
  {
    src: "/marketing/hero-scene-1-hd.jpg",
    alt: "Cobalt barrel with cartons, sneakers, and a folded sweater",
    fit: "object-cover object-[68%_center]",
  },
  {
    src: "/marketing/hero-scene-2-hd.jpg",
    alt: "Cobalt barrel with towels, detergent, and home goods",
    fit: "object-cover object-[68%_center]",
  },
  {
    src: "/marketing/hero-scene-4-hd.jpg",
    alt: "Cobalt barrel with sneakers, headphones, and boxed tech",
    fit: "object-cover object-[68%_center]",
  },
  {
    src: "/homepage-img-cart2barrel.png",
    alt: "Amani Cart2Barrel path from U.S. stores to packing and overseas shipping",
    fit: "object-contain object-right",
  },
] as const;

/** Full-bleed still-life hero; fades through four banners plus the infographic. */
export function HomeHeroSlideshow() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      setActive((index) => (index + 1) % HERO_SLIDES.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [paused]);

  return (
    <div
      className="relative min-h-[18rem] overflow-hidden rounded-2xl md:min-h-[20rem] lg:min-h-[22rem]"
      role="region"
      aria-roledescription="carousel"
      aria-label="Hero artwork"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setPaused(false);
        }
      }}
    >
      {HERO_SLIDES.map((slide, index) => (
        <Image
          key={slide.src}
          src={slide.src}
          alt={index === active ? slide.alt : ""}
          fill
          priority={index === 0}
          quality={95}
          unoptimized={slide.src.includes("-hd.jpg")}
          sizes="(max-width: 768px) 1600px, 1920px"
          className={cn(
            "bg-[#f2e1d1] [image-rendering:auto] transition-opacity duration-1000 ease-in-out motion-reduce:duration-0",
            slide.fit,
            index === active
              ? "z-[1] opacity-100"
              : "pointer-events-none z-0 opacity-0",
          )}
        />
      ))}
      <div className="absolute inset-y-0 left-0 z-10 flex w-full max-w-xl items-center bg-gradient-to-r from-[#f2e1d1]/90 from-15% to-transparent px-5 py-8 sm:px-8 md:max-w-[42%] md:px-10">
        <div className="space-y-5">
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl lg:text-[3.15rem] lg:leading-[1.08]">
            <span className="block text-[#16323d]">Shop U.S. stores.</span>
            <span className="block text-[#0d7a6c]">Ship by barrel.</span>
          </h1>
          <div>
            <Button
              size="lg"
              className="h-11 rounded-full bg-[#0d7a6c] px-5 text-sm font-semibold text-white hover:bg-[#0d7a6c]/90 sm:h-12 sm:px-6 sm:text-base"
              nativeButton={false}
              render={
                <Link
                  href={DASHBOARD_AI_ASSISTED_ITEM_REQUEST_ROUTE}
                  prefetch={false}
                />
              }
            >
              Get a Quote
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
