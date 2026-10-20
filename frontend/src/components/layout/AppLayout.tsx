
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Bell,
  LayoutDashboard,
  Link2,
  LogOut,
  Menu,
  Moon,
  Shield,
  Sun,
  Upload,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
import Brand from "@/components/Brand";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end: boolean;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/alerts", label: "Alerts", icon: Bell, end: false },
  { to: "/upload", label: "Upload Logs", icon: Upload, end: false },
  {
    to: "/account/connections",
    label: "Connected accounts",
    icon: Link2,
    end: false,
  },
  {
    to: "/admin/approvals",
    label: "Approvals",
    icon: UserCheck,
    end: false,
    adminOnly: true,
  },
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
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b bg-card/90 px-4 backdrop-blur">
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
          <span className="text-[15px] font-bold tracking-tight">
            SIEM
            <span className="bg-gradient-to-r from-primary to-brand-purple bg-clip-text text-transparent">
              .ai
            </span>
          </span>
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
          <span className="hidden text-sm font-medium sm:inline">
            {user?.username}
          </span>
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary">
            {user?.role}
          </span>
        </div>
      </header>

      {/* Dark overlay behind the open sidebar */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 top-14 z-30 bg-black/50 backdrop-blur-sm"
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

        <nav className="flex-1 space-y-1 px-3">
          {NAV_ITEMS.filter(
            (item) => !item.adminOnly || user?.role === "admin"
          ).map(({ to, label, icon: Icon, end }) => (
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
              <Icon size={16} />
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

      {/* Page content — full width, centred */}
      <main className="pt-14">
        <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
