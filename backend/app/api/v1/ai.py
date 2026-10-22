
import logging
from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.graph import graph_client
from app.services.ollama_service import (
    MODEL_NAME,
    analyze_security_events,
)

logger = logging.getLogger("siem.ollama")

router = APIRouter(prefix="/ai", tags=["AI"])

MAX_GRAPH_RECORDS = 5

SENSITIVE_KEYS = {
    "password",
    "hashed_password",
    "token",
    "access_token",
    "refresh_token",
    "secret",
    "api_key",
    "private_key",
}


class SecurityAnalysisRequest(BaseModel):
    """Manual event analysis or automatic graph analysis."""

    events: list[dict[str, Any]] = Field(
        default_factory=list,
        max_length=100,
        description="Security events for manual analysis",
    )
    mode: Literal["manual", "auto"] = "manual"
    question: str = Field(
        default="Analyze the available security evidence.",
        min_length=1,
        max_length=2000,
    )



class SecurityAnalysisResponse(BaseModel):
    success: bool
    model: str
    analysis: str
    execution_time_seconds: float
    cached: bool = False



def _sanitize_properties(properties: dict[str, Any] | None) -> dict[str, Any]:
    """Remove sensitive fields and keep graph values JSON serializable."""

    if not isinstance(properties, dict):
        return {}

    sanitized = {}

    for key, value in properties.items():
        if key.lower() in SENSITIVE_KEYS:
            continue

        if isinstance(value, (str, int, float, bool)) or value is None:
            sanitized[key] = value
        elif isinstance(value, list):
            sanitized[key] = [
                item
                for item in value[:20]
                if isinstance(item, (str, int, float, bool))
                or item is None
            ]

    return sanitized


def get_graph_context(limit: int = MAX_GRAPH_RECORDS) -> dict[str, Any]:
    """Retrieve graph evidence using the existing shared Neo4j client."""

    relationship_query = """
    MATCH (a)-[r]->(b)
    RETURN
        elementId(a) AS source_id,
        labels(a) AS source_labels,
        properties(a) AS source_properties,
        type(r) AS relationship,
        properties(r) AS relationship_properties,
        elementId(b) AS target_id,
        labels(b) AS target_labels,
        properties(b) AS target_properties
    LIMIT $limit
    """

    records = graph_client.run_read(
        relationship_query,
        {"limit": limit},
    )

    if records is None:
        raise RuntimeError("Unable to read relationships from Neo4j.")

    relationships = [
        {
            "source_id": record["source_id"],
            "source_labels": record["source_labels"] or [],
            "source_properties": _sanitize_properties(
                record["source_properties"]
            ),
            "relationship": record["relationship"],
            "relationship_properties": _sanitize_properties(
                record["relationship_properties"]
            ),
            "target_id": record["target_id"],
            "target_labels": record["target_labels"] or [],
            "target_properties": _sanitize_properties(
                record["target_properties"]
            ),
        }
        for record in records
    ]

    isolated_nodes = []

    # If no relationships exist, check for isolated nodes.
    if not relationships:
        node_query = """
        MATCH (n)
        WHERE NOT (n)--()
        RETURN
            elementId(n) AS node_id,
            labels(n) AS labels,
            properties(n) AS properties
        LIMIT $limit
        """

        nodes = graph_client.run_read(
            node_query,
            {"limit": limit},
        )

        if nodes is None:
            raise RuntimeError("Unable to read nodes from Neo4j.")

        isolated_nodes = [
            {
                "node_id": record["node_id"],
                "labels": record["labels"] or [],
                "properties": _sanitize_properties(
                    record["properties"]
                ),
            }
            for record in nodes
        ]

    return {
        "relationship_count": len(relationships),
        "relationships": relationships,
        "isolated_nodes": isolated_nodes,
    }


@router.get("/health")
def ai_health() -> dict[str, str]:
    """Report the configured AI model."""

    return {
        "status": "configured",
        "model": MODEL_NAME,
    }


@router.post(
    "/analyze",
    response_model=SecurityAnalysisResponse,
)
def analyze_events(
    request: SecurityAnalysisRequest,
) -> dict[str, Any]:
    """Analyze manually supplied events or evidence from Neo4j."""

    if request.mode == "manual" and not request.events:
        raise HTTPException(
            status_code=400,
            detail="Provide at least one event for manual analysis.",
        )

    graph_context = None

    if request.mode == "auto":
        try:
            graph_context = get_graph_context()
        except Exception as exc:
            logger.exception("Neo4j graph retrieval failed")
            raise HTTPException(
                status_code=503,
                detail=(
                    "Unable to retrieve graph evidence. "
                    "Check Neo4j connectivity and configuration."
                ),
            ) from exc

        if not graph_context["relationships"] and not graph_context["isolated_nodes"]:
            raise HTTPException(
                status_code=422,
                detail=(
                    "No graph evidence was found. Check whether "
                    "your Neo4j database contains nodes or relationships."
                ),
            )

    # Reuse the existing Ollama service for both analysis modes.
    return analyze_security_events(
        events=request.events,
        graph_context=graph_context,
        question=request.question,
    )
