"""Checks email, SMS and OAuth settings without starting the server. Secrets are never printed.

Run it from the backend folder (the one that contains the .env file):
    python -m scripts.check_delivery                  # check settings + SMTP login
    python -m scripts.check_delivery you@example.com  # also send ONE real test email
"""
import os
import smtplib
import ssl
import sys
from email.message import EmailMessage

from app.config import settings
from app.services import delivery_service as delivery


def mask(value: str) -> str:
    return "(empty)" if not value else f"{value[:2]}*** ({len(value)} characters)"


def reply(err) -> str:
    if isinstance(err, bytes):
        err = err.decode(errors="replace")
    return str(err).replace("\n", " ")[:200]


def main() -> int:
    env_path = os.path.abspath(".env")
    print(f".env expected at      : {env_path} (exists: {os.path.exists(env_path)})")
    print(f"ENV                   : {settings.ENV}")
    print(f"DEV_CONSOLE_DELIVERY  : {settings.DEV_CONSOLE_DELIVERY}")
    print(f"SMTP_HOST / PORT      : {settings.SMTP_HOST or '(empty)'} / {settings.SMTP_PORT}")
    print(f"SMTP_USERNAME         : {mask(settings.SMTP_USERNAME)}")
    print(f"SMTP_PASSWORD         : {mask(settings.SMTP_PASSWORD)}")
    print(f"SMTP_FROM             : {settings.SMTP_FROM or '(empty)'}")
    print(f"MSG91_AUTH_KEY        : {mask(settings.MSG91_AUTH_KEY)}")
    print(f"MSG91_TEMPLATE_ID     : {settings.MSG91_TEMPLATE_ID or '(empty)'}")
    print(f"SMS can be sent       : {delivery.sms_configured()}")
    print(f"FRONTEND_URL          : {settings.FRONTEND_URL}")
    print(f"BACKEND_URL           : {settings.BACKEND_URL}")
    print(f"CORS_ORIGINS          : {settings.cors_origins_list}")
    base = settings.BACKEND_URL.rstrip("/")
    for provider in ("google", "github"):
        ready = "configured" if bool(
            getattr(settings, f"{provider.upper()}_CLIENT_ID")
            and getattr(settings, f"{provider.upper()}_CLIENT_SECRET")) else "NOT configured"
        print(f"{provider:<6} OAuth        : {ready}")
        print(f"  redirect URI to register: {base}/api/v1/auth/oauth/{provider}/callback")

    problems = []
    if settings.DEV_CONSOLE_DELIVERY:
        problems.append("DEV_CONSOLE_DELIVERY=true: emails and SMS are only PRINTED in the backend "
                        "terminal, never sent. Set it to false for real delivery.")
    if not settings.SMTP_HOST or not settings.SMTP_FROM:
        problems.append("SMTP_HOST or SMTP_FROM is empty, so no email can be sent.")
    if "example.com" in settings.SMTP_USERNAME or "example.com" in settings.SMTP_FROM:
        problems.append("SMTP settings still contain the example.com placeholder.")
    if not os.path.exists(env_path):
        problems.append("No .env in this folder. Start the backend from the folder that holds it.")

    if settings.SMTP_HOST and not settings.DEV_CONSOLE_DELIVERY:
        use_ssl = settings.SMTP_PORT == 465
        try:
            if use_ssl:
                smtp = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10,
                                        context=ssl.create_default_context())
            else:
                smtp = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
            with smtp:
                if not use_ssl and settings.SMTP_STARTTLS:
                    smtp.starttls(context=ssl.create_default_context())
                if settings.SMTP_USERNAME:
                    smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                print("SMTP connect + login  : OK")
                if len(sys.argv) > 1:
                    msg = EmailMessage()
                    msg["From"], msg["To"] = settings.SMTP_FROM, sys.argv[1]
                    msg["Subject"] = "SentinelSIEM test email"
                    msg.set_content("If you can read this, SMTP delivery works.")
                    smtp.send_message(msg)
                    print(f"Test email sent to    : {sys.argv[1]} (check inbox AND spam)")
        except smtplib.SMTPAuthenticationError as exc:
            problems.append(f"SMTP login refused ({exc.smtp_code}): {reply(exc.smtp_error)}. "
                            "Gmail needs 2-Step Verification plus an App Password.")
        except smtplib.SMTPResponseException as exc:
            problems.append(f"SMTP server refused ({exc.smtp_code}): {reply(exc.smtp_error)}")
        except (smtplib.SMTPException, OSError) as exc:
            problems.append(f"Cannot reach the SMTP server ({type(exc).__name__}). Check host, "
                            "port (587 with STARTTLS, or 465) and your firewall.")

    print()
    if problems:
        print("PROBLEMS FOUND:")
        for p in problems:
            print(f"  - {p}")
        return 1
    print("No problems found in the settings checked.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())