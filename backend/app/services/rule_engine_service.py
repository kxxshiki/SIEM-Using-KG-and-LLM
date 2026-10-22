
"""
Rule Engine — Phase 4.
"""

from typing import Any, Dict, List, Optional, Tuple

from app.core.redis_client import (
    increment_and_get_count,
    increment_and_get_counts_batch,
    increment_and_get_counts_batch_per_item,
)
from app.services import mitre_mapping_service


SIGNATURE_RULES: Dict[str, Dict[str, Any]] = {
    "brute_force": {
        "alert_type": "Brute Force Attempt",
        "base_score": 70,
        "confidence": 0.75,
    },
    "sql_injection": {
        "alert_type": "SQL Injection Attempt",
        "base_score": 80,
        "confidence": 0.85,
    },
    "port_scan": {
        "alert_type": "Port Scan Detected",
        "base_score": 55,
        "confidence": 0.70,
    },
    "ddos": {
        "alert_type": "DDoS Activity",
        "base_score": 90,
        "confidence": 0.80,
    },
    "malware": {
        "alert_type": "Malware Signature",
        "base_score": 95,
        "confidence": 0.90,
    },
    "unauthorized_access": {
        "alert_type": "Unauthorized Access",
        "base_score": 75,
        "confidence": 0.75,
    },
    "powershell_activity": {
        "alert_type": "Suspicious PowerShell Activity",
        "base_score": 65,
        "confidence": 0.70,
    },
    "process_creation": {
        "alert_type": "Suspicious Process Creation",
        "base_score": 60,
        "confidence": 0.60,
    },
}

THRESHOLD_RULES: Dict[str, Dict[str, Any]] = {
    "brute_force": {
        "count": 5,
        "window_seconds": 300,
        "escalated_score": 95,
    },
    "port_scan": {
        "count": 10,
        "window_seconds": 120,
        "escalated_score": 85,
    },
}


def score_to_severity(score: float) -> str:
    """Convert a numeric risk score into a severity."""
    if score >= 85:
        return "critical"
    if score >= 65:
        return "high"
    if score >= 40:
        return "medium"
    return "low"


def _build_alert(
    normalized: Dict[str, Any],
    log_id: int,
    *,
    base_score: float,
    confidence: float,
    rule_name: str,
    description: str,
) -> Dict[str, Any]:
    """Build the common alert structure."""
    event_type = normalized.get("event_type")
    signature = SIGNATURE_RULES.get(event_type)

    if signature is None:
        raise ValueError(
            f"Cannot build an alert for unsupported event type: "
            f"{event_type!r}"
        )

    mitre_technique_fk = (
        mitre_mapping_service.get_db_id_for_event_type(event_type)
    )

    return {
        "log_id": log_id,
        "alert_type": signature["alert_type"],
        "rule_name": rule_name,
        "severity": score_to_severity(base_score),
        "risk_score": float(base_score),
        "confidence": float(confidence),
        "ip_address": normalized.get("ip_address"),
        "description": description,
        "mitre_technique_fk": mitre_technique_fk,
    }


def _make_description(
    event_type: str,
    ip: Optional[str],
) -> str:
    return (
        f"Detected '{event_type}' pattern from {ip} "
        "via signature matching."
    )


def _evaluate_threshold(
    event_type: str,
    ip: Optional[str],
    count: int,
) -> Tuple[Optional[float], Optional[float], str, Optional[str]]:
    """Return escalation details when the threshold is reached."""
    threshold_rule = THRESHOLD_RULES.get(event_type)

    if not threshold_rule or not ip or ip == "0.0.0.0":
        return None, None, "signature_match", None

    if count < threshold_rule["count"]:
        return None, None, "signature_match", None

    signature = SIGNATURE_RULES[event_type]
    confidence = min(signature["confidence"] + 0.15, 0.99)

    description = (
        f"{count} '{event_type}' events from {ip} within "
        f"{threshold_rule['window_seconds']} seconds — "
        "pattern confirmed, not a one-off."
    )

    return (
        float(threshold_rule["escalated_score"]),
        confidence,
        "threshold_correlation",
        description,
    )


