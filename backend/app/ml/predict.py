"""
ML Prediction Service.

Loads trained Isolation Forest and Random Forest models once and performs
predictions on complete batches instead of processing individual rows.

Isolation Forest:
    Detects previously unseen/anomalous behavior.

Random Forest:
    Classifies detected behavior into a known attack category.

Both models operate on the same feature matrix produced by
app.ml.feature_engineering.
"""

import os
import pickle
from typing import Tuple, Optional

import numpy as np


# ---------------------------------------------------------------------------
# MODEL DIRECTORY
# ---------------------------------------------------------------------------

MODEL_DIR = os.path.join(
    os.path.dirname(__file__),
    "models",
)


# ---------------------------------------------------------------------------
# MODEL SINGLETONS
# ---------------------------------------------------------------------------

_iso_forest = None
_rf = None
_metrics = None


# ---------------------------------------------------------------------------
# LOAD MODELS
# ---------------------------------------------------------------------------

def _ensure_loaded() -> None:
    """
    Load trained ML models once.

    Models are kept in memory after the first load so every subsequent
    prediction does not repeatedly read the pickle files from disk.

    If model files do not exist, the training pipeline is executed first.
    """

    global _iso_forest, _rf, _metrics

    if _iso_forest is not None and _rf is not None:
        return

    iso_path = os.path.join(
        MODEL_DIR,
        "isolation_forest.pkl",
    )

    rf_path = os.path.join(
        MODEL_DIR,
        "random_forest.pkl",
    )

    metrics_path = os.path.join(
        MODEL_DIR,
        "metrics.pkl",
    )

    # -----------------------------------------------------------------------
    # Train Models If They Do Not Exist
    # -----------------------------------------------------------------------

    if not (
        os.path.exists(iso_path)
        and os.path.exists(rf_path)
    ):
        from app.ml.train import train_models

        train_models()

    # -----------------------------------------------------------------------
    # Load Isolation Forest
    # -----------------------------------------------------------------------

    with open(iso_path, "rb") as f:
        _iso_forest = pickle.load(f)

    # -----------------------------------------------------------------------
    # Load Random Forest
    # -----------------------------------------------------------------------

    with open(rf_path, "rb") as f:
        _rf = pickle.load(f)

    # -----------------------------------------------------------------------
    # Load Training Metrics
    # -----------------------------------------------------------------------

    if os.path.exists(metrics_path):

        with open(metrics_path, "rb") as f:
            _metrics = pickle.load(f)

    else:
        _metrics = {}


# ---------------------------------------------------------------------------
# BATCH PREDICTION
# ---------------------------------------------------------------------------

def predict_batch(
    X: np.ndarray,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Predict an entire feature matrix in one operation.

    Args:
        X:
            NumPy feature matrix with shape:

                (number_of_logs, number_of_features)

    Returns:
        Tuple containing:

        is_anomaly:
            Boolean array.
            True  = Isolation Forest detected an anomaly.
            False = normal according to Isolation Forest.

        predicted_class:
            Integer class predicted by Random Forest.

        confidence:
            Random Forest probability for the predicted class.
    """

    _ensure_loaded()

    # -----------------------------------------------------------------------
    # Input Validation
    # -----------------------------------------------------------------------

    if not isinstance(X, np.ndarray):
        X = np.asarray(X, dtype=float)

    if X.ndim == 1:
        X = X.reshape(1, -1)

    if X.size == 0:
        return (
            np.array([], dtype=bool),
            np.array([], dtype=int),
            np.array([], dtype=float),
        )

    # -----------------------------------------------------------------------
    # Isolation Forest
    # -----------------------------------------------------------------------

    # Isolation Forest:
    #     -1 = anomaly
    #      1 = normal

    iso_pred = _iso_forest.predict(X)

    is_anomaly = iso_pred == -1

    # -----------------------------------------------------------------------
    # Random Forest Classification
    # -----------------------------------------------------------------------

    rf_proba = _rf.predict_proba(X)

    predicted_class = np.argmax(
        rf_proba,
        axis=1,
    )

    confidence = np.max(
        rf_proba,
        axis=1,
    )

    return (
        is_anomaly,
        predicted_class,
        confidence,
    )


# ---------------------------------------------------------------------------
# MODEL METRICS
# ---------------------------------------------------------------------------

def get_metrics() -> dict:
    """
    Return the metrics generated during model training.
    """

    _ensure_loaded()

    return _metrics or {}


# ---------------------------------------------------------------------------
# MODEL RETRAINING
# ---------------------------------------------------------------------------

def retrain() -> dict:
    """
    Retrain both ML models and reload them into memory.

    Returns:
        Training metrics.
    """

    global _iso_forest, _rf, _metrics

    from app.ml.train import train_models

    metrics = train_models()

    # Clear existing model instances.
    _iso_forest = None
    _rf = None
    _metrics = None

    # Reload newly trained models.
    _ensure_loaded()

    return metrics


# ---------------------------------------------------------------------------
# SIMPLE LOCAL TEST
# ---------------------------------------------------------------------------

if __name__ == "__main__":

    X = np.array(
        [
            # Normal-looking event
            [10, 20, 0, 80, 0],

            # Suspicious-looking event
            [2, 95, 3, 180, 1],
        ],
        dtype=float,
    )

    (
        is_anomaly,
        predicted_class,
        confidence,
    ) = predict_batch(X)

    print("Is anomaly:", is_anomaly)
    print("Predicted class:", predicted_class)
    print("Confidence:", confidence)