const MESSAGES: Record<string, string> = {
  cancelled: "Sign-in was cancelled.",
  invalid_state:
    "This sign-in attempt expired or was not started in this browser. Please try again.",
  provider_error: "Could not complete sign-in with the provider. Please try again.",
  provider_unavailable: "This sign-in option is not configured.",
  no_verified_email:
    "Your provider account has no verified email address, so we cannot create an account.",
  account_exists:
    "An account with this email already exists. Sign in with your password, then connect Google or GitHub from Connected accounts.",
  account_disabled: "This account is disabled.",
  account_not_active: "Your account is not active.",
  rate_limited: "Too many attempts. Please wait a few minutes and try again.",
  link_expired: "The connect request expired. Please try again.",
  already_linked_elsewhere: "That provider account is already connected to a different user.",
  provider_already_connected: "You already connected this provider.",
  try_again: "Something went wrong. Please try again.",
};

export function oauthMessage(code: string): string {
  return MESSAGES[code] ?? MESSAGES.try_again;
}

export const PROVIDER_NAMES: Record<string, string> = { google: "Google", github: "GitHub" };