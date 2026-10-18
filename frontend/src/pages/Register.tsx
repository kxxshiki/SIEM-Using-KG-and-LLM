import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthShell from "@/components/auth/AuthShell";
import PasswordField from "@/components/auth/PasswordField";
import PasswordRulesInfo from "@/components/auth/PasswordRulesInfo";
import PhoneField from "@/components/auth/PhoneField";
import VerificationSteps from "@/components/auth/VerificationSteps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_COUNTRY, toE164, type CountryCode } from "@/lib/countries";
import { evaluatePassword, PASSWORD_RULES_MESSAGE } from "@/lib/passwordPolicy";
import { registerAccount, setVerificationToken, toProblem } from "@/lib/authApi";

type FieldKey = "fullName" | "username" | "email" | "phone" | "password" | "confirm";
type FormState = Record<FieldKey, string>; // "phone" holds the national digits only

const IDS: Record<FieldKey, string> = {
  fullName: "reg-fullname",
  username: "reg-username",
  email: "reg-email",
  phone: "reg-phone",
  password: "reg-password",
  confirm: "reg-confirm",
};
const ORDER: FieldKey[] = ["fullName", "username", "email", "phone", "password", "confirm"];

function validate(f: FormState, country: CountryCode): Partial<Record<FieldKey, string>> {
  const e: Partial<Record<FieldKey, string>> = {};
  if (f.fullName.length > 120) e.fullName = "Name is too long.";
  if (!/^[A-Za-z0-9_.-]{3,32}$/.test(f.username.trim()))
    e.username = "3-32 characters: letters, numbers, dot, dash or underscore.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = "Enter a valid email address.";
  if (!toE164(country, f.phone)) e.phone = "Enter a valid phone number for the selected country.";
  if (!f.password) e.password = "Enter a password.";
  else if (!evaluatePassword(f.password, f.username).allMet) e.password = PASSWORD_RULES_MESSAGE;
  if (f.confirm !== f.password) e.confirm = "Passwords do not match.";
  return e;
}

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>({
    fullName: "", username: "", email: "", phone: "", password: "", confirm: "",
  });
  const [country, setCountry] = useState<CountryCode>(DEFAULT_COUNTRY);
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const busy = useRef(false);

  const errors = useMemo(() => validate(form, country), [form, country]);
  const shown = (k: FieldKey) => (submitted || touched[k] ? errors[k] : undefined);
  const onText = (k: FieldKey) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const onBlur = (k: FieldKey) => () => setTouched((t) => ({ ...t, [k]: true }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy.current) return;
    setFormError("");
    setSubmitted(true);

    const firstBad = ORDER.find((k) => errors[k]);
    if (firstBad) {
      document.getElementById(IDS[firstBad])?.focus();
      return;
    }
    const phone = toE164(country, form.phone); // country code is added here, automatically
    if (!phone) return;

    busy.current = true;
    setSubmitting(true);
    try {
      const res = await registerAccount({
        username: form.username.trim(),
        full_name: form.fullName.trim() || undefined,
        email: form.email.trim(),
        phone,
        password: form.password,
        confirm_password: form.confirm,
      });
      setVerificationToken(res.verification_token);
      navigate("/verify", { replace: true, state: { emailSent: res.email_sent } });
    } catch (err) {
      setFormError(toProblem(err, "Could not create the account. Please try again.").message);
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  };

  const textField = (
    k: "fullName" | "username" | "email",
    label: string,
    opts: { type?: string; autoComplete?: string } = {}
  ) => {
    const err = shown(k);
    const errId = `${IDS[k]}-error`;
    return (
      <div className="space-y-1.5">
        <Label htmlFor={IDS[k]}>{label}</Label>
        <Input
          id={IDS[k]}
          type={opts.type ?? "text"}
          autoComplete={opts.autoComplete}
          autoCapitalize="none"
          spellCheck={false}
          value={form[k]}
          onChange={onText(k)}
          onBlur={onBlur(k)}
          disabled={submitting}
          aria-invalid={err ? true : undefined}
          aria-describedby={err ? errId : undefined}
        />
        {err && <p id={errId} role="alert" className="text-xs text-red-600 dark:text-red-400">{err}</p>}
      </div>
    );
  };

  return (
    <AuthShell
      title="Create account"
      subtitle="Your account is activated after three steps."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link>
        </>
      }
    >
      <VerificationSteps />
      {formError && (
        <div role="alert" className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {textField("fullName", "Full name (optional)", { autoComplete: "name" })}
        {textField("username", "Username", { autoComplete: "username" })}
        {textField("email", "Email address", { type: "email", autoComplete: "email" })}

        <PhoneField
          id={IDS.phone}
          country={country}
          national={form.phone}
          onCountryChange={setCountry}
          onNationalChange={(digits) => setForm((f) => ({ ...f, phone: digits }))}
          onBlur={onBlur("phone")}
          error={shown("phone")}
          disabled={submitting}
        />

        <PasswordField
          id={IDS.password}
          label="Password"
          value={form.password}
          onChange={(v) => setForm((f) => ({ ...f, password: v }))}
          onBlur={onBlur("password")}
          autoComplete="new-password"
          error={shown("password")}
          errorAction={
            <PasswordRulesInfo id="reg-password-rules" password={form.password} username={form.username} />
          }
          disabled={submitting}
        />

        <PasswordField
          id={IDS.confirm}
          label="Confirm password"
          value={form.confirm}
          onChange={(v) => setForm((f) => ({ ...f, confirm: v }))}
          onBlur={onBlur("confirm")}
          autoComplete="new-password"
          error={shown("confirm")}
          disabled={submitting}
        />

        <Button type="submit" variant="gradient" className="w-full" disabled={submitting}>
          {submitting ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
}