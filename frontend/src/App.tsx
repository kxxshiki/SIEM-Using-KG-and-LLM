import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Alerts from "@/pages/Alerts";
import UploadLogs from "@/pages/UploadLogs";

function FullPageMessage({ text }: { text: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
      {text}
    </div>
  );
}

/** Only lets logged-in users through; everyone else is sent to /login. */
function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) return <FullPageMessage text="Loading…" />;
  if (!user) return <Navigate to="/login" replace />;
  return <AppLayout />;
}

function LoginRoute() {
  const { user, loading } = useAuth();
  if (loading) return <FullPageMessage text="Loading…" />;
  if (user) return <Navigate to="/" replace />;
  return <Login />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/upload" element={<UploadLogs />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}