export interface RuleResult {
  id: string;
  label: string;
  met: boolean;
}

export const PASSWORD_RULES_MESSAGE =
  "Password must be at least 12 characters and contain uppercase and lowercase letters, a number, and a special character. It must not contain your username.";

export function evaluatePassword(password: string, username?: string) {
  const results: RuleResult[] = [
    {
      id: "length",
      label: "At least 12 characters",
      met: password.length >= 12,
    },
    {
      id: "upper",
      label: "One uppercase letter (A-Z)",
      met: /[A-Z]/.test(password),
    },
    {
      id: "lower",
      label: "One lowercase letter (a-z)",
      met: /[a-z]/.test(password),
    },
    {
      id: "digit",
      label: "One number (0-9)",
      met: /\d/.test(password),
    },
    {
      id: "special",
      label: "One special character (for example ! @ # $)",
      met: /[^A-Za-z0-9]/.test(password),
    },
  ];

  if (username !== undefined) {
    const name = username.trim().toLowerCase();
    const containsName =
      name.length >= 3 && password.toLowerCase().includes(name);

    results.push({
      id: "username",
      label: "Does not contain your username",
      met: password.length > 0 && !containsName,
    });
  }

  return {
    results,
    allMet: results.every((rule) => rule.met),
  };
}