import { Link } from "react-router-dom";
import { Link2, UserCheck, type LucideIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface Item {
  to: string;
  title: string;
  text: string;
  icon: LucideIcon;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const items: Item[] = [
    { to: "/account/connections", title: "Connected accounts", text: "Connect Google or GitHub to sign in with one click.", icon: Link2 },
    ...(user?.role === "admin"
      ? [{ to: "/admin/approvals", title: "Account approvals", text: "Approve or reject people who registered.", icon: UserCheck }]
      : []),
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map(({ to, title, text, icon: Icon }) => (
          <Link key={to} to={to} className="rounded-lg border bg-card p-4 transition-colors hover:border-primary/50">
            <Icon size={18} className="text-primary" aria-hidden="true" />
            <p className="mt-2 font-semibold">{title}</p>
            <p className="text-sm text-muted-foreground">{text}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}