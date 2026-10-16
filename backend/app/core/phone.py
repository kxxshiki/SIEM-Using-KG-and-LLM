import phonenumbers

def normalize_phone(raw: str) -> str:
    """Return E.164 (e.g. +919876543210) or raise ValueError."""
    try:
        parsed = phonenumbers.parse(raw.strip(), None)  # country code required
    except phonenumbers.NumberParseException:
        raise ValueError("Enter the phone number with country code, e.g. +919876543210")
    if not phonenumbers.is_valid_number(parsed):
        raise ValueError("Invalid phone number")
    return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)