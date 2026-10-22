
from datetime import datetime, timedelta
from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.core import ttl_cache
from app.core.scope import DataScope, get_data_scope
from app.db.postgres import get_db
from app.models.alert import Alert
from app.models.log_entry import LogEntry
from app.schemas.dashboard import DashboardSummary

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

TREND_DAYS = 7
OPEN_STATUSES = ["NEW", "UNDER_INVESTIGATION", "CONFIRMED_THREAT"]


class DashboardView(DashboardSummary):
    has_data: bool = False


def _daily_counts(db: Session, column, days: int, filters: list) -> List[Dict[str, Any]]:
    """Rows per calendar day (UTC) for the last `days` days, zero-filled."""
    today = datetime.utcnow().date()
    start = today - timedelta(days=days - 1)
    day_col = func.date(column)
    rows = (
        db.query(day_col.label("day"), func.count().label("cnt"))
        .filter(*filters, column >= datetime.combine(start, datetime.min.time()))
        .group_by(day_col)
        .all()
    )
    by_day = {str(row.day): row.cnt for row in rows}
    return [
        {"date": (start + timedelta(days=i)).isoformat(),
         "count": int(by_day.get((start + timedelta(days=i)).isoformat(), 0))}
        for i in range(days)
    ]


def _group_counts(db: Session, column, filters: list, limit: int = 0) -> List[Dict[str, Any]]:
    query = (
        db.query(column, func.count().label("cnt"))
        .filter(*filters, column.isnot(None))
        .group_by(column)
        .order_by(func.count().desc())
    )
    if limit:
        query = query.limit(limit)
    return [{"name": str(name), "count": int(cnt)} for name, cnt in query.all()]


def _empty_summary() -> Dict[str, Any]:
    return {
        "total_logs": 0, "total_alerts": 0, "threats_today": 0, "critical_open_alerts": 0,
        "confirmed_threats": 0, "threat_trend": [], "log_volume": [], "attack_types": [],
        "status_breakdown": [], "severity_breakdown": [], "top_ips": [], "top_countries": [],
        "generated_at": datetime.utcnow().isoformat(), "has_data": False,
    }


def _build_summary(db: Session, scope: DataScope) -> Dict[str, Any]:
    log_f = [] if scope.unrestricted else [LogEntry.upload_id.in_(scope.upload_ids)]
    alert_f = [] if scope.unrestricted else [Alert.upload_id.in_(scope.upload_ids)]
    start_of_today = datetime.combine(datetime.utcnow().date(), datetime.min.time())

    # Totals are stored at upload time, so no table scan is needed for a scoped view.
    total_logs = (scope.logs if not scope.unrestricted
                  else db.query(func.count(LogEntry.id)).scalar() or 0)
    total_alerts = (scope.alerts if not scope.unrestricted
                    else db.query(func.count(Alert.id)).scalar() or 0)

    threats_today = (db.query(func.count(Alert.id))
                     .filter(*alert_f, Alert.created_at >= start_of_today).scalar() or 0)
    critical_open = (db.query(func.count(Alert.id))
                     .filter(*alert_f, Alert.severity == "critical", Alert.status.in_(OPEN_STATUSES))
                     .scalar() or 0)
    confirmed = (db.query(func.count(Alert.id))
                 .filter(*alert_f, Alert.status == "CONFIRMED_THREAT").scalar() or 0)

    country_rows = (
        db.query(LogEntry.country, func.count(Alert.id).label("cnt"))
        .join(Alert, Alert.log_id == LogEntry.id)
        .filter(*alert_f, LogEntry.country.isnot(None))
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
        "threat_trend": _daily_counts(db, Alert.created_at, TREND_DAYS, alert_f),
        "log_volume": _daily_counts(db, LogEntry.created_at, TREND_DAYS, log_f),
        "attack_types": _group_counts(db, Alert.alert_type, alert_f, limit=8),
        "status_breakdown": _group_counts(db, Alert.status, alert_f),
        "severity_breakdown": _group_counts(db, Alert.severity, alert_f),
        "top_ips": _group_counts(db, Alert.ip_address, alert_f, limit=10),
        "top_countries": [{"name": str(c), "count": int(n)} for c, n in country_rows],
        "generated_at": datetime.utcnow().isoformat(),
        "has_data": int(total_logs) > 0,
    }


@router.get("/summary", response_model=DashboardView)
def dashboard_summary(
    refresh: bool = False,
    scope: DataScope = Depends(get_data_scope),   # also requires a valid login
    db: Session = Depends(get_db),
):
    """`?refresh=true` skips the cache (the dashboard's Refresh button)."""
    if scope.is_empty or (not scope.unrestricted and scope.logs == 0):
        return _empty_summary()   # fresh sign-in: nothing to count, answers at once
    return ttl_cache.cached(
        f"summary:{scope.key}", settings.SUMMARY_CACHE_SECONDS,
        lambda: _build_summary(db, scope), force=refresh,
    )