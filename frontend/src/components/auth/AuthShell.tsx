import type { ReactNode } from "react";
import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/context/ThemeContext";
import ParticleNetworkBackground from "@/components/auth/ParticleNetworkBackground"; // <-- Import it here

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

const CHIP =
  "flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: Props) {
  const { theme, toggle } = useTheme();

  return (
    <div className="auth-page relative min-h-screen overflow-hidden">
      {/* Render the interactive plexus background here */}
      <ParticleNetworkBackground />

      <div className="absolute right-4 top-4 z-20 flex gap-2">
        <button
          type="button"
          onClick={toggle}
          className={CHIP}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? (
            <Sun size={14} aria-hidden="true" />
          ) : (
            <Moon size={14} aria-hidden="true" />
          )}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
      </div>

      <main className="relative z-10 mx-auto grid min-h-screen w-full max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-2">
        <section className="hidden lg:block">
          <p className="font-serif text-sm font-semibold uppercase tracking-[0.2em] text-brand-purple">
            Threat Radar
          </p>

          <p className="mt-3 font-display text-5xl leading-tight text-foreground xl:text-6xl">
            Hackers move different.
          </p>

          <p className="font-display text-5xl leading-tight text-brand-purple xl:text-6xl">
            So do we.
          </p>

          <p className="mt-6 font-serif text-base uppercase tracking-[0.12em] text-muted-foreground">
            Your digital world, guarded 24/7.
          </p>
        </section>

        <section className="w-full max-w-md justify-self-center rounded-2xl bg-background/70 backdrop-blur-md p-6 lg:justify-self-end shadow-xl border border-border/50">
          <p className="font-serif text-sm font-semibold uppercase tracking-wider">
            SentinelSIEM
          </p>

          <p className="font-serif text-sm uppercase tracking-wider text-muted-foreground">
            Security Intelligence Platform
          </p>

          <p className="mt-3 font-serif text-sm text-brand-purple">
            Your security era starts here.
          </p>

          <h1 className="mt-6 font-serif text-3xl font-medium tracking-tight">
            {title}
          </h1>

          {subtitle && (
            <p className="mt-1 text-sm text-muted-foreground">
              {subtitle}
            </p>
          )}

          <div className="mt-6">{children}</div>

          {footer && (
            <div className="mt-6 text-center text-sm text-muted-foreground">
              {footer}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}