from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime

class SupportTicketCreate(BaseModel):
    subject: str
    message: str
    email: Optional[str] = None

class SupportTicketUpdate(BaseModel):
    status: str

class SupportTicketReply(BaseModel):
    message: str

class SupportTicketResponse(BaseModel):
    id: UUID
    user_id: Optional[UUID]
    subject: str
    message: str
    email: Optional[str]
    status: str
    created_at: datetime
    
    # Optional user details if needed
    user_email: Optional[str] = None

    class Config:
        from_attributes = True
