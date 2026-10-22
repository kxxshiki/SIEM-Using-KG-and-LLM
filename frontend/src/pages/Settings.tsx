import { Link } from "react-router-dom";
import { ArrowRight, KeyRound, Link2, Shield, UserRound, type LucideIcon } from "lucide-react";

const items: { to: string; title: string; text: string; icon: LucideIcon }[] = [
  { to: "/settings/security", title: "Password and security", text: "Change your password and review sign-in sessions.", icon: Shield },
  { to: "/account/connections", title: "Connected experiences", text: "Review Google and GitHub connections.", icon: Link2 },
  { to: "/settings/information", title: "Your information and permissions", text: "View your account details and access level.", icon: KeyRound },
  { to: "/settings/sessions", title: "Manage accounts", text: "See where your account is currently signed in.", icon: UserRound },
];

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 py-4">
      <header className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Account preference</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Secure your world, one tap at a time</h1>
      </header>
      <div className="overflow-hidden rounded-2xl border border-border/80 bg-card/80 shadow-xl shadow-primary/10 backdrop-blur-md">
        {items.slice(0, 3).map(({ to, title, text, icon: Icon }, index) => (
          <Link key={to} to={to} className={`group flex items-center gap-4 px-4 py-4 transition-colors hover:bg-accent/70 sm:px-5 ${index ? "border-t border-border/70" : ""}`}>
            <Icon size={22} className="shrink-0 text-primary" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{title}</span>
              <span className="block text-sm text-muted-foreground">{text}</span>
            </span>
            <ArrowRight size={20} className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" aria-hidden="true" />
          </Link>
        ))}
      </div>
      {items.slice(3).map(({ to, title, text, icon: Icon }) => (
        <Link key={to} to={to} className="group flex items-center gap-4 rounded-2xl border border-border/80 bg-card/80 px-4 py-4 shadow-lg shadow-primary/10 backdrop-blur-md transition-colors hover:bg-accent/70 sm:px-5">
          <Icon size={22} className="shrink-0 text-primary" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{title}</span>
            <span className="block text-sm text-muted-foreground">{text}</span>
          </span>
          <ArrowRight size={20} className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </Link>
      ))}
    </div>
  );
}
