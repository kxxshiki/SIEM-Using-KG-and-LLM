import pytest

from app.core.password_policy import password_problems
from app.core.phone import normalize_phone

GOOD = "Str0ng!Passphrase#42"


def test_good_password_passes():
    assert password_problems(GOOD) == []


@pytest.mark.parametrize("pw, fragment", [
    ("Sh0rt!Ab", "12 characters"),
    ("alllowercase123!", "uppercase"),
    ("ALLUPPERCASE123!", "lowercase"),
    ("NoDigitsHere!!Abc", "digit"),
    ("NoSpecialChars1234Abc", "special"),
    ("Password1234!", "common"),
    ("A1!" + "a" * 130, "At most 128"),
])
def test_bad_passwords_rejected(pw, fragment):
    assert any(fragment in p for p in password_problems(pw))


def test_password_containing_username_rejected():
    assert any("username" in p for p in password_problems("Alice#Strong99xyz", username="alice"))


def test_phone_normalization_and_rejection():
    assert normalize_phone("+1 415 555 2671") == "+14155552671"
    with pytest.raises(ValueError):
        normalize_phone("4155552671")      # no country code
    with pytest.raises(ValueError):
        normalize_phone("+1000")


def test_indian_number_normalizes():
    # If this fails, replace with a real valid Indian mobile prefix: it means your phonenumbers
    # metadata rejects this sample number, not that normalization is broken.
    assert normalize_phone("+91 98765 43210") == "+919876543210"