def evaluate(
    normalized: Dict[str, Any],
    log_id: int,
) -> Optional[Dict[str, Any]]:
    """Evaluate one normalized log entry."""
    event_type = normalized.get("event_type")
    signature = SIGNATURE_RULES.get(event_type)

    if signature is None:
        return None

    ip = normalized.get("ip_address")
    base_score = float(signature["base_score"])
    confidence = float(signature["confidence"])
    rule_name = "signature_match"
    description = _make_description(event_type, ip)

    threshold_rule = THRESHOLD_RULES.get(event_type)

    if threshold_rule and ip and ip != "0.0.0.0":
        redis_key = f"corr:{event_type}:{ip}"
        count = increment_and_get_count(
            redis_key,
            threshold_rule["window_seconds"],
        )

        (
            escalated_score,
            escalated_confidence,
            escalated_rule,
            escalated_description,
        ) = _evaluate_threshold(event_type, ip, count)

        if escalated_score is not None:
            base_score = escalated_score
            confidence = escalated_confidence
            rule_name = escalated_rule
            description = escalated_description or description

    return _build_alert(
        normalized,
        log_id,
        base_score=base_score,
        confidence=confidence,
        rule_name=rule_name,
        description=description,
    )


def evaluate_batch(
    rows: List[Dict[str, Any]],
    log_ids: List[int],
) -> List[Dict[str, Any]]:
    """
    Evaluate normalized logs in a batch.

    Redis counters are incremented in a pipeline. Per-item counter results
    preserve the individual increment count when multiple logs share a key.
    """
    if not rows:
        return []

    if len(rows) != len(log_ids):
        raise ValueError(
            "rows and log_ids must contain the same number of items"
        )

    matched_rows = []
    redis_items = []

    for row, log_id in zip(rows, log_ids):
        event_type = row.get("event_type")
        signature = SIGNATURE_RULES.get(event_type)

        if signature is None:
            continue

        ip = row.get("ip_address")
        threshold_rule = THRESHOLD_RULES.get(event_type)
        redis_key = None

        if threshold_rule and ip and ip != "0.0.0.0":
            redis_key = f"corr:{event_type}:{ip}"
            redis_items.append(
                (redis_key, threshold_rule["window_seconds"])
            )

        matched_rows.append((row, log_id, signature, redis_key))

    if not matched_rows:
        return []

    # Increment counters and preserve one result for each input item.
    redis_counts = (
        increment_and_get_counts_batch_per_item(redis_items)
        if redis_items
        else []
    )

    # Map each row position to its individual counter result.
    redis_count_by_row = {}
    redis_index = 0

    for row_index, (
        row,
        log_id,
        signature,
        redis_key,
    ) in enumerate(matched_rows):
        if redis_key is not None:
            redis_count_by_row[row_index] = redis_counts[redis_index]
            redis_index += 1

    alerts = []

    for row_index, (
        row,
        log_id,
        signature,
        redis_key,
    ) in enumerate(matched_rows):
        event_type = row["event_type"]
        ip = row.get("ip_address")

        base_score = float(signature["base_score"])
        confidence = float(signature["confidence"])
        rule_name = "signature_match"
        description = _make_description(event_type, ip)

        threshold_rule = THRESHOLD_RULES.get(event_type)

        if threshold_rule and redis_key:
            count = redis_count_by_row.get(row_index, 0)

            (
                escalated_score,
                escalated_confidence,
                escalated_rule,
                escalated_description,
            ) = _evaluate_threshold(event_type, ip, count)

            if escalated_score is not None:
                base_score = escalated_score
                confidence = escalated_confidence
                rule_name = escalated_rule
                description = escalated_description or description

        alerts.append(
            _build_alert(
                row,
                log_id,
                base_score=base_score,
                confidence=confidence,
                rule_name=rule_name,
                description=description,
            )
        )

    return alerts
