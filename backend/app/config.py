
from functools import lru_cache
from typing import List, Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

INSECURE_SECRETS = {
    "change-this-secret-key",
    "change-this-to-a-long-random-string-before-deploying",
}


class Settings(BaseSettings):
    # Environment: "development" or "production"
    ENV: str = "development"

    DATABASE_URL: str

    NEO4J_URI: str = "bolt://127.0.0.1:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = ""
    NEO4J_DATABASE: str = "neo4j"

    REDIS_ENABLED: bool = False
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    SECRET_KEY: str = "change-this-secret-key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # URLs and CORS
    FRONTEND_URL: str = "http://localhost:5173"
    BACKEND_URL: str = "http://localhost:8000"
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"

    # Dev-only seed users. Disabled by default. Never runs in production.
    SEED_DEFAULT_USERS: bool = False
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = ""
    ANALYST_USERNAME: str = "analyst"
    ANALYST_PASSWORD: str = ""

    # Email (SMTP)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    SMTP_STARTTLS: bool = True

    # SMS (MSG91)
    MSG91_AUTH_KEY: str = ""
    MSG91_TEMPLATE_ID: str = ""  # DLT-approved OTP template
    MSG91_SENDER_ID: str = ""  # DLT-registered sender ID

    # Dev only: print OTP to server console instead of sending SMS/email
    DEV_CONSOLE_DELIVERY: bool = False

    # Verification policy
    OTP_TTL_SECONDS: int = 300
    OTP_MAX_ATTEMPTS: int = 5
    OTP_RESEND_COOLDOWN_SECONDS: int = 60
    EMAIL_LINK_TTL_MINUTES: int = 60
    RESET_TOKEN_TTL_MINUTES: int = 30
    REQUIRE_ADMIN_APPROVAL: bool = True
    PHONE_DEFAULT_REGION: str = "IN"
    PHONE_LOGIN_ENABLED: bool = True

    # OAuth (Google / GitHub). Leave a pair empty to disable that provider.
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""
    OAUTH_STATE_TTL_SECONDS: int = 600

    # Rate limits (per window)
    LOGIN_MAX_ATTEMPTS: int = 5
    LOGIN_WINDOW_SECONDS: int = 300

    # Data visibility scope
    # session = uploads made during the current sign-in
    # user    = all uploads belonging to the signed-in user
    # all     = everything in the database
    DATA_SCOPE: Literal["session", "user", "all"] = "session"

    # Dashboard summary cache duration, in seconds
    SUMMARY_CACHE_SECONDS: int = 30

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def is_production(self) -> bool:
        return self.ENV.lower() == "production"

    @property
    def cors_origins_list(self) -> List[str]:
        return [
            origin.strip()
            for origin in self.CORS_ORIGINS.split(",")
            if origin.strip()
        ]

    @model_validator(mode="after")
    def _enforce_production_safety(self):
        if not self.is_production:
            return self

        problems = []

        if (
            self.SECRET_KEY in INSECURE_SECRETS
            or len(self.SECRET_KEY) < 32
        ):
            problems.append(
                "SECRET_KEY must be a random value of 32+ characters"
            )

        if not self.REDIS_ENABLED:
            problems.append(
                "REDIS_ENABLED must be true (needed for rate limiting)"
            )

        if self.DEV_CONSOLE_DELIVERY:
            problems.append("DEV_CONSOLE_DELIVERY must be false")

        if self.SEED_DEFAULT_USERS:
            problems.append("SEED_DEFAULT_USERS must be false")

        if problems:
            raise ValueError(
                "Unsafe production config: " + "; ".join(problems)
            )

        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
