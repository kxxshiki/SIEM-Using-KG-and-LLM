import re
from typing import Optional

import phonenumbers


def normalize_phone(raw: str) -> str:
    """Return E.164 (e.g. +919876543210) or raise ValueError. Used at registration."""
    try:
        parsed = phonenumbers.parse(raw.strip(), None)  # country code required
    except phonenumbers.NumberParseException:
        raise ValueError("Enter the phone number with country code, e.g. +919876543210")
    if not phonenumbers.is_valid_number(parsed):
        raise ValueError("Invalid phone number")
    return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)


def normalize_phone_for_login(raw: str, default_region: str) -> Optional[str]:
    """Best-effort E.164 for a login box value. Returns None if it is not a valid phone number."""
    text = raw.strip()
    if not re.fullmatch(r"\+?[\d\s().-]{7,25}", text):
        return None
    try:
        parsed = phonenumbers.parse(text, None if text.startswith("+") else default_region)
    except phonenumbers.NumberParseException:
        return None
    if not phonenumbers.is_valid_number(parsed):
        return None
    return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)