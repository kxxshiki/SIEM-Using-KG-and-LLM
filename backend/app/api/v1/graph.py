from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, require_admin
from app.models.alert import Alert
from app.models.log_entry import LogEntry
from app.ml.models.user import User
from app.schemas.graph import (
    GraphHealthResponse,
    GraphSyncResponse,
    GraphBackfillResponse,
    GraphCorrelationResponse,
)
from app.graph import graph_client, graph_sync_service

router = APIRouter(prefix="/graph", tags=["Graph"])


@router.get("/health", response_model=GraphHealthResponse)
def graph_health(current_user: User = Depends(get_current_user)):
    """Check Neo4j availability."""
    available = graph_client.is_available()

    return GraphHealthResponse(
        available=available,
        message=(
            "Connected to Neo4j"
            if available
            else "Neo4j unavailable — graph features inactive"
        ),
    )


@router.get("/visualization")
def graph_visualization(
    limit: int = Query(default=100, ge=1, le=500),
    edge_limit: int = Query(default=500, ge=1, le=2000),
    current_user: User = Depends(get_current_user),
):
    """
    Return Neo4j nodes and relationships for the React graph.

    Response:
      {
        "nodes": [...],
        "edges": [...],
        "links": [...]
      }

    The links field supports graph libraries such as
    react-force-graph-2d.
    """
    if not graph_client.is_available():
        raise HTTPException(
            status_code=503,
            detail="Neo4j is unavailable. Check /graph/health.",
        )

    node_query = """
    MATCH (n)
    RETURN
        elementId(n) AS id,
        labels(n) AS labels,
        properties(n) AS properties
    LIMIT $limit
    """

    nodes_result = graph_client.run_read(
        node_query,
        {"limit": limit},
    )

    if nodes_result is None:
        raise HTTPException(
            status_code=503,
            detail="Failed to read graph nodes from Neo4j.",
        )

    nodes = [
        {
            "id": str(record["id"]),
            "labels": record["labels"] or [],
            "properties": record["properties"] or {},
        }
        for record in nodes_result
    ]

    if not nodes:
        return {"nodes": [], "edges": [], "links": []}

    node_ids = [node["id"] for node in nodes]

    edge_query = """
    MATCH (a)-[r]->(b)
    WHERE elementId(a) IN $node_ids
      AND elementId(b) IN $node_ids
    RETURN
        elementId(r) AS id,
        elementId(a) AS source,
        elementId(b) AS target,
        type(r) AS type,
        properties(r) AS properties
    LIMIT $edge_limit
    """

    edges_result = graph_client.run_read(
        edge_query,
        {
            "node_ids": node_ids,
            "edge_limit": edge_limit,
        },
    )

    if edges_result is None:
        raise HTTPException(
            status_code=503,
            detail="Failed to read graph relationships from Neo4j.",
        )

    edges = [
        {
            "id": str(record["id"]),
            "source": str(record["source"]),
            "target": str(record["target"]),
            "type": record["type"],
            "properties": record["properties"] or {},
        }
        for record in edges_result
    ]

    return {
        "nodes": nodes,
        "edges": edges,
        "links": edges,
    }


@router.post("/sync/{alert_id}", response_model=GraphSyncResponse)
def sync_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manually synchronize one alert into Neo4j."""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()

    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    log = db.query(LogEntry).filter(
        LogEntry.id == alert.log_id
    ).first()

    if not log:
        raise HTTPException(
            status_code=404,
            detail="Related log entry not found",
        )

    synced = graph_sync_service.sync_alert_to_graph(alert, log)

    return GraphSyncResponse(
        alert_id=alert_id,
        synced=synced,
        message=(
            "Synced to graph"
            if synced
            else "Sync failed or Neo4j unavailable — check /graph/health"
        ),
    )


@router.post("/backfill", response_model=GraphBackfillResponse)
def backfill(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Synchronize previously investigated alerts into Neo4j."""
    if not graph_client.is_available():
        return GraphBackfillResponse(
            total_candidates=0,
            synced=0,
            failed=0,
            skipped_graph_unavailable=True,
        )

    alerts = db.query(Alert).filter(
        Alert.investigated_at.isnot(None)
    ).all()

    synced = 0
    failed = 0

    for alert in alerts:
        log = db.query(LogEntry).filter(
            LogEntry.id == alert.log_id
        ).first()

        if not log:
            failed += 1
            continue

        if graph_sync_service.sync_alert_to_graph(alert, log):
            synced += 1
        else:
            failed += 1

    return GraphBackfillResponse(
        total_candidates=len(alerts),
        synced=synced,
        failed=failed,
        skipped_graph_unavailable=False,
    )


@router.get(
    "/correlation/ip/{ip}",
    response_model=GraphCorrelationResponse,
)
def correlation_by_ip(
    ip: str,
    current_user: User = Depends(get_current_user),
):
    results = graph_sync_service.get_correlation_by_ip(ip)

    if results is None:
        raise HTTPException(
            status_code=503,
            detail="Graph database unavailable",
        )

    return GraphCorrelationResponse(
        query_type="ip",
        query_value=ip,
        count=len(results),
        results=results,
    )


@router.get(
    "/correlation/user/{username}",
    response_model=GraphCorrelationResponse,
)
def correlation_by_user(
    username: str,
    current_user: User = Depends(get_current_user),
):
    results = graph_sync_service.get_correlation_by_user(username)

    if results is None:
        raise HTTPException(
            status_code=503,
            detail="Graph database unavailable",
        )

    return GraphCorrelationResponse(
        query_type="user",
        query_value=username,
        count=len(results),
        results=results,
    )


@router.get(
    "/correlation/device/{device}",
    response_model=GraphCorrelationResponse,
)
def correlation_by_device(
    device: str,
    current_user: User = Depends(get_current_user),
):
    results = graph_sync_service.get_correlation_by_device(device)

    if results is None:
        raise HTTPException(
            status_code=503,
            detail="Graph database unavailable",
        )

    return GraphCorrelationResponse(
        query_type="device",
        query_value=device,
        count=len(results),
        results=results,
    )


@router.get(
    "/correlation/technique/{technique_id}",
    response_model=GraphCorrelationResponse,
)
def correlation_by_technique(
    technique_id: str,
    current_user: User = Depends(get_current_user),
):
    results = graph_sync_service.get_correlation_by_technique(
        technique_id
    )

    if results is None:
        raise HTTPException(
            status_code=503,
            detail="Graph database unavailable",
        )

    return GraphCorrelationResponse(
        query_type="technique",
        query_value=technique_id,
        count=len(results),
        results=results,
    )