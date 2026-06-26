import Link from "next/link";
import { redirect } from "next/navigation";
import { Sprout } from "lucide-react";
import { auth } from "@/auth";
import { allowedDomains } from "@/lib/env";
import { casMode } from "@/lib/cas";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/");

  const { error } = await searchParams;
  const domains = allowedDomains();
  const mock = casMode() === "mock";

  const errorMessage =
    error === "domain"
      ? "That account isn't in an allowed Rutgers domain."
      : error
        ? "Sign-in failed or was cancelled. Please try again."
        : null;

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      {/* Parchment card floating on the forest floor */}
      <div
        className="panel-light reveal"
        style={{
          width: "100%",
          maxWidth: 420,
          padding: "40px 36px",
          textAlign: "center",
        }}
      >
        {/* Logo mark */}
        <div
          aria-hidden
          style={{
            display: "inline-flex",
            width: 60,
            height: 60,
            borderRadius: 20,
            background: "var(--primary)",
            color: "#fff",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 20,
            boxShadow: "0 8px 24px -6px rgba(61, 112, 85, 0.45)",
          }}
        >
          <Sprout size={30} />
        </div>

        <h1
          className="display"
          style={{ fontSize: 26, marginBottom: 8, color: "var(--text)" }}
        >
          SEED Project Tracker
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-soft)", lineHeight: 1.65, marginBottom: 28 }}>
          Weekly check-ins, milestones, and project health for the Rutgers SEED
          club. Sign in with your NetID to continue.
        </p>

        {errorMessage && (
          <div
            style={{
              background: "var(--behind-tint)",
              border: "1px solid rgba(212, 90, 74, 0.35)",
              borderRadius: 14,
              padding: "10px 14px",
              marginBottom: 20,
              color: "var(--behind)",
              fontSize: 13,
            }}
          >
            {errorMessage}
          </div>
        )}

        <Link
          href="/api/cas/login"
          prefetch={false}
          className="btn btn-primary btn-lg"
          style={{ width: "100%" }}
        >
          Sign in with NetID
        </Link>

        {(mock || domains.length > 0) && (
          <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 4 }}>
            {mock && (
              <p style={{ fontSize: 12, color: "var(--text-faint)" }}>
                Running in <strong>mock CAS</strong> mode — real Rutgers CAS pending registration.
              </p>
            )}
            {domains.length > 0 && (
              <p style={{ fontSize: 12, color: "var(--text-faint)" }}>
                Restricted to: {domains.join(", ")}
              </p>
            )}
          </div>
        )}

        <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 16, lineHeight: 1.5 }}>
          First time? After signing in you&apos;ll be pending until the Project
          Manager adds you to a project.
        </p>
      </div>
    </main>
  );
}
