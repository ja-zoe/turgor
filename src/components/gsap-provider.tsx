"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export function GsapProvider({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  return <div ref={ref}>{children}</div>;
}
