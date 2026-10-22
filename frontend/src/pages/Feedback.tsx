import { useState, type FormEvent } from "react";
import { BookOpen, CheckCircle2, LifeBuoy, Loader2, MessagesSquare, Send, ShieldAlert, Star } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const categories = ["Bug Report", "UI/UX Issue", "Alert Mismatch", "Feature Request", "Security Concern", "Other"];

export default function Feedback() {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [category, setCategory] = useState("Bug Report");
  const [reason, setReason] = useState("");
  const [username, setUsername] = useState(user?.username ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSubmitted(false);
    setBusy(true);
    try {
      await api.post("/feedback", { username, email, rating, category, reason });
      setSubmitted(true);
      setReason("");
    } catch (err) {
      setError(getErrorMessage(err, "Could not submit feedback. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl space-y-7">
      <header className="text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Your voice matters</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Feedback &amp; Support</h1>
        <p className="mt-2 text-lg text-primary">Help us improve your security operations experience.</p>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(260px,0.9fr)]">
        <form onSubmit={(event) => void submit(event)} className="space-y-6 rounded-2xl border border-border bg-card/90 p-5 shadow-xl sm:p-7">
          <section className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">User details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-medium">Username
                <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="e.g., alex_d" maxLength={80} required />
              </label>
              <label className="space-y-2 text-sm font-medium">Email address
                <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="e.g., alex@company.com" maxLength={254} required />
              </label>
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Overall rating</h2>
              <p className="mt-1 text-sm">How would you rate your experience?</p>
            </div>
            <div className="flex items-center gap-1" role="group" aria-label="User experience rating">
              {Array.from({ length: 5 }, (_, index) => {
                const value = index + 1;
                return <button key={value} type="button" aria-label={`${value} star${value === 1 ? "" : "s"}`} aria-pressed={rating === value} onClick={() => setRating(value)} className="rounded-md p-1 text-3xl leading-none transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  <Star className={cn("h-7 w-7", value <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/50")} />
                </button>;
              })}
              {rating > 0 && <span className="ml-2 text-sm text-muted-foreground">{rating} of 5</span>}
            </div>
          </section>

          <fieldset className="space-y-3">
            <legend className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Feedback category</legend>
            <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
              {categories.map((item) => <label key={item} className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="radio" name="category" value={item} checked={category === item} onChange={() => setCategory(item)} className="accent-primary" />{item}
              </label>)}
            </div>
          </fieldset>

          <label className="block space-y-2 text-sm font-medium" htmlFor="feedback-reason">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Main reason</span>
            <span className="block text-sm font-normal text-foreground">Tell us more about your feedback</span>
            <textarea id="feedback-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Describe what happened or what would make the product better…" maxLength={4000} required rows={4} className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            <span className="block text-right text-xs font-normal text-muted-foreground">{reason.length}/4000</span>
          </label>

          {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
          {submitted && <p role="status" className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400"><CheckCircle2 size={16} />Feedback submitted. Thank you for helping us improve.</p>}
          <div className="flex justify-end">
            <Button type="submit" variant="gradient" size="lg" disabled={busy || rating === 0}>
              {busy ? <><Loader2 size={16} className="animate-spin" />Submitting…</> : <><Send size={16} />Submit feedback</>}
            </Button>
          </div>
        </form>

        <aside className="rounded-2xl border border-border bg-card/90 p-5 shadow-xl">
          <h2 className="mb-4 text-base font-semibold">Suggested resources &amp; contact</h2>
          <div className="space-y-4">
            <a href="https://fastapi.tiangolo.com/" target="_blank" rel="noreferrer" className="flex gap-3 rounded-lg p-2 transition hover:bg-accent">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-primary"><BookOpen size={19} /></span>
              <span><strong className="block text-sm">Knowledge base</strong><small className="text-muted-foreground">Read the SIEM API and setup documentation.</small></span>
            </a>
            <a href="https://github.com/" target="_blank" rel="noreferrer" className="flex gap-3 rounded-lg p-2 transition hover:bg-accent">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-primary"><MessagesSquare size={19} /></span>
              <span><strong className="block text-sm">Community forums</strong><small className="text-muted-foreground">Share ideas and discuss security workflows.</small></span>
            </a>
            <a href="mailto:support@siem.local" className="flex gap-3 rounded-lg p-2 transition hover:bg-accent">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-primary"><LifeBuoy size={19} /></span>
              <span><strong className="block text-sm">Contact support</strong><small className="text-muted-foreground">Email the team for help with your account.</small></span>
            </a>
            <div className="flex gap-3 rounded-lg p-2 text-muted-foreground">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-primary"><ShieldAlert size={19} /></span>
              <span><strong className="block text-sm text-foreground">Security concern?</strong><small>Include details, but never submit passwords or secrets.</small></span>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
