import re
from typing import List

_COMMON_STEMS = {
    "password", "passw0rd", "qwerty", "qwertyuiop", "welcome", "admin", "administrator",
    "letmein", "iloveyou", "monkey", "dragon", "football", "baseball", "abc",
    "changeme", "secret", "login", "siem", "analyst", "master", "sunshine",
}


def password_problems(password: str, *, username: str = "", email: str = "") -> List[str]:
    p: List[str] = []
    if len(password) < 12:
        p.append("At least 12 characters")
    if len(password) > 128:
        p.append("At most 128 characters")
    if not re.search(r"[A-Z]", password):
        p.append("At least one uppercase letter")
    if not re.search(r"[a-z]", password):
        p.append("At least one lowercase letter")
    if not re.search(r"\d", password):
        p.append("At least one digit")
    if not re.search(r"[^A-Za-z0-9]", password):
        p.append("At least one special character")

    # Block guessable passwords like "Password1234!" and passwords containing your own name.
    norm = re.sub(r"[^a-z0-9]", "", password.lower())
    stem = re.sub(r"\d+$", "", norm)
    if stem in _COMMON_STEMS:
        p.append("Too common; avoid well-known passwords")
    for ident in (username, email.split("@")[0] if email else ""):
        if len(ident) >= 3 and ident.lower() in password.lower():
            p.append("Must not contain your username or email name")
            break
    return p