import logging
from dataclasses import dataclass
from typing import Optional
from urllib.parse import urlencode

import httpx

from app.config import settings

log = logging.getLogger("siem.oauth")
PROVIDERS = ("google", "github")


class OAuthError(Exception):
    """`code` is a short machine code that the frontend maps to a message."""

    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


@dataclass
class Profile:
    subject: str
    email: Optional[str]
    email_verified: bool
    name: Optional[str]


def callback_url(provider: str) -> str:
    return f"{settings.BACKEND_URL.rstrip('/')}/api/v1/auth/oauth/{provider}/callback"


def _creds(provider: str):
    if provider == "google":
        return settings.GOOGLE_CLIENT_ID, settings.GOOGLE_CLIENT_SECRET
    if provider == "github":
        return settings.GITHUB_CLIENT_ID, settings.GITHUB_CLIENT_SECRET
    return "", ""


def is_configured(provider: str) -> bool:
    cid, secret = _creds(provider)
    return bool(cid and secret)


def authorize_url(provider: str, state: str) -> str:
    cid, _ = _creds(provider)
    if provider == "google":
        return "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode({
            "client_id": cid, "redirect_uri": callback_url(provider), "response_type": "code",
            "scope": "openid email profile", "state": state, "prompt": "select_account",
        })
    return "https://github.com/login/oauth/authorize?" + urlencode({
        "client_id": cid, "redirect_uri": callback_url(provider),
        "scope": "read:user user:email", "state": state,
    })


def _access_token(resp: httpx.Response) -> str:
    if resp.status_code != 200:
        raise OAuthError("provider_error")
    token = resp.json().get("access_token")   # GitHub answers 200 with {"error": ...} on a bad code
    if not token:
        raise OAuthError("provider_error")
    return str(token)


def fetch_profile(provider: str, code: str, need_email: bool = True) -> Profile:
    """Swap the one-time code for the user's profile. Response bodies are never logged."""
    cid, secret = _creds(provider)
    try:
        with httpx.Client(timeout=10, headers={"User-Agent": "siem-oauth/1.0",
                                               "Accept": "application/json"}) as c:
            if provider == "google":
                tok = c.post("https://oauth2.googleapis.com/token", data={
                    "code": code, "client_id": cid, "client_secret": secret,
                    "redirect_uri": callback_url(provider), "grant_type": "authorization_code"})
                info = c.get("https://openidconnect.googleapis.com/v1/userinfo",
                             headers={"Authorization": f"Bearer {_access_token(tok)}"})
                if info.status_code != 200:
                    raise OAuthError("provider_error")
                d = info.json()
                if not d.get("sub"):
                    raise OAuthError("provider_error")
                return Profile(
                    subject=str(d["sub"]),
                    email=(d.get("email") or "").lower() or None,
                    email_verified=d.get("email_verified") in (True, "true"),
                    name=d.get("name"),
                )

            tok = c.post("https://github.com/login/oauth/access_token", data={
                "code": code, "client_id": cid, "client_secret": secret,
                "redirect_uri": callback_url(provider)})
            headers = {"Authorization": f"Bearer {_access_token(tok)}",
                       "Accept": "application/vnd.github+json"}
            me = c.get("https://api.github.com/user", headers=headers)
            if me.status_code != 200:
                raise OAuthError("provider_error")
            u = me.json()
            email, verified = None, False
            if need_email:
                er = c.get("https://api.github.com/user/emails", headers=headers)
                if er.status_code == 200:
                    for item in er.json():
                        if item.get("primary") and item.get("verified"):
                            email, verified = str(item["email"]).lower(), True
                            break
            return Profile(subject=str(u["id"]), email=email, email_verified=verified,
                           name=u.get("name") or u.get("login"))
    except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
        log.error("OAuth provider call failed: %s", type(exc).__name__)
        raise OAuthError("provider_error") from exc