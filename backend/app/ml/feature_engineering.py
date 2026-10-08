"""
ML Feature Engineering.

Converts normalized log dictionaries into numeric feature matrices.

Feature vector:

    [hour,
     severity_score,
     event_type_code,
     log_length,
     is_high_severity]

The feature vocabulary MUST remain identical between model training
and prediction.
"""

import numpy as np
from datetime import datetime
from typing import List, Dict, Any


# ---------------------------------------------------------------------------
# CONSTANTS
# ---------------------------------------------------------------------------

SEVERITY_SCORE = {
    "critical": 95,
    "high": 75,
    "medium": 50,
    "low": 20,
}


EVENT_TYPE_VOCAB = {
    "general": 0,
    "login": 1,
    "connection": 2,
    "brute_force": 3,
    "sql_injection": 4,
    "port_scan": 5,
    "ddos": 6,
    "malware": 7,
    "unauthorized_access": 8,
}


# ---------------------------------------------------------------------------
# EVENT TYPE ENCODING
# ---------------------------------------------------------------------------

def encode_event_type(event_type: str) -> int:
    return EVENT_TYPE_VOCAB.get(event_type, 0)


# ---------------------------------------------------------------------------
# FEATURE MATRIX
# ---------------------------------------------------------------------------

def build_feature_matrix(rows: List[Dict[str, Any]]) -> np.ndarray:
    count = len(rows)

    if count == 0:
        return np.empty((0, 5), dtype=np.float64)

    # Precompute lists in one pass
    hours = []
    severity_scores = []
    event_type_codes = []
    log_lengths = []
    high_severity = []

    for row in rows:
        ts = row.get("timestamp") or datetime.utcnow()
        hour = ts.hour if hasattr(ts, "hour") else 12
        hours.append(hour)

        severity = row.get("severity", "low")
        severity_scores.append(SEVERITY_SCORE.get(severity, 20))

        event_type = row.get("event_type", "general")
        event_type_codes.append(EVENT_TYPE_VOCAB.get(event_type, 0))

        raw_log = row.get("raw_log", "") or ""
        log_lengths.append(len(raw_log))

        high_severity.append(1.0 if severity in ("high", "critical") else 0.0)

    # Convert lists to arrays once
    hours = np.array(hours, dtype=np.float64)
    severity_scores = np.array(severity_scores, dtype=np.float64)
    event_type_codes = np.array(event_type_codes, dtype=np.float64)
    log_lengths = np.array(log_lengths, dtype=np.float64)
    high_severity = np.array(high_severity, dtype=np.float64)

    # Final matrix
    return np.column_stack(
        (hours, severity_scores, event_type_codes, log_lengths, high_severity)
    )
