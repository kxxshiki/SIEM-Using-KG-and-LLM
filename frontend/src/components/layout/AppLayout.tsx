import { Suspense, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  BarChart3, Bell, Bot, Database, FileText, Fingerprint, LayoutDashboard, LogOut, Menu,
  MessageSquare, Moon, Settings, Shield, ShieldAlert, Sun, type LucideIcon,
} from "lucide-react";
import Brand from "@/components/Brand";
import PageSkeleton from "@/components/PageSkeleton";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/analytics", label: "Analytics", icon: BarChart3, end: false },
  { to: "/threats", label: "Threats", icon: ShieldAlert, end: false },
  { to: "/sources", label: "Sources", icon: Database, end: false },
  { to: "/reports", label: "Reports", icon: FileText, end: false },
  { to: "/indicators", label: "Indicators", icon: Fingerprint, end: false },
  { to: "/alerts", label: "Alerts", icon: Bell, end: false },
  { to: "/socco-pilot", label: "Socco-Pilot", icon: Bot, end: false },
  { to: "/settings", label: "Settings", icon: Settings, end: false },
  { to: "/feedback", label: "Feedback", icon: MessageSquare, end: false },
];

export default function AppLayout() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b bg-card/95 px-4">
        <button
          type="button"
          aria-label="Toggle menu"
          onClick={() => setOpen((o) => !o)}
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Menu size={20} />
        </button>

        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-brand-purple">
            <Shield size={15} className="text-white" />
          </div>
          <Brand className="text-[15px]" />
        </div>

        <div className="flex-1" />

        <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          Live
        </div>

        <button
          type="button"
          onClick={toggle}
          className="flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          {theme === "dark" ? "Light" : "Dark"}
        </button>

        <div className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-primary to-brand-purple text-[11px] font-bold text-white">
            {user?.username?.[0]?.toUpperCase()}
          </div>
          <span className="hidden text-sm font-medium sm:inline">{user?.username}</span>
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary">
            {user?.role}
          </span>
        </div>
      </header>

      {/* Dark overlay behind the open sidebar */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 top-14 z-30 bg-black/50"
          aria-hidden="true"
        />
      )}

      {/* Slide-in sidebar */}
      <aside
        className={cn(
          "fixed bottom-0 left-0 top-14 z-40 flex w-64 flex-col border-r bg-card transition-transform duration-200",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <p className="px-5 pb-2 pt-5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Navigation
        </p>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  isActive
                    ? "bg-primary/10 font-semibold text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )
              }
            >
              <Icon size={16} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t p-3">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-red-500 transition-colors hover:bg-red-500/10"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Page content. The header and sidebar appear at once; the page fills in. */}
      <main className="pt-14">
        <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  );
}