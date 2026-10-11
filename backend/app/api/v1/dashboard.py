"""
Dashboard summary endpoint.

One request returns everything the dashboard needs, and the result is cached
in Redis for 30 seconds — so a dashboard that auto-refreshes every 10 seconds
only hits PostgreSQL about twice a minute no matter how many people have it open.

The cache is BEST-EFFORT: if Redis is down, we simply skip it and query
PostgreSQL directly. The dashboard never breaks because of Redis.
"""
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.redis_client import cache_get, cache_set
from app.models.alert import Alert
from app.models.log_entry import LogEntry
from app.models.user import User
from app.schemas.dashboard import DashboardSummary

logger = logging.getLogger("siem.dashboard")
router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

CACHE_KEY = "dashboard:summary"
CACHE_TTL_SECONDS = 30
TREND_DAYS = 7

# Alert statuses that mean "someone still needs to look at this".
OPEN_STATUSES = ["NEW", "UNDER_INVESTIGATION", "CONFIRMED_THREAT"]


def _daily_counts(db: Session, column, days: int) -> List[Dict[str, Any]]:
    """Rows per calendar day (UTC) for the last `days` days, zero-filled."""
    today = datetime.utcnow().date()
    start = today - timedelta(days=days - 1)
    day_col = func.date(column)  # works on PostgreSQL and SQLite

    rows = (
        db.query(day_col.label("day"), func.count().label("cnt"))
        .filter(column >= datetime.combine(start, datetime.min.time()))
        .group_by(day_col)
        .all()
    )
    by_day = {str(row.day): row.cnt for row in rows}  # key = "YYYY-MM-DD"

    result = []
    for i in range(days):
        d = start + timedelta(days=i)
        result.append({"date": d.isoformat(), "count": int(by_day.get(d.isoformat(), 0))})
    return result


def _group_counts(db: Session, column, limit: int = 0, only_not_null: bool = True) -> List[Dict[str, Any]]:
    """GROUP BY one column and count — used for attack types, statuses, IPs, etc."""
    query = db.query(column, func.count().label("cnt"))
    if only_not_null:
        query = query.filter(column.isnot(None))
    query = query.group_by(column).order_by(func.count().desc())
    if limit:
        query = query.limit(limit)
    return [{"name": str(name), "count": int(cnt)} for name, cnt in query.all()]


def _build_summary(db: Session) -> Dict[str, Any]:
    start_of_today = datetime.combine(datetime.utcnow().date(), datetime.min.time())

    total_logs = db.query(func.count(LogEntry.id)).scalar() or 0
    total_alerts = db.query(func.count(Alert.id)).scalar() or 0
    threats_today = db.query(func.count(Alert.id)).filter(Alert.created_at >= start_of_today).scalar() or 0
    critical_open = (
        db.query(func.count(Alert.id))
        .filter(Alert.severity == "critical", Alert.status.in_(OPEN_STATUSES))
        .scalar()
        or 0
    )
    confirmed = db.query(func.count(Alert.id)).filter(Alert.status == "CONFIRMED_THREAT").scalar() or 0

    # Countries of the logs that actually triggered alerts (not every log ever).
    country_rows = (
        db.query(LogEntry.country, func.count(Alert.id).label("cnt"))
        .join(Alert, Alert.log_id == LogEntry.id)
        .filter(LogEntry.country.isnot(None))
        .group_by(LogEntry.country)
        .order_by(func.count(Alert.id).desc())
        .limit(8)
        .all()
    )

    return {
        "total_logs": int(total_logs),
        "total_alerts": int(total_alerts),
        "threats_today": int(threats_today),
        "critical_open_alerts": int(critical_open),
        "confirmed_threats": int(confirmed),
        "threat_trend": _daily_counts(db, Alert.created_at, TREND_DAYS),
        "log_volume": _daily_counts(db, LogEntry.created_at, TREND_DAYS),
        "attack_types": _group_counts(db, Alert.alert_type, limit=8),
        "status_breakdown": _group_counts(db, Alert.status),
        "severity_breakdown": _group_counts(db, Alert.severity),
        "top_ips": _group_counts(db, Alert.ip_address, limit=10),
        "top_countries": [{"name": str(c), "count": int(n)} for c, n in country_rows],
        "generated_at": datetime.utcnow().isoformat(),
    }


@router.get("/summary", response_model=DashboardSummary)
def dashboard_summary(
    refresh: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """`?refresh=true` skips the cache — used by the dashboard's Refresh button."""
    if not refresh:
        try:
            cached = cache_get(CACHE_KEY)
            if cached:
                return cached
        except Exception:
            logger.warning("Redis unavailable — reading dashboard straight from PostgreSQL")

    summary = _build_summary(db)

    try:
        cache_set(CACHE_KEY, summary, CACHE_TTL_SECONDS)
    except Exception:
        logger.warning("Redis unavailable — dashboard result not cached")

    return summary