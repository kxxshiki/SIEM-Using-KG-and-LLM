
from typing import Any, Dict, List, Set

from app.ml.feature_engineering import build_feature_matrix
from app.ml import predict as ml_predict
from app.services import mitre_mapping_service


# ---------------------------------------------------------------------------
# ML LABELS
# ---------------------------------------------------------------------------

LABELS = [
    "Normal",
    "brute_force",
    "ddos",
    "sql_injection",
    "port_scan",
]


# ---------------------------------------------------------------------------
# SCORE TO SEVERITY
# ---------------------------------------------------------------------------

def score_to_severity(score: float) -> str:
    """Convert numeric risk score into severity."""
    if score >= 85:
        return "critical"
    if score >= 65:
        return "high"
    if score >= 40:
        return "medium"
    return "low"


# ---------------------------------------------------------------------------
# BATCH ML EVALUATION
# ---------------------------------------------------------------------------

def evaluate_batch(
    rows: List[Dict[str, Any]],
    log_ids: List[int],
    skip_ids: Set[int],
) -> List[Dict[str, Any]]:
    """
    Evaluate normalized logs using the ML prediction pipeline.

    Logs already flagged by the rule engine are excluded to reduce duplicate
    alerts. Returns alert dictionaries compatible with the existing pipeline.
    """
    if not rows:
        return []

    if len(rows) != len(log_ids):
        raise ValueError(
            "rows and log_ids must contain the same number of items"
        )

    # Step 1: Build feature matrix.
    X = build_feature_matrix(rows)

    # Step 2: Run predictions.
    is_anomaly, predicted_class, confidence = ml_predict.predict_batch(X)

    if not (
        len(is_anomaly) == len(predicted_class) == len(confidence) == len(rows)
    ):
        raise ValueError(
            "ML prediction outputs must match the number of input rows"
        )

    alerts: List[Dict[str, Any]] = []

    # Step 3: Process predictions.
    for i, (row, log_id) in enumerate(zip(rows, log_ids)):
        # The rule engine already generated an alert for this log.
        if log_id in skip_ids:
            continue

        is_anom = bool(is_anomaly[i])
        pred_class = int(predicted_class[i])

        # Skip normal predictions unless anomaly detection independently
        # flagged the event.
        if not is_anom and pred_class == 0:
            continue

        label = (
            LABELS[pred_class]
            if 0 <= pred_class < len(LABELS)
            else "Unknown"
        )

        conf = float(confidence[i])

        # Normalize confidence if the prediction implementation returns
        # percentages instead of values between 0 and 1.
        if conf > 1.0 and conf <= 100.0:
            conf /= 100.0

        conf = min(max(conf, 0.0), 1.0)

        # Step 4: Calculate risk score.
        base_score = (conf * 70) + (20 if is_anom else 0)
        base_score = float(round(min(max(base_score, 0), 100), 2))

        # Step 5: Determine alert type and rule.
        if label == "Normal" and is_anom:
            alert_type = "Anomalous Behavior"
        elif label == "Unknown":
            alert_type = "Unknown ML Classification"
        else:
            alert_type = label

        rule_name = (
            "ml_isolation_forest"
            if is_anom
            else "ml_random_forest"
        )

        # Step 6: Map only meaningful known threat labels to MITRE.
        mitre_technique_fk = None

        if label in LABELS[1:]:
            mitre_technique_fk = (
                mitre_mapping_service.get_db_id_for_event_type(label)
            )

        # Step 7: Build alert.
        if label == "Normal" and is_anom:
            detection_description = "an anomaly despite a normal classification"
        elif label == "Unknown":
            detection_description = "an unknown threat pattern"
        else:
            detection_description = f"a {label} pattern"

        alerts.append(
            {
                "log_id": log_id,
                "alert_type": alert_type,
                "rule_name": rule_name,
                "severity": score_to_severity(base_score),
                "risk_score": base_score,
                "confidence": round(conf, 3),
                "ip_address": row.get("ip_address"),
                "description": (
                    f"ML flagged this as {detection_description} "
                    f"(confidence {conf:.0%}) — "
                    "not caught by signature rules."
                ),
                "mitre_technique_fk": mitre_technique_fk,
            }
        )

    return alerts
