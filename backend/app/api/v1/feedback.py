from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.ml.models.user import User
from app.models.feedback import Feedback

router = APIRouter(prefix="/feedback", tags=["Feedback"])


class FeedbackCreate(BaseModel):
    username: str = Field(min_length=1, max_length=80)
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=254)
    rating: int = Field(ge=1, le=5)
    category: str = Field(min_length=1, max_length=40)
    reason: str = Field(min_length=1, max_length=4000)


class FeedbackResponse(BaseModel):
    message: str
    id: int


@router.post("", response_model=FeedbackResponse, status_code=201)
def submit_feedback(
    payload: FeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    feedback = Feedback(
        user_id=current_user.id,
        username=payload.username.strip(),
        email=payload.email,
        rating=payload.rating,
        category=payload.category,
        reason=payload.reason.strip(),
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return FeedbackResponse(message="Feedback submitted successfully", id=feedback.id)
