import type { ReactNode } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import AppLayout from "@/components/layout/AppLayout";

export function FullPageMessage({ text }: { text: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
      {text}
    </div>
  );
}

/** Only logged-in users get through; everyone else goes to /login. */
export function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) return <FullPageMessage text="Loading…" />;
  if (!user) return <Navigate to="/login" replace />;
  return <AppLayout />;
}

/** Admin-only pages. The backend also enforces this on every admin endpoint. */
export function RequireAdmin() {
  const { user } = useAuth();
  return user?.role === "admin" ? <Outlet /> : <Navigate to="/" replace />;
}

/** Pages like login/register: logged-in users are sent to the dashboard. */
export function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullPageMessage text="Loading…" />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}