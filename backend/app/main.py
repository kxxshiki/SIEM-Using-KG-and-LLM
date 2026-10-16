import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Logging configuration
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

# Hide individual investigation INFO logs
logging.getLogger("siem.investigation").setLevel(logging.WARNING)

from app.config import settings
from app.db.postgres import engine, SessionLocal
from app.db.base import Base

# Import all models so SQLAlchemy registers them before create_all()
from app.ml.models.user import User, UserRole
from app.ml.models.audit_log import AuditLog
from app.models.log_entry import LogEntry
from app.models.alert import Alert
from app.models.mitre_technique import MitreTechnique

from app.api.v1 import auth, logs, alerts, ml, mitre, graph, dashboard
from app.core.security import get_password_hash
from app.services import mitre_mapping_service
from app.graph import graph_schema

log = logging.getLogger("siem.startup")

app = FastAPI(
    title="Next-Gen SIEM API",
    version="0.2.0",
)


# CORS: only the origins listed in CORS_ORIGINS, only the methods/headers we use
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


# API Routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(logs.router, prefix="/api/v1")
app.include_router(alerts.router, prefix="/api/v1")
app.include_router(ml.router, prefix="/api/v1")
app.include_router(mitre.router, prefix="/api/v1")
app.include_router(graph.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")


def _seed_dev_users(db) -> None:
    """
    Create development users ONLY when SEED_DEFAULT_USERS=true, the
    environment is not production, and a password is set in .env.
    No password is hardcoded in source code.
    """
    if not settings.SEED_DEFAULT_USERS:
        return
    if settings.is_production:
        log.warning("SEED_DEFAULT_USERS ignored in production")
        return

    seeds = (
        (settings.ADMIN_USERNAME, settings.ADMIN_PASSWORD,
         "admin@siem.local", UserRole.admin),
        (settings.ANALYST_USERNAME, settings.ANALYST_PASSWORD,
         "analyst@siem.local", UserRole.analyst),
    )
    for username, password, email, role in seeds:
        if not password:
            log.warning("No password set for seed user '%s'; skipped", username)
            continue
        if not db.query(User).filter(User.username == username).first():
            db.add(
                User(
                    username=username,
                    email=email,
                    hashed_password=get_password_hash(password),
                    role=role,
                )
            )


@app.on_event("startup")
def on_startup():
    """
    Initialize database tables, optional dev users, and MITRE ATT&CK mappings.
    """
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        _seed_dev_users(db)
        db.commit()

        # Idempotent (safe to run on every startup)
        mitre_mapping_service.seed_mitre_techniques(db)
    except Exception:
        log.exception("Database startup seeding failed unexpectedly")
    finally:
        db.close()

    try:
        graph_schema.setup_constraints()
    except Exception:
        logging.getLogger("siem.graph").exception(
            "Neo4j constraint setup failed unexpectedly at startup"
        )


@app.get("/")
def root():
    return {"message": "Next-Gen SIEM API is running"}


@app.get("/health")
def health():
    return {"status": "ok"}