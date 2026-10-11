import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Moon, Shield, Sun } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { getErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login() {
  const { login } = useAuth();
  const { theme, toggle } = useTheme();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(username, password);
      // On success, <LoginRoute> in App.tsx redirects to the dashboard.
    } catch (err) {
      setError(getErrorMessage(err, "Login failed. Check your username and password."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      {/* soft glow blobs */}
      <div className="pointer-events-none absolute -left-20 top-1/4 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-1/4 h-80 w-80 rounded-full bg-brand-purple/10 blur-3xl" />

      <button
        type="button"
        onClick={toggle}
        className="absolute right-4 top-4 flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        {theme === "dark" ? "Light mode" : "Dark mode"}
      </button>

      <div className="gradient-border relative z-10 w-full max-w-sm rounded-2xl bg-card p-8 shadow-xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-brand-purple shadow-lg shadow-primary/30">
            <Shield size={26} className="text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">
            SIEM<span className="bg-gradient-to-r from-primary to-brand-purple bg-clip-text text-transparent">.ai</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">AI-Powered Threat Detection</p>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <Button type="submit" variant="gradient" className="w-full" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        {/* Only visible while developing (npm run dev). Hidden in a production build. */}
        {import.meta.env.DEV && (
          <p className="mt-5 rounded-md border bg-muted/50 px-3 py-2 text-center font-mono text-[11px] text-muted-foreground">
            dev accounts: admin / admin123 · analyst / analyst123
          </p>
        )}
      </div>
    </div>
  );
}