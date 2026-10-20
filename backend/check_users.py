from app.db.postgres import SessionLocal
from app.ml.models.user import User

db = SessionLocal()
try:
    users = db.query(User).order_by(User.id).all()
    for user in users:
        print({
            "username": user.username,
            "role": user.role.value if user.role else None,
            "status": user.status,
            "email_verified": bool(user.email_verified_at),
            "phone_verified": bool(user.phone_verified_at),
        })
finally:
    db.close()
