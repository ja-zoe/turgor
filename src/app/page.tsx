"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  Leaf,
  CalendarCheck,
  ChartBar,
  UsersThree,
  ArrowRight,
  Warning,
  CheckCircle,
} from "@phosphor-icons/react";
import Link from "next/link";

gsap.registerPlugin(ScrollTrigger);

const features = [
  {
    icon: CalendarCheck,
    title: "Weekly check-ins",
    body: "Leads submit structured project standings before each meeting. Timestamped, always allowed — visibly marked late if past the window.",
  },
  {
    icon: Warning,
    title: "Auto red-flag detection",
    body: "Projects are flagged Behind when they slip past configurable milestone thresholds or miss weekly goals in a row.",
  },
  {
    icon: ChartBar,
    title: "Progress at a glance",
    body: "Goal completion rates, status-over-time strips, and blocker frequency charts — all styled to the forest palette.",
  },
  {
    icon: UsersThree,
    title: "Role-based access",
    body: "Project Leads, Viewers, and a Project Manager with full superset permissions. Custom roles via a PM-managed permission builder.",
  },
  {
    icon: CheckCircle,
    title: "Action item tracking",
    body: "First-class action items with owners, deadlines, and carry-over flagging. Incomplete items visibly roll forward each week.",
  },
  {
    icon: Leaf,
    title: "Semester timeline",
    body: "Deliverables as major milestones, subtasks as assignable steps. Excel export. Acceptance criteria in Markdown with live preview.",
  },
];

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => {
        // Hero entrance
        gsap.from("[data-hero-line]", {
          y: 16,
          opacity: 0,
          duration: 0.7,
          ease: "power3.out",
          stagger: 0.12,
        });

        // Feature grid
        gsap.from("[data-feature-card]", {
          y: 12,
          opacity: 0,
          duration: 0.6,
          ease: "power3.out",
          stagger: 0.08,
          scrollTrigger: {
            trigger: gridRef.current,
            start: "top 85%",
          },
        });
      });
    },
    { scope: heroRef }
  );

  return (
    <div ref={heroRef} className="flex flex-col flex-1">
      {/* Nav */}
      <header className="border-b border-border bg-background/95 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Leaf size={20} weight="fill" className="text-primary" />
            <span className="text-sm font-semibold tracking-tight text-foreground">
              SEED Project Tracker
            </span>
          </div>
          <Link
            href="/dev-login"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-foreground bg-primary px-3 py-1.5 rounded-md hover:bg-primary/80 transition-colors"
          >
            Sign in
            <ArrowRight size={14} weight="bold" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-20 w-full">
        <div className="max-w-2xl">
          <p
            data-hero-line
            className="mono text-muted-foreground uppercase tracking-widest mb-4"
          >
            Students for Environmental &amp; Energy Development · Rutgers
          </p>
          <h1
            data-hero-line
            className="text-5xl text-foreground mb-6"
            style={{ fontFamily: "var(--font-display), Georgia, serif" }}
          >
            Project accountability,
            <br />
            built for the semester.
          </h1>
          <p
            data-hero-line
            className="text-lg text-muted-foreground leading-relaxed mb-10 max-w-xl"
          >
            Structured weekly check-ins, milestone tracking, and early-warning
            signals — so projects stay on course from September through May.
          </p>
          <div data-hero-line className="flex items-center gap-4">
            <Link
              href="/dev-login"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-md text-sm font-medium hover:bg-primary/80 transition-colors"
            >
              Sign in with Rutgers NetID
              <ArrowRight size={14} weight="bold" />
            </Link>
            <span className="mono text-xs text-muted-foreground">
              CAS mock mode active
            </span>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Feature bento grid */}
      <section
        ref={gridRef}
        className="max-w-5xl mx-auto px-6 py-20 w-full"
      >
        <p className="mono text-muted-foreground uppercase tracking-widest mb-3 text-xs">
          What it does
        </p>
        <h2
          className="text-3xl text-foreground mb-12"
          style={{ fontFamily: "var(--font-display), Georgia, serif" }}
        >
          One place for the whole project cycle
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-xl overflow-hidden border border-border">
          {features.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              data-feature-card
              className="bg-card p-7 card-hover group"
            >
              <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center mb-5">
                <Icon size={18} weight="bold" className="text-primary" />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-2 tracking-tight">
                {title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Status badge demo strip */}
      <section className="max-w-5xl mx-auto px-6 pb-20 w-full">
        <div className="rounded-xl border border-border bg-card p-7">
          <p className="mono text-muted-foreground uppercase tracking-widest mb-5 text-xs">
            Project health
          </p>
          <div className="flex flex-wrap gap-3">
            {(
              [
                ["On Track", "status-on-track"],
                ["At Risk", "status-at-risk"],
                ["Behind", "status-behind"],
              ] as const
            ).map(([label, cls]) => (
              <span
                key={label}
                className={`${cls} mono text-xs font-semibold px-3 py-1 rounded-md`}
              >
                {label}
              </span>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-5 leading-relaxed max-w-lg">
            Status is auto-detected against deliverable target dates and missed
            weekly goals. Behind projects require a corrective action plan
            before the status can clear.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border mt-auto">
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Leaf size={14} weight="fill" className="text-muted-foreground" />
            <span className="mono text-xs text-muted-foreground">
              SEED · Rutgers University–New Brunswick
            </span>
          </div>
          <span className="mono text-xs text-muted-foreground">
            Phase 0 scaffold
          </span>
        </div>
      </footer>
    </div>
  );
}
