import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Github, Phone } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { getAuthOptions, oauthStartUrl, toProblem, type OAuthProvider } from "@/lib/authApi";
import { cn } from "@/lib/utils";

const NAMES: Record<OAuthProvider, string> = { google: "Google", github: "GitHub" };

function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" width="16" height="16" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export default function OAuthButtons() {
  const [pending, setPending] = useState<OAuthProvider | null>(null);
  const [message, setMessage] = useState("");

  // If the user comes back with the browser Back button, unlock the buttons again.
  useEffect(() => {
    const onShow = () => setPending(null);
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  const go = async (provider: OAuthProvider) => {
    if (pending) return;
    setMessage("");
    setPending(provider);
    try {
      const options = await getAuthOptions(); // fresh answer from the server
      if (!options[provider]) {
        const key = provider.toUpperCase();
        setMessage(
          import.meta.env.DEV
            ? `${NAMES[provider]} sign-in is not configured on the server. Set ${key}_CLIENT_ID and ${key}_CLIENT_SECRET in the backend .env, then restart the backend.`
            : `${NAMES[provider]} sign-in is not available right now.`
        );
        setPending(null);
        return;
      }
      window.location.assign(oauthStartUrl(provider)); // leaves this page
    } catch (err) {
      setMessage(toProblem(err, "Cannot reach the server. Check that the backend is running.").message);
      setPending(null);
    }
  };

  return (
    <div className="mt-5">
      <div className="relative mb-4 text-center text-xs text-muted-foreground">
        <span className="absolute inset-x-0 top-1/2 border-t" aria-hidden="true" />
        <span className="relative bg-background px-2">or continue with</span>
      </div>

      {message && (
        <div role="alert" className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
          {message}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" aria-label="Continue with Google" disabled={pending !== null} onClick={() => void go("google")}>
          <GoogleG />
          {pending === "google" ? "Redirecting…" : "Google"}
        </Button>
        <Button type="button" variant="outline" aria-label="Continue with GitHub" disabled={pending !== null} onClick={() => void go("github")}>
          <Github size={16} aria-hidden="true" />
          {pending === "github" ? "Redirecting…" : "GitHub"}
        </Button>
      </div>

      <Link to="/login/phone" className={cn(buttonVariants({ variant: "outline" }), "mt-2 w-full")}>
        <Phone size={16} aria-hidden="true" />
        Continue with mobile number
      </Link>
    </div>
  );
}