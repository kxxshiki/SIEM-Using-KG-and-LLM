from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from app.config import settings


engine = create_engine(
    settings.DATABASE_URL,

    # Connection pool
    pool_size=20,
    max_overflow=20,
    pool_timeout=30,

    # Check connections before using them
    pool_pre_ping=True,

    # Keep connections available for reuse
    pool_recycle=1800,

    # Faster bulk operations
    executemany_mode="values_plus_batch",
    executemany_batch_page_size=1000,
)


SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


def get_db() -> Session:
    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()