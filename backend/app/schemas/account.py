from typing import Optional
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.core.password_policy import password_problems
from app.core.phone import normalize_phone


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=32, pattern=r"^[A-Za-z0-9_.-]+$")
    full_name: Optional[str] = Field(default=None, max_length=120)
    email: EmailStr
    phone: str = Field(max_length=32)
    password: str = Field(max_length=128)
    confirm_password: str = Field(max_length=128)
    email_proof: str = Field(min_length=20, max_length=2000)

    @field_validator("email")
    @classmethod
    def _email_lower(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        return normalize_phone(v)

    @model_validator(mode="after")
    def _passwords(self):
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match")
        problems = password_problems(self.password, username=self.username, email=self.email)
        if problems:
            raise ValueError("; ".join(problems))
        return self
    
    @field_validator("username")
    @classmethod
    def _username_has_letter(cls, v: str) -> str:
        if not any(c.isalpha() for c in v):
            raise ValueError("Username must contain at least one letter")
        return v


class OtpRequest(BaseModel):
    code: str = Field(pattern=r"^\d{6}$")


class TokenRequest(BaseModel):
    token: str = Field(min_length=20, max_length=200)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=20, max_length=200)
    new_password: str = Field(max_length=128)
    confirm_password: str = Field(max_length=128)

    @model_validator(mode="after")
    def _match(self):
        if self.new_password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self


class MessageResponse(BaseModel):
    message: str


class TokenValidity(BaseModel):
    valid: bool


class RegisterResponse(BaseModel):
    message: str
    verification_token: str
    next_step: str


class VerificationStatus(BaseModel):
    status: str
    email_verified: bool
    phone_verified: bool
    email_masked: str
    phone_masked: str
    next_step: str  # verify_email | verify_phone | done


class VerifyResult(BaseModel):
    verified: bool
    next_step: str
    message: str
    
class PendingUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    full_name: Optional[str] = None
    email: str
    phone_e164: Optional[str] = None
    created_at: Optional[datetime] = None


class EmailRequest(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def _lower(cls, v: str) -> str:
        return v.strip().lower()


class SignupCodeVerify(EmailRequest):
    code: str = Field(pattern=r"^\d{6}$")


class EmailProofResponse(BaseModel):
    email_proof: str
    expires_in: int


class PhoneLoginSend(BaseModel):
    phone: str = Field(max_length=32)

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        return normalize_phone(v)


class PhoneLoginVerify(PhoneLoginSend):
    code: str = Field(pattern=r"^\d{6}$")


class AuthOptions(BaseModel):
    google: bool
    github: bool
    phone_login: bool