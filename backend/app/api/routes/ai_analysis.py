
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.neo4j_service import get_graph_context
from app.services.ollama_service import ask_ollama

router = APIRouter(
    prefix="/api/ai",
    tags=["AI Analysis"],
)


class AnalysisRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    mode: str = "auto"


@router.post("/analyze")
async def analyze(request: AnalysisRequest):
    if request.mode not in {"auto", "manual"}:
        raise HTTPException(
            status_code=400,
            detail="Mode must be auto or manual",
        )

    try:
        graph_context = await get_graph_context_async()

        answer = await ask_ollama(
            request.question,
            graph_context,
        )

        return {
            "answer": answer,
            "mode": request.mode,
            "graph_context": graph_context,
        }

    except Exception as exc:
        # Log the full exception on the server in production.
        raise HTTPException(
            status_code=503,
            detail="AI analysis failed. Check Ollama and Neo4j.",
        ) from exc
