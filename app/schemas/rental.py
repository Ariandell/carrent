from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime
from app.models.rental import RentalStatus

class RentalBase(BaseModel):
    car_id: UUID
    duration_minutes: int

class RentalCreate(RentalBase):
    pass

class RentalExtend(BaseModel):
    rental_id: UUID
    additional_minutes: int

class RentalResponse(BaseModel):
    id: UUID
    car_id: UUID
    user_id: UUID
    started_at: datetime
    duration_minutes: int
    extended_minutes: int
    ended_at: Optional[datetime]
    status: RentalStatus
    issue_report: Optional[str] = None
    rating: Optional[int] = None
    feedback: Optional[str] = None
    
    class Config:
        from_attributes = True

class RentalReport(BaseModel):
    rental_id: UUID
    issue: str

class RentalFeedback(BaseModel):
    rental_id: UUID
    rating: int
    comment: Optional[str] = None
