from datetime import datetime
from app.config import settings
from app.db.postgres import SessionLocal
from app.ml.models.user import User, UserRole, UserStatus

if not settings.SEED_DEFAULT_USERS:
    raise SystemExit(
        "Stopped: SEED_DEFAULT_USERS is false. "
        "Check your local development configuration first."
    )

db = SessionLocal()
try:
    now = datetime.utcnow()

    for username, expected_role in [
        ("admin", UserRole.admin),
        ("analyst", UserRole.analyst),
    ]:
        user = db.query(User).filter(
            User.username == username
        ).with_for_update().first()

        if user is None:
            print(f"{username}: not found; skipped")
            continue

        if user.role != expected_role:
            raise ValueError(
                f"{username}: unexpected role; no changes committed"
            )

        user.status = UserStatus.active.value

        if not user.email_verified_at:
            user.email_verified_at = now

        print(f"{username}: marked active for local development")

    db.commit()
    print("Development account update committed.")
except Exception:
    db.rollback()
    raise
finally:
    db.close()
