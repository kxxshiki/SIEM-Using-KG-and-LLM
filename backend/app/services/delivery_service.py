import html
import logging
import smtplib
import ssl
from email.message import EmailMessage
from typing import Tuple

import httpx

from app.config import settings

log = logging.getLogger("siem.delivery")


class DeliveryError(Exception):
    pass


def _dev_console() -> bool:
    return settings.DEV_CONSOLE_DELIVERY and not settings.is_production


def send_email(to: str, subject: str, text: str, html_body: str) -> None:
    if _dev_console():
        # DEVELOPMENT ONLY: prints the message (including codes) to the server console.
        print(f"\n[DEV EMAIL] to={to}\nsubject={subject}\n{text}\n", flush=True)
        return
    if not (settings.SMTP_HOST and settings.SMTP_FROM):
        raise DeliveryError("Email provider is not configured")

    msg = EmailMessage()
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(text)
    msg.add_alternative(html_body, subtype="html")
    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as smtp:
            if settings.SMTP_STARTTLS:
                smtp.starttls(context=ssl.create_default_context())
            if settings.SMTP_USERNAME:
                smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            smtp.send_message(msg)
    except (smtplib.SMTPException, OSError) as exc:
        log.error("SMTP delivery failed: %s", type(exc).__name__)  # never log content
        raise DeliveryError("Email delivery failed") from exc


def send_sms_otp(phone_e164: str, code: str) -> None:
    if _dev_console():
        print(f"\n[DEV SMS] to={phone_e164} otp={code}\n", flush=True)
        return
    if not (settings.MSG91_AUTH_KEY and settings.MSG91_TEMPLATE_ID):
        raise DeliveryError("SMS provider is not configured")

    # MSG91 Flow API. Your DLT-approved template must contain the variable ##otp##.
    # Verify the payload against your MSG91 dashboard; it was not tested with real credentials.
    payload = {
        "template_id": settings.MSG91_TEMPLATE_ID,
        "short_url": "0",
        "recipients": [{"mobiles": phone_e164.lstrip("+"), "otp": code}],
    }
    try:
        resp = httpx.post(
            "https://control.msg91.com/api/v5/flow/",
            headers={"authkey": settings.MSG91_AUTH_KEY, "content-type": "application/json"},
            json=payload, timeout=10,
        )
        data = resp.json() if resp.content else {}
    except (httpx.HTTPError, ValueError) as exc:
        log.error("MSG91 request failed: %s", type(exc).__name__)
        raise DeliveryError("SMS delivery failed") from exc
    if resp.status_code != 200 or data.get("type") != "success":
        log.error("MSG91 rejected the request (HTTP %s)", resp.status_code)
        raise DeliveryError("SMS delivery failed")


def verification_email(name: str, otp: str, link: str) -> Tuple[str, str, str]:
    ttl_min = settings.OTP_TTL_SECONDS // 60
    subject = "Verify your SIEM account"
    text = (
        f"Hello {name},\n\nVerify your email using EITHER method:\n"
        f"1) Click: {link}  (valid {settings.EMAIL_LINK_TTL_MINUTES} minutes)\n"
        f"2) Enter this code: {otp}  (valid {ttl_min} minutes)\n\n"
        "If you did not create this account, ignore this email."
    )
    body = (
        f"<p>Hello {html.escape(name)},</p><p>Verify your email using <b>either</b> method:</p>"
        f'<p>1) <a href="{html.escape(link)}">Verify my email</a> (valid {settings.EMAIL_LINK_TTL_MINUTES} min)</p>'
        f"<p>2) Enter this code: <b style='font-size:20px;letter-spacing:3px'>{otp}</b> (valid {ttl_min} min)</p>"
        "<p>If you did not create this account, ignore this email.</p>"
    )
    return subject, text, body


def reset_email(name: str, link: str) -> Tuple[str, str, str]:
    subject = "Reset your SIEM password"
    text = (
        f"Hello {name},\n\nReset your password: {link}\n"
        f"The link works once and expires in {settings.RESET_TOKEN_TTL_MINUTES} minutes.\n"
        "If you did not request this, ignore this email; your password is unchanged."
    )
    body = (
        f"<p>Hello {html.escape(name)},</p>"
        f'<p><a href="{html.escape(link)}">Reset my password</a></p>'
        f"<p>The link works once and expires in {settings.RESET_TOKEN_TTL_MINUTES} minutes.</p>"
        "<p>If you did not request this, ignore this email.</p>"
    )
    
    def sms_configured() -> bool:
      return _dev_console() or bool(settings.MSG91_AUTH_KEY and settings.MSG91_TEMPLATE_ID)


def signup_code_email(code: str) -> Tuple[str, str, str]:
    ttl_min = settings.OTP_TTL_SECONDS // 60
    subject = "Your SentinelSIEM verification code"
    text = (
        "Verify your email to finish creating your account.\n\n"
        f"Enter this code: {code}  (valid {ttl_min} minutes)\n\n"
        "If you did not request this, ignore this email."
    )
    body = (
        "<p>Verify your email to finish creating your account.</p>"
        f"<p>Enter this code: <b style='font-size:20px;letter-spacing:3px'>{code}</b> (valid {ttl_min} min)</p>"
        "<p>If you did not request this, ignore this email.</p>"
    )
    return subject, text, body


def password_change_confirmation_email(name: str, link: str) -> Tuple[str, str, str]:
    subject = "Confirm your SIEM password change"
    text = (
        f"Hello {name},\n\nConfirm your password change: {link}\n"
        "The link is valid for 15 minutes and works once. "
        "Your password will not change until you confirm.\n\n"
        "If you did not request this, ignore this email."
    )
    body = (
        f"<p>Hello {html.escape(name)},</p>"
        f'<p><a href="{html.escape(link)}">Confirm password change</a></p>'
        "<p>The link is valid for 15 minutes and works once. "
        "Your password will not change until you confirm.</p>"
        "<p>If you did not request this, ignore this email.</p>"
    )
    return subject, text, body


def password_changed_email(name: str) -> Tuple[str, str, str]:
    subject = "Your SIEM password was changed"
    text = (
        f"Hello {name},\n\nYour SIEM account password was changed. "
        "All existing sessions were signed out. If this was not you, "
        "use Forgot password immediately."
    )
    body = (
        f"<p>Hello {html.escape(name)},</p>"
        "<p>Your SIEM account password was changed. All existing sessions were signed out.</p>"
        "<p>If this was not you, use Forgot password immediately.</p>"
    )
    return subject, text, body
