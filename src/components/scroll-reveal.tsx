"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface ScrollRevealProps {
  children: React.ReactNode;
}

export function ScrollReveal({ children }: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mm = gsap.matchMedia();
    const container = ref.current;
    if (!container) return;

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      // Reveal sections
      const sections = container.querySelectorAll("section, .reveal");
      sections.forEach((el) => {
        gsap.from(el, {
          y: 12,
          opacity: 0,
          duration: 0.6,
          ease: "power3.out",
          scrollTrigger: {
            trigger: el,
            start: "top 88%",
            once: true,
          },
        });
      });

      // Staggered cards / list rows
      const grids = container.querySelectorAll("[data-stagger]");
      grids.forEach((grid) => {
        const children = grid.children;
        gsap.from(children, {
          y: 8,
          opacity: 0,
          duration: 0.45,
          ease: "power2.out",
          stagger: 0.07,
          scrollTrigger: {
            trigger: grid,
            start: "top 90%",
            once: true,
          },
        });
      });
    });

    return () => {
      mm.revert();
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  return <div ref={ref}>{children}</div>;
}
