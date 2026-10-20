
import logging
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.postgres import engine, SessionLocal
from app.db.base import Base

# Import models before create_all() so SQLAlchemy registers their tables.
from app.ml.models.user import User, UserRole
from app.ml.models.audit_log import AuditLog  # noqa: F401
from app.models.auth_challenge import AuthChallenge  # noqa: F401
from app.models.log_entry import LogEntry  # noqa: F401
from app.models.alert import Alert  # noqa: F401
from app.models.mitre_technique import MitreTechnique  # noqa: F401
from app.models.signup_email_code import SignupEmailCode  # noqa: F401
from app.models.oauth_identity import OAuthIdentity  # noqa: F401

from app.api.v1 import auth, auth_otp, logs, alerts, ml, mitre, graph, dashboard, oauth
from app.core.security import get_password_hash
from app.services import mitre_mapping_service, oauth_service
from app.graph import graph_schema

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

logging.getLogger("siem.investigation").setLevel(logging.WARNING)
log = logging.getLogger("siem.startup")

app = FastAPI(
    title="Next-Gen SIEM API",
    version="0.2.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# Register each router exactly once.
app.include_router(auth.router, prefix="/api/v1")
app.include_router(auth_otp.router, prefix="/api/v1")
app.include_router(logs.router, prefix="/api/v1")
app.include_router(alerts.router, prefix="/api/v1")
app.include_router(ml.router, prefix="/api/v1")
app.include_router(mitre.router, prefix="/api/v1")
app.include_router(graph.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(oauth.router, prefix="/api/v1")


def _seed_dev_users(db) -> None:
    """
    Create local development accounts only when explicitly enabled.

    Seed accounts are never created in production.
    Verification timestamps are set only for newly created
    development accounts. Existing accounts are left unchanged.
    """
    if not settings.SEED_DEFAULT_USERS:
        return

    if settings.is_production:
        log.warning(
            "Development user seeding is disabled in production"
        )
        return

    seeds = (
        (
            settings.ADMIN_USERNAME,
            settings.ADMIN_PASSWORD,
            "admin@siem.local",
            UserRole.admin,
        ),
        (
            settings.ANALYST_USERNAME,
            settings.ANALYST_PASSWORD,
            "analyst@siem.local",
            UserRole.analyst,
        ),
    )

    now = datetime.now(timezone.utc)

    for username, password, email, role in seeds:
        if not username or not password:
            log.warning(
                "Missing username/password for development seed; skipped"
            )
            continue

        existing = (
            db.query(User)
            .filter(User.username == username)
            .first()
        )

        if existing:
            log.info(
                "Development seed user '%s' already exists; "
                "no changes made",
                username,
            )
            continue

        user = User(
            username=username,
            email=email,
            hashed_password=get_password_hash(password),
            role=role,
            status="active",
            email_verified_at=now,
            phone_verified_at=now,
        )

        db.add(user)

        log.info(
            "Created development seed user '%s'",
            username,
        )


def _log_oauth_status() -> None:
    for provider in oauth_service.PROVIDERS:
        key = provider.upper()

        if oauth_service.is_configured(provider):
            log.info(
                "OAuth %s configured. Callback URL: %s",
                provider,
                oauth_service.callback_url(provider),
            )
        else:
            log.warning(
                "OAuth %s is not configured. Set %s_CLIENT_ID and "
                "%s_CLIENT_SECRET in your environment.",
                provider,
                key,
                key,
            )


@app.on_event("startup")
def on_startup() -> None:
    """Initialize tables and optional development integrations."""
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()

    try:
        _seed_dev_users(db)
        db.commit()
        mitre_mapping_service.seed_mitre_techniques(db)

    except Exception:
        db.rollback()
        log.exception(
            "Database startup initialization failed"
        )
        raise

    finally:
        db.close()

    try:
        graph_schema.setup_constraints()

    except Exception:
        # Neo4j is optional; PostgreSQL-backed API routes
        # should remain usable.
        logging.getLogger("siem.graph").exception(
            "Neo4j initialization failed; "
            "graph features may be unavailable"
        )

    _log_oauth_status()


@app.get("/")
def root():
    return {
        "message": "Next-Gen SIEM API is running"
    }


@app.get("/health")
def health():
    return {
        "status": "ok"
    }
