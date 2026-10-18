import type { ReactNode } from "react";
import { Moon, Shield, Sun } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import ParticleNetworkBackground from "@/components/auth/ParticleNetworkBackground";

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export default function AuthShell({ title, subtitle, children, footer }: Props) {
  const { theme, toggle } = useTheme();

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <ParticleNetworkBackground />
      <div className="pointer-events-none absolute -left-20 top-1/4 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-1/4 h-80 w-80 rounded-full bg-brand-purple/10 blur-3xl" />

      <button
        type="button"
        onClick={toggle}
        className="absolute right-4 top-4 z-20 flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {theme === "dark" ? <Sun size={14} aria-hidden="true" /> : <Moon size={14} aria-hidden="true" />}
        {theme === "dark" ? "Light mode" : "Dark mode"}
      </button>

      <main className="relative z-10 flex min-h-screen items-center justify-center px-4 py-16">
        <div className="gradient-border w-full max-w-md rounded-2xl bg-card/95 p-6 shadow-xl backdrop-blur sm:p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-brand-purple shadow-lg shadow-primary/30">
              <Shield size={22} className="text-white" aria-hidden="true" />
            </div>
            <p className="text-lg font-bold tracking-tight">
              SIEM
              <span className="bg-gradient-to-r from-primary to-brand-purple bg-clip-text text-transparent">.ai</span>
            </p>
            <p className="text-xs text-muted-foreground">AI-Powered Threat Detection</p>
          </div>

          <h1 className="text-center text-xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-center text-sm text-muted-foreground">{subtitle}</p>}

          <div className="mt-6">{children}</div>

          {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
        </div>
      </main>
    </div>
  );
}